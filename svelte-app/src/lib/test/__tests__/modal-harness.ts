/**
 * Helper de test composant pour les modales (ModalContainer).
 *
 * Faits mesurés : ModalContainer rend EN PLACE — `{#if isOpen}`, pas de
 * portal ni de `<dialog>` — donc les requêtes DOM se font sur la cible de
 * montage retournée par `mountSvelte` ; Échap est intercepté au niveau
 * `window` (keydown) ; la garde `hasUnsavedChanges` affiche un
 * sous-dialogue de confirmation avec ses propres boutons. Les
 * interactions visent TOUJOURS les boutons réels ou le canal clavier
 * (`pressEscape`), jamais un clic sur document.body : cliquer le backdrop
 * ne ferme pas la modale (`closeOnBackdropClick` n'y est même pas câblé).
 */
import { flushSync, type Component } from "svelte";
import { getByText, mountSvelte } from "../mount-svelte";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";

export interface MountedModal {
  /** Racine du montage — requêtes DOM ici, pas sur document.body. */
  target: HTMLElement;
  /** La boîte de dialogue rendue (`[role="dialog"]`). */
  dialog: HTMLElement;
}

/**
 * Monte `component` ouvert (`isOpen: true`) et vérifie le rendu du
 * `[role="dialog"]`. Le `{#if}` est synchrone : après le flush de
 * `mountSvelte`, l'absence de dialogue est un défaut de montage, pas une
 * question de timing (un contenu async s'attend via `waitForCondition`).
 */
export function openModal(
  component: Component<any, any, any>,
  props: Record<string, unknown> = {},
): MountedModal {
  const target = mountSvelte(component, { isOpen: true, ...props });
  const dialog = modalDialog(target);
  if (!dialog) {
    throw new Error(
      "La modale ne s'est pas rendue : aucun [role=dialog] sous la cible",
    );
  }
  return { target, dialog };
}

/** Boîte de dialogue courante sous la cible, null si la modale est fermée. */
export function modalDialog(target: HTMLElement): HTMLElement | null {
  return target.querySelector<HTMLElement>('[role="dialog"]');
}

/**
 * Touche Échap sur le canal réel — window keydown, celui qu'écoute
 * ModalContainer — puis flush des effets de rendu.
 */
export function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  flushSync();
}

/**
 * Attend que la modale soit fermée (plus de `[role="dialog"]`) — à
 * appeler après le clic sur le bouton de fermeture du contenu ou après
 * `confirmModalClose` : la disparition passe par la réactivité parente
 * (isOpen), pas par le clic lui-même.
 */
export async function expectModalClosed(
  target: HTMLElement,
  description = "la modale se ferme",
): Promise<void> {
  await waitForCondition(
    () => modalDialog(target) === null,
    description,
    100,
    flushSync,
  );
}

/** Boutons du sous-dialogue de garde (`hasUnsavedChanges`). */
const CONFIRM_CLOSE_LABEL = "Fermer sans sauvegarder";

/**
 * Confirme la fermeture sans sauvegarder : clique le bouton dédié du
 * sous-dialogue (libellé propre à ModalContainer, jamais en collision
 * avec le contenu).
 */
export function confirmModalClose(target: HTMLElement): void {
  getByText(target, "button", CONFIRM_CLOSE_LABEL).click();
  flushSync();
}

/**
 * Annule la garde de fermeture : le bouton « Annuler » du sous-dialogue,
 * scopé à son `.modal-action` pour ne pas confondre avec un « Annuler »
 * du contenu de la modale.
 */
export function cancelModalClose(target: HTMLElement): void {
  const confirmBtn = getByText(target, "button", CONFIRM_CLOSE_LABEL);
  const cancel = confirmBtn.closest(".modal-action")?.querySelector("button");
  if (!cancel) {
    throw new Error("Bouton Annuler du sous-dialogue introuvable");
  }
  cancel.click();
  flushSync();
}
