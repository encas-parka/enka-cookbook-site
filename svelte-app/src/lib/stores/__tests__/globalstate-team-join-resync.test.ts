/**
 * @vitest-environment jsdom
 */

/**
 * GlobalState — join d'équipe : reset des curseurs delta AVANT resync
 * (audit delta-sync, reco 1 — généralisation du fix P12).
 *
 * Le trou : l'invitation team acceptée modifie `teams` seulement — les
 * records nouvellement autorisés (events, teamdocs, materiel, loans)
 * gardent leur `updated` antérieur au curseur : invisibles au delta
 * (`updated >= since`) comme au SSE (PB ne pousse que les changements).
 * Le handler `team_joined` doit invalider les curseurs des collections à
 * curseur global AVANT de resynchroniser — un simple forceRefresh() (delta)
 * reproduirait le trou P12.
 *
 * Seam : même machinerie que globalstate-identity-cache — vrai GlobalState
 * + vrais stores + vrai pb-sync + transport PB factice. `pb.realtime` du
 * stub délivre le topic custom `user_${id}` (payload libre des hooks JSVM).
 */

const authMock = vi.hoisted(() => {
  type FakeUser = {
    id: string;
    name: string;
    email: string;
    emailVerification: boolean;
  };
  let current: FakeUser | null = null;
  const listeners = new Set<(user: FakeUser | null) => void>();
  const emit = (user: FakeUser | null) => {
    for (const cb of [...listeners]) cb(user);
  };
  return {
    USER_A: {
      id: "userghald00001",
      name: "ghald",
      email: "ghald@dev.local",
      emailVerification: true,
    },
    set(user: FakeUser | null) {
      current = user;
    },
    reset() {
      current = null;
    },
    getCurrentUser: (): FakeUser | null => current,
    loginWithPassword: vi.fn(async (): Promise<FakeUser> => {
      if (!current) throw new Error("[authMock] no current user");
      emit(current);
      return current;
    }),
    logout: vi.fn(() => {
      current = null;
      emit(null);
    }),
    onAuthChange: (cb: (user: FakeUser | null) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
});

// jsdom n'implémente pas matchMedia — requis par MediaQuery (champ de classe
// de GlobalState, évalué au chargement du module).
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

vi.mock("$lib/services/pb-auth", () => ({
  getCurrentUser: authMock.getCurrentUser,
  loginWithPassword: authMock.loginWithPassword,
  logout: authMock.logout,
  onAuthChange: authMock.onAuthChange,
}));

vi.mock("$lib/db-sync/pb-realtime", () => ({
  initRealtimeSignals: vi.fn(async () => {}),
  teardownRealtimeSignals: vi.fn(async () => {}),
  onRealtimeReconnect: vi.fn(() => () => {}),
}));

vi.mock("$lib/router", () => ({
  route: { pathname: "/", params: {}, search: {} },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeTeamdocsRecord,
  makeMaterielRecord,
  makeLoanRecord,
  TEST_TEAM_ID,
} from "./harness/fixtures";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

// Données de l'utilisateur : récentes → le curseur monte ici au login
const T_CACHE = pbDate(new Date("2026-06-08T11:30:00.000Z"));
// Records de l'équipe rejointe : ANCIENS (le join ne les modifie pas) —
// strictement sous le curseur : c'est le trou de classe A
const T_GRANTED = pbDate(new Date("2026-01-10T09:00:00.000Z"));

const EV_MINE = "eventmine0000001";
const EV_TEAM = "eventteam000001";
const TD_MINE = "teamdocmine00001";
const TD_TEAM = "teamdocteam00001";
const MAT_MINE = "materielmine001";
const MAT_TEAM = "materielteam001";
const LOAN_TEAM = "loanteam0000001";

/** Données serveur déjà visibles de USER_A : curseur établi sur T_CACHE. */
function seedServerForUserA() {
  const fakePb = currentFakePb();
  fakePb.seed("events", [
    makeEvent({ id: EV_MINE, createdBy: authMock.USER_A.id, updated: T_CACHE }),
  ]);
  fakePb.seed("teamdocs", [
    makeTeamdocsRecord({ id: TD_MINE, updated: T_CACHE }),
  ]);
  fakePb.seed("materiel", [
    makeMaterielRecord({
      id: MAT_MINE,
      ownerUser: authMock.USER_A.id,
      updated: T_CACHE,
    }),
  ]);
}

/** Records de l'équipe rejointe : autorisés par `teams.members`, non modifiés. */
function seedTeamJoinedRecords() {
  const fakePb = currentFakePb();
  fakePb.putRecord(
    "events",
    makeEvent({
      id: EV_TEAM,
      createdBy: "otheruser123456",
      updated: T_GRANTED,
    }),
  );
  fakePb.putRecord(
    "teamdocs",
    makeTeamdocsRecord({
      id: TD_TEAM,
      teamId: TEST_TEAM_ID,
      updated: T_GRANTED,
    }),
  );
  fakePb.putRecord(
    "materiel",
    makeMaterielRecord({ id: MAT_TEAM, updated: T_GRANTED }),
  );
  fakePb.putRecord(
    "materiel_loan",
    makeLoanRecord({ id: LOAN_TEAM, updated: T_GRANTED }),
  );
}

/** Poll jusqu'à ce que check() passe (les resyncs sont asynchrones). */
async function untilTrue(
  check: () => boolean | Promise<boolean>,
): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await waitForTick(1);
  }
  throw new Error("condition never met (resync incomplet ?)");
}

describe("GlobalState — team_joined : reset curseurs avant resync", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    authMock.reset();
    localStorage.clear();
    await Promise.all(db.tables.map((t) => t.clear()));
    await waitForTick(1);
  });

  afterEach(async () => {
    await globalState.logout().catch(() => {});
  });

  it("les records de l'équipe rejointe (updated ancien) atterrissent en cache", async () => {
    // 1. Boot visiteur puis login : cache établi, curseurs sur T_CACHE
    authMock.set(null);
    await globalState.initializeAuth();

    seedServerForUserA();
    authMock.set(authMock.USER_A);
    await authMock.loginWithPassword("ghald@dev.local", "x");
    await globalState.refreshAuthAfterLogin();
    await waitForTick(3);

    expect(await db.events.get(EV_MINE)).toBeTruthy();
    expect((await db.syncMeta.get("events"))?.lastSync).toBe(T_CACHE);
    expect((await db.syncMeta.get("teamdocs"))?.lastSync).toBe(T_CACHE);
    expect((await db.syncMeta.get("materiel"))?.lastSync).toBe(T_CACHE);

    // 2. Join d'équipe côté serveur : nouveaux records autorisés avec un
    //    `updated` ANTÉRIEUR au curseur — invisibles au delta comme au SSE
    seedTeamJoinedRecords();

    // 3. Le hook pousse team_joined sur le topic custom du user
    currentFakePb().emitToTopic(`user_${authMock.USER_A.id}`, {
      action: "team_joined",
      teamId: TEST_TEAM_ID,
      teamName: "Team One",
    });

    // 4. Les quatre collections à curseur global rattrapent leurs records
    await untilTrue(async () => await db.events.get(EV_TEAM));
    await untilTrue(async () => await db.teamdocs.get(TD_TEAM));
    await untilTrue(async () => await db.materiels.get(MAT_TEAM));
    await untilTrue(async () => await db.materielLoans.get(LOAN_TEAM));

    // Le cache préexistant est intact (upserts idempotents, pas de purge)
    expect(await db.events.get(EV_MINE)).toBeTruthy();
    // Les curseurs sont reposés (max updated du full fetch = T_CACHE)
    expect((await db.syncMeta.get("events"))?.lastSync).toBe(T_CACHE);
  });

  it("team_left / team_updated ne resetent PAS les curseurs (delta suffit)", async () => {
    authMock.set(null);
    await globalState.initializeAuth();

    seedServerForUserA();
    authMock.set(authMock.USER_A);
    await authMock.loginWithPassword("ghald@dev.local", "x");
    await globalState.refreshAuthAfterLogin();
    await waitForTick(3);

    currentFakePb().emitToTopic(`user_${authMock.USER_A.id}`, {
      action: "team_updated",
      teamId: TEST_TEAM_ID,
      teamName: "Team One",
    });
    await waitForTick(3);

    // Aucun reset : les curseurs restent en place (pas d'élargissement)
    expect((await db.syncMeta.get("events"))?.lastSync).toBe(T_CACHE);
    expect((await db.syncMeta.get("teamdocs"))?.lastSync).toBe(T_CACHE);
    expect((await db.syncMeta.get("materiel"))?.lastSync).toBe(T_CACHE);
  });
});
