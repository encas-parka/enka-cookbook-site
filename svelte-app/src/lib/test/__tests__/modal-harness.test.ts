/**
 * @vitest-environment jsdom
 */

/**
 * Test de fumée du harness de tests composants (ADR 0004, lot 0) :
 * prouve que le stub partagé toastService se branche par un simple
 * `vi.mock` et que le helper modale couvre ouverture, fermeture par
 * bouton, Échap et la garde hasUnsavedChanges — sur un composant
 * factice, pas sur un composant applicatif.
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: { isMobile: false },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import {
  openModal,
  modalDialog,
  pressEscape,
  expectModalClosed,
  confirmModalClose,
  cancelModalClose,
} from "./modal-harness";
import { cleanupSvelte } from "$lib/test/mount-svelte";
import SmokeModal from "./SmokeModal.svelte";

beforeEach(() => toastStub.reset());

afterEach(() => cleanupSvelte());

describe("stub toastService partagé", () => {
  it("capte les appels du composant sans toucher le vrai service", async () => {
    const { target } = openModal(SmokeModal, {});
    expect(toastStub.success).not.toHaveBeenCalled();

    target.querySelector<HTMLButtonElement>("button")!.click();
    flushSync();

    expect(toastStub.success).toHaveBeenCalledTimes(1);
    expect(toastStub.success).toHaveBeenCalledWith("Action réussie");
  });

  it("track est transparent : la promesse traversée garde sa valeur et son rejet", async () => {
    await expect(
      toastStub.track(Promise.resolve("ok"), { loading: "…" }),
    ).resolves.toBe("ok");
    await expect(
      toastStub.track(Promise.reject(new Error("boom")), { loading: "…" }),
    ).rejects.toThrow("boom");
  });
});

describe("helper modale", () => {
  it("ouvre, ferme par le bouton du contenu et attend la disparition", async () => {
    const onClose = vi.fn();
    const { target, dialog } = openModal(SmokeModal, { onClose });
    expect(dialog.textContent).toContain("Fermer");

    Array.from(target.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Fermer")!
      .click();
    await expectModalClosed(target, "la fermeture par bouton vide le dialogue");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Échap ferme via le canal window que ModalContainer écoute", async () => {
    const onClose = vi.fn();
    const { target } = openModal(SmokeModal, { onClose });

    pressEscape();
    await expectModalClosed(target, "la fermeture par Échap");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("la garde hasUnsavedChanges intercepte Échap via le sous-dialogue, pas un confirm natif", async () => {
    const onClose = vi.fn();
    const { target } = openModal(SmokeModal, {
      onClose,
      hasUnsavedChanges: true,
    });

    // Canal réel de la garde : handleClose interne de ModalContainer (Échap)
    pressEscape();
    // La garde retient la fermeture : le dialogue reste rendu
    expect(modalDialog(target)).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    cancelModalClose(target);
    expect(modalDialog(target)).not.toBeNull();

    pressEscape();
    confirmModalClose(target);
    await expectModalClosed(target, "la fermeture confirmée vide le dialogue");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
