/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielAllocationForm — le formulaire d'apport d'une allocation
 * (ADR 0004). Il ne connaît ni le besoin ni le store : il valide la
 * quantité et la source (qui/où toujours requis — une allocation est
 * toujours à vérifier ou confirmée) et remonte le payload.
 *
 * Comportement épinglé : dépasser la quantité à trouver est un simple
 * avertissement affiché, PAS une erreur bloquante — plusieurs apports
 * peuvent excéder le besoin (surenchère volontaire), le composant
 * n'arbitre pas.
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import EventMaterielAllocationForm from "../EventMaterielAllocationForm.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
} from "$lib/test/mount-svelte";

function quantityInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="number"]');
  if (!input) throw new Error("Champ quantité introuvable");
  return input;
}

function whoInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder="Personne responsable"]',
  );
  if (!input) throw new Error("Champ qui introuvable");
  return input;
}

function statusSelect(target: HTMLElement): HTMLSelectElement {
  const select = [...target.querySelectorAll("select")].find((s) =>
    s.textContent?.includes("À vérifier"),
  );
  if (!select) throw new Error("Select statut introuvable");
  return select;
}

function mountAllocationForm(props: Partial<Record<string, unknown>> = {}): {
  target: HTMLElement;
  onSubmit: ReturnType<typeof vi.fn>;
} {
  const onSubmit = vi.fn(async () => {});
  const target = mountSvelte(EventMaterielAllocationForm, {
    maxQuantity: 5,
    headerName: "Tables pliantes",
    headerType: "other",
    onSubmit,
    onCancel: () => {},
    ...props,
  });
  return { target, onSubmit };
}

describe("EventMaterielAllocationForm — validation et payload", () => {
  afterEach(() => cleanupSvelte());

  /**
   * Canal composant : dispatch direct du submit. Mesuré en jsdom 30 :
   * `requestSubmit` applique les contraintes HTML (`min="1"` bloquerait
   * la quantité 0 avant le handler) — la validation du composant est le
   * second rideau, testé par ce canal.
   */
  function submitJs(target: HTMLElement): void {
    target
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    flushSync();
  }

  it("état initial : quantité 1, statut « à vérifier », besoin total affiché", () => {
    const { target } = mountAllocationForm();
    expect(quantityInput(target).value).toBe("1");
    expect(statusSelect(target).value).toBe("to_check");
    expect(target.textContent).toContain("besoin total: 5");
  });

  it("submit sans source : bloqué avec le toast « qui apporte ou d'où il vient »", async () => {
    const { target, onSubmit } = mountAllocationForm();
    target.querySelector("form")!.requestSubmit();
    flushSync();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastStub.error).toHaveBeenCalledWith(
      "Indiquez qui apporte le matériel ou d'où il vient.",
    );
  });

  it("avec qui : le payload remonte (source trimmée, notes vides → undefined)", async () => {
    const { target, onSubmit } = mountAllocationForm();
    setInputValue(whoInput(target), " Jean ");
    target.querySelector("form")!.requestSubmit();
    flushSync();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      quantity: 1,
      status: "to_check",
      who: "Jean",
      where: "",
      notes: undefined,
    });
  });

  it("quantité 0 invalide : « La quantité doit être ≥ 1. »", async () => {
    const { target, onSubmit } = mountAllocationForm();
    setInputValue(quantityInput(target), "0");
    setInputValue(whoInput(target), "Jean");
    submitJs(target);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastStub.error).toHaveBeenCalledWith("La quantité doit être ≥ 1.");
  });

  it("dépasser le besoin total est un avertissement affiché, pas une garde — le submit passe", async () => {
    const { target, onSubmit } = mountAllocationForm();
    setInputValue(quantityInput(target), "6");
    setInputValue(whoInput(target), "Jean");

    // L'avertissement est visible dans le rendu
    expect(target.textContent).toContain("Dépasse la quantité à trouver (5)");

    target.querySelector("form")!.requestSubmit();
    flushSync();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].quantity).toBe(6);
  });

  it("presetStatus positionne le statut initial (ouverture par le badge « Ok »)", () => {
    const { target } = mountAllocationForm({ presetStatus: "confirmed" });
    expect(statusSelect(target).value).toBe("confirmed");
    expect(statusSelect(target).selectedOptions[0].textContent).toBe("Ok");
  });
});
