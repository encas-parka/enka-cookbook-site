/**
 * @vitest-environment jsdom
 */

/**
 * ConfirmModal — la modale de confirmation Svelte (jamais le confirm
 * natif : les boutons sont pilotables en jsdom, convention § Canons).
 *
 * Contrats de données (ADR 0004) :
 *  - le bouton de confirmation appelle `onConfirm` — et lui seul ;
 *  - « Annuler » et Échap (canal window de ModalContainer) appellent
 *    `onCancel` ;
 *  - le variant pilote les classes d'alerte et du bouton (dérivation
 *    affichée) ; les libellés sont personnalisables.
 *
 * Seam : vrai composant monté ouvert via le helper modale (rendu en
 * place, requêtes DOM sur la cible). GlobalState est mocké au niveau
 * ModalContainer (lecture isMobile).
 */

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: { isMobile: false },
}));

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import ConfirmModal from "../ConfirmModal.svelte";
import { openModal, pressEscape } from "$lib/test/__tests__/modal-harness";
import { cleanupSvelte, getByText, queryByText } from "$lib/test/mount-svelte";

interface Handlers {
  onConfirm: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

function mountConfirmModal(overrides: Record<string, unknown> = {}): {
  target: HTMLElement;
  handlers: Handlers;
} {
  const handlers: Handlers = { onConfirm: vi.fn(), onCancel: vi.fn() };
  const { target } = openModal(ConfirmModal, {
    title: "Supprimer l'achat",
    message: "Cette action est définitive.",
    ...handlers,
    ...overrides,
  });
  return { target, handlers };
}

function button(target: HTMLElement, label: string): HTMLButtonElement {
  return getByText(target, "button", label) as HTMLButtonElement;
}

describe("ConfirmModal — contrat de callbacks", () => {
  afterEach(() => cleanupSvelte());

  it("rend le titre et le message", () => {
    const { target } = mountConfirmModal();
    expect(target.textContent).toContain("Supprimer l'achat");
    expect(target.textContent).toContain("Cette action est définitive.");
  });

  it("Confirmer appelle onConfirm — et lui seul", () => {
    const { target, handlers } = mountConfirmModal();
    button(target, "Confirmer").click();
    flushSync();
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    expect(handlers.onCancel).not.toHaveBeenCalled();
  });

  it("Annuler appelle onCancel", () => {
    const { target, handlers } = mountConfirmModal();
    button(target, "Annuler").click();
    flushSync();
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });

  it("Échap passe par le canal window et appelle onCancel", () => {
    const { handlers } = mountConfirmModal();
    pressEscape();
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });

  it("les libellés sont personnalisables", () => {
    const { target } = mountConfirmModal({
      confirmLabel: "Supprimer",
      cancelLabel: "Garder",
    });
    button(target, "Supprimer").click();
    flushSync();
    expect(queryByText(target, "button", "Confirmer")).toBeNull();
  });

  it("le variant danger pilote les classes dérivées", () => {
    const { target } = mountConfirmModal({ variant: "danger" });
    const alert = target.querySelector(".alert");
    expect(alert?.className).toContain("alert-error");
    expect(button(target, "Confirmer").className).toContain("btn-error");
  });
});
