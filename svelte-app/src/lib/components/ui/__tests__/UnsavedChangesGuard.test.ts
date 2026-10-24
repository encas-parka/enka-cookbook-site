/**
 * @vitest-environment jsdom
 */

/**
 * UnsavedChangesGuard — garde de navigation (pattern sv-router).
 *
 * Contrat handler (ADR 0004, checklist §11b au niveau handler) :
 *  - au montage, `blockNavigation` est appelé une fois avec le guard ;
 *  - `shouldProtect` false → navigation autorisée, jamais de confirm ;
 *  - protégé + confirm refusé → navigation bloquée, pas de cleanup ;
 *  - protégé + confirm accepté → `onLeaveWithoutSave` exécuté puis
 *    navigation autorisée ;
 *  - le message (défaut ou prop) est transmis au confirm natif ;
 *  - au démontage, le blocker est libéré (pas de closure fantôme).
 *
 * Seam : vrai composant monté en jsdom ; `$lib/router` mocké au niveau
 * module (le guard enregistré est capturé et invoqué par le test) ;
 * `window.confirm` espionné — convention § Canons.
 */

const routerMock = vi.hoisted(() => {
  const state: { guard: (() => boolean) | null } = { guard: null };
  const unblock = vi.fn();
  const blockNavigation = vi.fn((fn: () => boolean) => {
    state.guard = fn;
    return unblock;
  });
  return { state, unblock, blockNavigation };
});

vi.mock("$lib/router", () => ({ blockNavigation: routerMock.blockNavigation }));

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import UnsavedChangesGuard from "../UnsavedChangesGuard.svelte";
import { mountSvelte, cleanupSvelte } from "$lib/test/mount-svelte";

const DEFAULT_MESSAGE =
  "Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?";

let confirmSpy: ReturnType<typeof vi.spyOn>;

function mountGuard(props: Record<string, unknown> = {}) {
  const effective = {
    routeKey: "route-test",
    shouldProtect: vi.fn(() => true),
    onLeaveWithoutSave: vi.fn(),
    ...props,
  };
  mountSvelte(UnsavedChangesGuard, effective);
  return {
    shouldProtect: effective.shouldProtect as ReturnType<typeof vi.fn>,
    onLeaveWithoutSave: effective.onLeaveWithoutSave as ReturnType<
      typeof vi.fn
    >,
  };
}

beforeEach(() => {
  routerMock.state.guard = null;
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
});

afterEach(() => {
  cleanupSvelte();
  confirmSpy.mockRestore();
});

describe("UnsavedChangesGuard — contrat handler", () => {
  it("enregistre le guard auprès de blockNavigation au montage", () => {
    mountGuard();
    expect(routerMock.blockNavigation).toHaveBeenCalledTimes(1);
    expect(routerMock.state.guard).toBeTypeOf("function");
  });

  it("non protégé : navigation autorisée sans confirm", () => {
    const shouldProtect = vi.fn(() => false);
    const { onLeaveWithoutSave } = mountGuard({ shouldProtect });
    const allowed = routerMock.state.guard!();
    expect(allowed).toBe(true);
    expect(shouldProtect).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onLeaveWithoutSave).not.toHaveBeenCalled();
  });

  it("protégé + confirm refusé : navigation bloquée, pas de cleanup", () => {
    const { onLeaveWithoutSave } = mountGuard();
    confirmSpy.mockReturnValue(false);

    const allowed = routerMock.state.guard!();
    expect(allowed).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith(DEFAULT_MESSAGE);
    expect(onLeaveWithoutSave).not.toHaveBeenCalled();
  });

  it("protégé + confirm accepté : cleanup exécuté puis navigation autorisée", () => {
    const { onLeaveWithoutSave } = mountGuard();
    confirmSpy.mockReturnValue(true);

    const allowed = routerMock.state.guard!();
    expect(allowed).toBe(true);
    expect(onLeaveWithoutSave).toHaveBeenCalledTimes(1);
  });

  it("sans onLeaveWithoutSave, un confirm accepté autorise quand même", () => {
    mountGuard({ onLeaveWithoutSave: undefined });
    confirmSpy.mockReturnValue(true);

    expect(routerMock.state.guard!()).toBe(true);
  });

  it("le message personnalisé est transmis au confirm natif", () => {
    mountGuard({ message: "Brouillon en cours, quitter ?" });
    routerMock.state.guard!();
    expect(confirmSpy).toHaveBeenCalledWith("Brouillon en cours, quitter ?");
  });

  it("le démontage libère le blocker (pas de closure fantôme)", () => {
    mountGuard();
    expect(routerMock.unblock).not.toHaveBeenCalled();

    cleanupSvelte();
    expect(routerMock.unblock).toHaveBeenCalledTimes(1);
  });
});
