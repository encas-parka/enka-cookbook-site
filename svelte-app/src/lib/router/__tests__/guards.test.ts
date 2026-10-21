/**
 * @vitest-environment jsdom
 */

/**
 * Guards de route — redirection visiteur avec feedback (toast) et résolution
 * du guard AVANT tout accès au cache.
 *
 * Cause racine (checklist click-through §2) :
 *  - `eventGuard` ne vérifiait pas l'auth : `loadCache` rejetait « Utilisateur
 *    non connecté » dans `beforeLoad` → sv-router quitte sans changer l'arbre
 *    de composants → page vide (headerbar seul), sans toast ni redirect ;
 *  - `authGuard` redirigeait sans aucun feedback ;
 *  - pire : sur 5 routes (`/recipe/:uuid/edit`, `/recipe/:uuid/duplicate`,
 *    `/createdocument/:teamId/new`, `/editdocument/:teamId/:docId`,
 *    `/documents/:teamId`), le guard était attaché à la *fonction composant*
 *    (`(component as any).hooks`) — forme que `matchRoute` de sv-router ne lit
 *    jamais (il ne lit `hooks` que sur les objets de route) : la route montait
 *    sans guard, et les checks auth en page (toast + navigate dans `$effect`)
 *    bouclaient jusqu'au crash `effect_update_depth_exceeded`.
 *
 * Seam : vrais guards + vrai arbre `routes.ts` + vrais stores singletons ;
 * transport PB factice (FakePocketBase), pb-auth mocké (identité pilotable),
 * `$lib/router` mocké (sentinelle de Navigation), toast espionné.
 *
 * Contrats épinglés :
 *  - visiteur sur route auth-requise : toast + `throw navigate("/", { replace: true })`,
 *    et le cache n'est pas touché (aucun fetch avant résolution du guard) ;
 *  - authentifié : le guard passe et initialise le cache normalement ;
 *  - l'arbre des routes porte le guard attendu sur chaque route auth-requise —
 *    et aucune route n'utilise le pattern « hooks attaché à la fonction »
 *    (silencieusement mort).
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

// Sentinelle renvoyée par le navigate mocké : ce que le guard doit throw.
const NAV_SENTINEL = vi.hoisted(() => ({ __navigation: true }));
const navigateMock = vi.hoisted(() => vi.fn(() => NAV_SENTINEL));

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
  onAuthChange: authMock.onAuthChange,
  logout: authMock.logout,
}));

vi.mock("$lib/db-sync/pb-realtime", () => ({
  initRealtimeSignals: vi.fn(async () => {}),
  teardownRealtimeSignals: vi.fn(async () => {}),
  onRealtimeReconnect: vi.fn(() => () => {}),
}));

vi.mock("$lib/router", () => ({
  route: { pathname: "/", params: {}, search: {} },
  navigate: navigateMock,
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("../../stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { currentFakePb } from "../../stores/__tests__/harness/stub-pb";
import { waitForTick } from "../../stores/__tests__/harness/wait-for-tick";
import { authGuard, eventGuard } from "$lib/router/guards";
import { routes } from "$lib/router/routes";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { toastService } from "$lib/services/toast.service.svelte";
import { db } from "$lib/db-sync/pb-sync";

/** Contexte HooksContext minimal pour beforeLoad. */
function hooksContext(pathname: string) {
  return { pathname, meta: {}, search: {} } as Parameters<
    NonNullable<typeof authGuard.beforeLoad>
  >[0];
}

/** Le guard doit rediriger le visiteur : throw sentinelle + modale ouverte. */
async function expectVisitorRedirect(
  guard: typeof authGuard,
  pathname: string,
) {
  const toastSpy = vi.spyOn(toastService, "error");
  await expect(guard.beforeLoad!(hooksContext(pathname))).rejects.toBe(
    NAV_SENTINEL,
  );
  expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  // La modale de connexion porte le feedback (plus de toast d'erreur muet
  // suivi d'un retour à l'accueil sans explication).
  expect(globalState.authModal.isOpen).toBe(true);
  expect(globalState.authModal.showLogin).toBe(true);
  expect(globalState.authModal.pendingPath).toBe(pathname);
  expect(toastSpy).not.toHaveBeenCalled();
  toastSpy.mockRestore();
}

describe("Guards — visiteur redirigé vers la connexion, cache intact", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    authMock.reset();
    navigateMock.mockClear();
    localStorage.clear();
    globalState.authModal.isOpen = false;
    globalState.authModal.pendingPath = null;
    await Promise.all(db.tables.map((t) => t.clear()));
    await waitForTick(1);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await globalState.logout().catch(() => {});
  });

  it("authGuard, visiteur : modale de connexion + redirect /, cible mémorisée", async () => {
    await expectVisitorRedirect(authGuard, "/dashboard/teams");
  });

  it("eventGuard, visiteur : modale + redirect / sans toucher au cache", async () => {
    const loadCacheSpy = vi.spyOn(eventsStore, "loadCache");
    await expectVisitorRedirect(eventGuard, "/event/wqw07qq9ziy9kpw");
    // Aucun fetch de données protégées avant résolution du guard —
    // l'ancien guard appelait loadCache qui rejetait « Utilisateur non connecté ».
    expect(loadCacheSpy).not.toHaveBeenCalled();
  });

  it("ouvrir la modale depuis la home efface l'intention périmée", async () => {
    await expectVisitorRedirect(authGuard, "/dashboard/teams");

    globalState.openAuthModal();

    expect(globalState.authModal.pendingPath).toBeNull();
    expect(globalState.authModal.isOpen).toBe(true);
  });

  it("authGuard, authentifié : passage sans redirect ni toast", async () => {
    authMock.set(authMock.USER_A);
    await globalState.initializeAuth();

    await expect(
      authGuard.beforeLoad!(hooksContext("/dashboard")),
    ).resolves.toBeUndefined();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("eventGuard, authentifié : loadCache exécuté, store prêt", async () => {
    authMock.set(authMock.USER_A);
    await globalState.initializeAuth();
    const toastSpy = vi.spyOn(toastService, "error");

    await eventGuard.beforeLoad!(hooksContext("/event/wqw07qq9ziy9kpw"));

    expect(eventsStore.isInitialized).toBe(true);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

describe("Routes — chaque route auth-requise porte son guard", () => {
  it("ensemble exact des routes sous authGuard / eventGuard", () => {
    const authPaths: string[] = [];
    const eventPaths: string[] = [];
    for (const [path, node] of Object.entries(routes)) {
      if (typeof node !== "object" || node === null) continue;
      if ((node as { hooks?: unknown }).hooks === authGuard)
        authPaths.push(path);
      if ((node as { hooks?: unknown }).hooks === eventGuard)
        eventPaths.push(path);
    }

    expect(authPaths.sort()).toEqual(
      [
        "/dashboard",
        "/recipe/my",
        "/recipe/new",
        "/recipe/:uuid/edit",
        "/recipe/:uuid/duplicate",
        "/eventList",
        "/createdocument/:teamId/new",
        "/editdocument/:teamId/:docId",
        "/documents/:teamId",
      ].sort(),
    );
    expect(eventPaths).toEqual(["/event/:id"]);
  });

  it("aucun hooks attaché à une fonction composant (pattern silencieusement mort)", () => {
    const dead: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === "function") {
        if (Object.prototype.hasOwnProperty.call(node, "hooks"))
          dead.push(path);
        return;
      }
      if (typeof node !== "object" || node === null) return;
      for (const [key, value] of Object.entries(node)) {
        walk(value, path ? path : key);
      }
    };
    walk(routes, "");
    expect(dead).toEqual([]);
  });
});
