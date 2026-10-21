/**
 * @vitest-environment jsdom
 */

/**
 * GlobalState — contrat d'hydratation au login, et `syncReady` des recettes.
 *
 * Cause racine : la redirection post-login ne peut pas attendre la
 * synchronisation réseau (secondes), mais elle ne peut pas non plus partir
 * avant la purge d'identité — sinon le cache d'un compte précédent s'affiche
 * une fraction de seconde, et la navigation n'a pas de données locales.
 * D'où deux points distincts : `refreshAuthAfterLogin()` (cache local prêt,
 * ce qu'attend la navigation) et `hydration` (phase réseau, feedback).
 *
 * Second contrat : `RecipesStore.syncInitial()` ne doit plus rendre la main
 * quand une revalidation est déjà en vol — la branche visiteur du boot et le
 * login se chevauchent, et `syncReady` trop tôt livrait un index recettes
 * incomplet à ProductsStore.
 *
 * Seam : vrai GlobalState + vrais stores + vrai pb-sync + transport PB factice
 * (FakePocketBase) + fake-indexeddb. `pb-auth` est mocké (identité pilotable).
 *
 * Contrats épinglés :
 *  - deux logins concurrents partagent une seule hydratation ;
 *  - la promesse résout sans attendre la phase réseau (et avant les signaux
 *    SSE, qui n'ont pas à retarder l'affichage) ;
 *  - au point de résolution, la purge d'identité est terminée ;
 *  - une phase réseau en échec donne `hydration === false`, la session reste
 *    ouverte (mode hors ligne) ;
 *  - ce verdict survit à la fin de la phase : un lecteur tardif ne relit pas
 *    un `true` par défaut ;
 *  - un autre compte pendant l'hydratation repart d'une hydratation neuve
 *    (purge + fetch), au lieu de réutiliser celle du précédent ;
 *  - logout pendant l'hydratation : aucune souscription realtime ;
 *  - `syncInitial` pendant une revalidation en vol attend la fin réelle.
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
import { makeEvent, T1 } from "./harness/fixtures";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { initRealtimeSignals } from "$lib/db-sync/pb-realtime";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { db, pb } from "$lib/db-sync/pb-sync";

const EV_A1 = "eventa0000000001";
const CACHE_OWNER_KEY = "enka-cache-owner";

/** Session sale : ligne + marqueur d'un user précédent (crash sans logout). */
async function seedResidualSession() {
  await db.events.bulkPut([
    makeEvent({ id: "eventb0000000001", createdBy: authMock.USER_B.id }),
  ]);
  localStorage.setItem(CACHE_OWNER_KEY, authMock.USER_B.id);
}

function seedServerEventsForUserA() {
  currentFakePb().seed("events", [
    makeEvent({
      id: EV_A1,
      createdBy: authMock.USER_A.id,
      updated: pbDate(T1),
    }),
  ]);
}

/** Promesse résolue plus tard, pilotée par le test. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("GlobalState — hydratation au login (point de navigation)", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    authMock.reset();
    localStorage.clear();
    await Promise.all(db.tables.map((t) => t.clear()));
    vi.mocked(initRealtimeSignals).mockClear();
    await waitForTick(1);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await globalState.logout().catch(() => {});
    await globalState.hydration.catch(() => {});
  });

  it("deux logins concurrents partagent une seule hydratation", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);

    const syncSpy = vi.spyOn(eventsStore, "syncInitial");
    await Promise.all([
      globalState.refreshAuthAfterLogin(),
      globalState.refreshAuthAfterLogin(),
    ]);
    await globalState.hydration;

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(initRealtimeSignals).toHaveBeenCalledTimes(1);
  });

  it("résout au cache local sans attendre la phase réseau", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);

    const gate = deferred();
    const syncSpy = vi
      .spyOn(eventsStore, "syncInitial")
      .mockImplementation(() => gate.promise);

    const outcome = await Promise.race([
      globalState.refreshAuthAfterLogin().then(() => "local"),
      new Promise((r) => setTimeout(() => r("réseau"), 200)),
    ]);

    expect(outcome).toBe("local");
    // La promesse a rendu la main alors que le fetch est encore bloqué : c'est
    // exactement ce que la navigation attend (et rien de plus).
    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(globalState.isAuthenticated).toBe(true);

    gate.resolve();
    expect(await globalState.hydration).toBe(true);
    expect(initRealtimeSignals).toHaveBeenCalledTimes(1);
  });

  it("au point de résolution, la purge d'identité est terminée", async () => {
    await seedResidualSession();
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);

    // Fetch gaté : rien ne peut repeupler la table avant l'assertion.
    const gate = deferred();
    vi.spyOn(eventsStore, "syncInitial").mockImplementation(() => gate.promise);

    await globalState.refreshAuthAfterLogin();

    // Aucun résidu de l'identité précédente ne peut s'afficher : la purge est
    // antérieure à la navigation.
    expect(await db.events.count()).toBe(0);
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe(authMock.USER_A.id);

    gate.resolve();
    expect(await globalState.hydration).toBe(true);
    expect(globalState.authError).toBeNull();
  });

  it("phase réseau en échec : hydration false, session conservée", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);
    vi.spyOn(materielStore, "syncInitial").mockRejectedValue(
      new Error("serveur indisponible"),
    );

    await globalState.refreshAuthAfterLogin();

    expect(await globalState.hydration).toBe(false);
    expect(globalState.isAuthenticated).toBe(true);
    expect(globalState.authError).toContain("serveur indisponible");
  });

  it("le verdict d'hydratation survit à la fin de la phase réseau", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);
    vi.spyOn(materielStore, "syncInitial").mockRejectedValue(
      new Error("serveur indisponible"),
    );

    await globalState.refreshAuthAfterLogin();
    expect(await globalState.hydration).toBe(false);

    // Lecteur tardif (page rouverte une fois la sync terminée) : le verdict
    // ne doit pas retomber sur un `true` par défaut.
    expect(await globalState.hydration).toBe(false);
  });

  it("un autre compte pendant l'hydratation repart d'une hydratation neuve", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);

    // Phase réseau de A bloquée : le compte suivant arrive pendant ce temps.
    const gate = deferred();
    const syncSpy = vi.spyOn(eventsStore, "syncInitial");
    syncSpy.mockImplementationOnce(() => gate.promise);

    await globalState.refreshAuthAfterLogin();
    // Laisser A atteindre sa phase réseau : la sync events est alors gatée.
    await waitForTick(2);
    expect(syncSpy).toHaveBeenCalledTimes(1);
    const hydrationA = globalState.hydration;

    authMock.set(authMock.USER_B);
    await globalState.refreshAuthAfterLogin();

    // Nouvelle hydratation (pas celle de A), et purge passée à B : sans cela
    // B héritait du cache de A sans fetch.
    expect(globalState.hydration).not.toBe(hydrationA);
    expect(localStorage.getItem(CACHE_OWNER_KEY)).toBe(authMock.USER_B.id);

    gate.resolve();
    expect(await globalState.hydration).toBe(true);
    expect(syncSpy).toHaveBeenCalledTimes(2);
  });

  it("logout pendant l'hydratation : aucune souscription realtime", async () => {
    seedServerEventsForUserA();
    authMock.set(authMock.USER_A);

    const pending = globalState.refreshAuthAfterLogin();
    await globalState.logout();
    await pending;

    expect(await globalState.hydration).toBe(false);
    expect(initRealtimeSignals).not.toHaveBeenCalled();
    expect(globalState.isAuthenticated).toBe(false);
  });
});

describe("RecipesStore — syncReady ne devance plus le fetch", () => {
  /** Transport PB gaté : le fetch ne rend la main qu'au `resolve()` du test. */
  function gateRecipesFetch() {
    const gate = deferred();
    const realCollection = pb.collection.bind(pb);
    vi.spyOn(pb, "collection").mockImplementation(((name: string) => ({
      getFullList: async (...args: unknown[]) => {
        await gate.promise;
        return (
          realCollection(name) as unknown as {
            getFullList: (...a: unknown[]) => Promise<unknown>;
          }
        ).getFullList(...args);
      },
    })) as unknown as typeof pb.collection);
    return gate;
  }

  beforeEach(async () => {
    currentFakePb().reset();
    authMock.reset();
    localStorage.clear();
    await Promise.all(db.tables.map((t) => t.clear()));
    await waitForTick(1);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    recipesStore.reset();
  });

  it("syncInitial pendant une revalidation en vol attend la fin réelle", async () => {
    const gate = gateRecipesFetch();

    // Branche visiteur du boot : revalidation lancée, fetch bloqué.
    const revalidation = recipesStore.syncRevalidate();
    // Login : syncInitial doit rejoindre la requête en vol, pas rendre la main.
    const initial = recipesStore.syncInitial();

    let initialSettled = false;
    let ready = false;
    void initial.then(() => {
      initialSettled = true;
    });
    void recipesStore.syncReady.then(() => {
      ready = true;
    });

    await waitForTick(2);
    expect(initialSettled).toBe(false);
    expect(ready).toBe(false);

    gate.resolve();
    await Promise.all([revalidation, initial]);
    await waitForTick(2);

    expect(initialSettled).toBe(true);
    expect(ready).toBe(true);
  });
});
