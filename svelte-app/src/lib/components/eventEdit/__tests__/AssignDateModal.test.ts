/**
 * @vitest-environment jsdom
 */

/**
 * AssignDateModal — affecter une recette à un repas daté, ou la mettre de
 * côté (ADR 0004, W).
 *
 * Seam : vraie modale (ModalContainer rend en place quand isOpen) montée en
 * jsdom sur des repas fixtures ; onClose/onAssign sont des espions.
 *
 * Contrats épinglés :
 *  - chaque repas daté affiche son libellé, ses convives et son nombre de
 *    recettes (singulier/pluriel)
 *  - le premier repas est présélectionné ; Déplacer remonte son id et ferme
 *  - allowSetAside : « Mettre de côté » remonte __undated__
 *  - sans repas daté et sans mise de côté : Déplacer reste désactivé
 *  - Annuler ferme sans affecter
 */

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userId: "user0000000001",
    userName: "Test",
    isAuthenticated: true,
    isMobile: false,
  },
}));

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import AssignDateModal from "../AssignDateModal.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";
import type { EventMeal } from "$lib/types/events";

function makeDatedMeal(
  id: string,
  overrides: Partial<EventMeal> = {},
): EventMeal {
  return {
    id,
    date: "2026-10-24T20:00:00",
    guests: 80,
    recipes: [
      { recipeUuid: "recipeA", plates: 80, typeR: "plat" },
      { recipeUuid: "recipeB", plates: 80, typeR: "dessert" },
    ],
    ...overrides,
  };
}

function mountModal(
  datedMeals: EventMeal[],
  extra: { allowSetAside?: boolean } = {},
) {
  const onAssign = vi.fn();
  const onClose = vi.fn();
  const target = mountSvelte(AssignDateModal, {
    isOpen: true,
    onClose,
    onAssign,
    recipeName: "Blanquette de veau",
    datedMeals,
    allowSetAside: extra.allowSetAside ?? false,
  });
  return { target, onAssign, onClose };
}

afterEach(() => cleanupSvelte());

describe("AssignDateModal", () => {
  it("liste les repas datés avec convives et nombre de recettes", () => {
    const { target } = mountModal([
      makeDatedMeal("meal01"),
      makeDatedMeal("meal02", {
        guests: 0,
        recipes: [{ recipeUuid: "recipeA", plates: 100, typeR: "plat" }],
      }),
    ]);

    const text = target.textContent ?? "";
    expect(text).toContain("80 convives");
    expect(text).toContain("2 recettes");
    expect(text).toContain("1 recette");
  });

  it("présélectionne le premier repas ; Déplacer remonte l'id et ferme", () => {
    const { target, onAssign, onClose } = mountModal([
      makeDatedMeal("meal01"),
      makeDatedMeal("meal02"),
    ]);

    const radios = target.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios[0].checked).toBe(true);

    getByText(target, "button", "Déplacer").click();
    flushSync();

    expect(onAssign).toHaveBeenCalledWith("meal01");
    expect(onClose).toHaveBeenCalled();
  });

  it("allowSetAside : « Mettre de côté » remonte __undated__", () => {
    const { target, onAssign } = mountModal([makeDatedMeal("meal01")], {
      allowSetAside: true,
    });

    const setAside = target.querySelector<HTMLInputElement>(
      'input[type="radio"][value="__undated__"]',
    );
    if (!setAside) throw new Error("Option « mettre de côté » introuvable");
    setAside.click();
    flushSync();

    getByText(target, "button", "Déplacer").click();
    flushSync();

    expect(onAssign).toHaveBeenCalledWith("__undated__");
  });

  it("sans repas daté ni mise de côté : Déplacer désactivé", () => {
    const { target } = mountModal([]);

    expect(
      getByText(target, "button", "Déplacer").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("Annuler ferme sans affecter", () => {
    const { target, onAssign, onClose } = mountModal([makeDatedMeal("meal01")]);

    getByText(target, "button", "Annuler").click();
    flushSync();

    expect(onAssign).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
