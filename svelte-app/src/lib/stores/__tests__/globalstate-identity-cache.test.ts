/**
 * @vitest-environment jsdom
 */

/**
 * GlobalState — invariant mono-identité du cache local (login sans Ctrl-R).
 *
 * Cause racine (repro ci-dessous, scénario de la checklist click-through) :
 * le cache Dexie (tables privées + curseurs `syncMeta`) n'est scopé à aucune
 * identité. Un résidu de session précédente — onglet fermé sans logout, token
 * expiré — survit au boot visiteur (aucune purge) puis au login :
 *  - `syncInitial` repart du curseur de l'ancienne identité → delta
 *    `updated >= curseur` muet pour les données du nouveau user ;
 *  - le fallback full-fetch est bloqué car `localCount > 0` (lignes résiduelles).
 * Les events du user n'atterrissent jamais en cache — Ctrl-R « réparait »
 * uniquement parce que la session repartait d'un autre chemin.
 *
 * Seam : vrai GlobalState + vrais stores + vrai pb-sync + transport PB factice
 * (FakePocketBase) + fake-indexeddb. `pb-auth` est mocké (source d'identité
 * pilotable : getCurrentUser / loginWithPassword / onAuthChange capturé).
 *
 * Contrats épinglés :
 *  - arrivée visiteur : les tables privées + curseurs résiduels sont purgés ;
 *  - login sur session sale : purge au changement d'identité AVANT les 3
 *    phases → full fetch (curseur vierge) → events chargés sans rechargement ;
 *  - même identité : aucune purge (curseur conservé — pas de full fetch) ;
 *  - logout : purge + marqueur d'identité réinitialisé, recipes préservé ;
 *  - boot avec session existante : les signaux SSE sont branchés (miroir du
 *    login) ; boot visiteur : non (le login les activera).
 */

const authMock = vi.hoisted(() => {
  type FakeUser = {
    id: string;
    name: string;
    email: string;
    emailVerification: boolean;
  };
  let current: FakeUser | null = null;
  // Les listeners survivent aux tests : le singleton GlobalState s'y est
  // abonné une seule fois, au chargement du module.
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
    USER_B: {
      id: "userold00000001",
      name: "olduser",
      email: "old@dev.local",
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

// Les signaux SSE n'ont pas de surface fake (pb.realtime absent du stub) :
// le branchement est mocké ici (pilotable), le comportement des signaux
// eux-mêmes (debounce, reconnexion) est couvert par pb-realtime-signals.
vi.mock("$lib/db-sync/pb-realtime", () => ({
  initRealtimeSignals: vi.fn(async () => {}),
  teardownRealtimeSignals: vi.fn(async () => {}),
  onRealtimeReconnect: vi.fn(() => () => {}),
}));

// sv-router crée le routeur (et enregistre les pages) au chargement —
// GlobalState ne consomme que `route`.
vi.mock("$lib/router", () => ({
  route: { pathname: "/", params: {}, search: {} },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { currentFakePb } from "./harness/stub-pb";
import { waitForTick } from "./harness/wait-for-tick";
import { makeEvent, T1 } from "./harness/fixtures";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { initRealtimeSignals } from "$lib/db-sync/pb-realtime";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { db } from "$lib/db-sync/pb-sync";
import { pbDate } from "./harness/stub-pb";

const EV_A1 = "eventa0000000001";
const EV_A2 = "eventa0000000002";
const EV_B1 = "eventb0000000001";
// Curseur de l'ancienne session : POSTÉRIEUR à tout `updated` des données
// serveur — c'est lui qui rend la delta sync muette.
const CURSOR_RESIDUAL = "2026-06-08 15:00:00.000Z";
const CACHE_OWNER_KEY = "enka-cache-owner";

/** Session sale : lignes + curseur d'un user précédent (crash sans logout). */
async function seedResidualSession() {
  await db.events.bulkPut([
    makeEvent({ id: EV_B1, createdBy: authMock.USER_B.id }),
  ]);
  await db.syncMeta.put({ collectionId: "events", lastSync: CURSOR_RESIDUAL });
  localStorage.setItem(CACHE_OWNER_KEY, authMock.USER_B.id);
}

/** Données serveur du nouveau user : `updated` < curseur résiduel (muet). */
function seedServerEventsForUserA() {
  currentFakePb().seed("events", [
    makeEvent({
      id: EV_A1,
      createdBy: authMock.USER_A.id,
      updated: pbDate(T1),
    }),
    makeEvent({
      id: EV_A2,
      createdBy: authMock.USER_A.id,
      updated: pbDate(T1),
    }),
  ]);
}

describe("GlobalState — cache local mono-identité (login sans Ctrl-R)", () => {
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

  it("arrivée visiteur : le résidu IndexedDB d'une session précédente est purgé", async () => {
    await seedResidualSession();
    authMock.set(null);

    await globalState.initializeAuth();

    expect(await db.events.count()).toBe(0);
    expect(await db.syncMeta.get("events")).toBeUndefined();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBeNull();
  });

  it("login sur session sale : les events sont chargés sans Ctrl-R", async () => {
    await seedResidualSession();
    seedServerEventsForUserA();
    authMock.set(null);
    await globalState.initializeAuth(); // boot visiteur

    // Chemin AuthModal : loginWithPassword (déclenche authStore.onChange)
    // puis refreshAuthAfterLogin (3 phases).
    authMock.set(authMock.USER_A);
    await authMock.loginWithPassword("ghald@dev.local", "x");
    await globalState.refreshAuthAfterLogin();
    await waitForTick(3);

    // Les events du user atterrissent en cache (full fetch, curseur vierge)
    expect(await db.events.get(EV_A1)).toBeTruthy();
    expect(await db.events.get(EV_A2)).toBeTruthy();
    // Les résidus de l'ancienne session ont disparu
    expect(await db.events.get(EV_B1)).toBeUndefined();
    // Le curseur repart de max(updated) des données fraîches
    expect((await db.syncMeta.get("events"))?.lastSync).toBe(pbDate(T1));
    // La vue store (ce que rend le dashboard) contient les events du user
    expect(eventsStore.events.map((e) => e.id).sort()).toEqual([EV_A1, EV_A2]);
  });

  it("boot avec la même identité : cache et curseur conservés (pas de purge)", async () => {
    seedServerEventsForUserA();
    await db.events.bulkPut([
      makeEvent({
        id: EV_A1,
        createdBy: authMock.USER_A.id,
        updated: pbDate(T1),
      }),
    ]);
    await db.syncMeta.put({ collectionId: "events", lastSync: pbDate(T1) });
    localStorage.setItem(CACHE_OWNER_KEY, authMock.USER_A.id);
    authMock.set(authMock.USER_A);

    await globalState.initializeAuth();

    expect((await db.syncMeta.get("events"))?.lastSync).toBe(pbDate(T1));
    expect(await db.events.get(EV_A1)).toBeTruthy();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe(authMock.USER_A.id);
  });

  it("logout : purge des tables privées + curseurs, marqueur réinitialisé, recipes préservé", async () => {
    seedServerEventsForUserA();
    authMock.set(null);
    await globalState.initializeAuth();
    authMock.set(authMock.USER_A);
    await authMock.loginWithPassword("ghald@dev.local", "x");
    await globalState.refreshAuthAfterLogin();
    expect(await db.events.count()).toBe(2);

    await globalState.logout();
    await waitForTick(2);

    expect(await db.events.count()).toBe(0);
    expect(await db.syncMeta.get("events")).toBeUndefined();
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBeNull();
    // recipes (public) reste disponible pour la session visiteur
    expect(recipesStore.isInitialized).toBe(true);
  });
});

describe("GlobalState — signaux SSE au boot (alerte perte serveur)", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    authMock.reset();
    localStorage.clear();
    await Promise.all(db.tables.map((t) => t.clear()));
    vi.mocked(initRealtimeSignals).mockClear();
    await waitForTick(1);
  });

  afterEach(async () => {
    await globalState.logout().catch(() => {});
  });

  it("boot avec session existante : les signaux SSE sont branchés (miroir du login)", async () => {
    authMock.set(authMock.USER_A);

    await globalState.initializeAuth();

    expect(initRealtimeSignals).toHaveBeenCalledTimes(1);
  });

  it("boot visiteur : signaux non branchés (le login modal les activera)", async () => {
    authMock.set(null);

    await globalState.initializeAuth();

    expect(initRealtimeSignals).not.toHaveBeenCalled();
  });
});
