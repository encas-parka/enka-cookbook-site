/**
 * @vitest-environment jsdom
 */

/**
 * RecipeSearchCard — recherche et sélection d'une recette à ajouter (ADR 0004, D).
 *
 * Seam : vrai composant monté en jsdom ; le catalogue (`recipesStore`) est
 * remplacé par deux listes pilotées par le test (`searchRecipes` /
 * `getAllRecipes`), l'index n'est pas en jeu ici.
 *
 * Contrats épinglés :
 *  - moins de 2 caractères : aucune liste proposée
 *  - 2 caractères et plus : les résultats de recherche s'affichent
 *  - clic sur un résultat : onSelect(recette, type, parts) puis reset du champ
 *  - chevron : la liste complète s'ouvre sans saisie
 *  - Entrée sur un champ vide : onEmptySubmit (canal clavier)
 *  - disabled : champ verrouillé
 */

const h = vi.hoisted(() => ({
  search: [] as unknown[],
  all: [] as unknown[],
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    searchRecipes: () => h.search,
    getAllRecipes: () => h.all,
    getRecipeIndexByUuid: () => null,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import RecipeSearchCard from "../RecipeSearchCard.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
} from "$lib/test/mount-svelte";
import { makeRecipeIndexEntry } from "$lib/stores/__tests__/harness/fixtures";

function searchInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[role="combobox"]',
  );
  if (!input) throw new Error("Champ de recherche introuvable");
  return input;
}

function options(target: HTMLElement): NodeListOf<HTMLElement> {
  return target.querySelectorAll<HTMLElement>('[role="option"]');
}

function mountCard(extra: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const onEmptySubmit = vi.fn();
  const target = mountSvelte(RecipeSearchCard, {
    onSelect,
    defaultPlates: 100,
    onEmptySubmit,
    ...extra,
  });
  return { target, onSelect, onEmptySubmit };
}

beforeEach(() => {
  h.search = [];
  h.all = [];
});
afterEach(() => cleanupSvelte());

describe("RecipeSearchCard — recherche", () => {
  it("moins de 2 caractères : aucune liste proposée", () => {
    const { target } = mountCard();

    setInputValue(searchInput(target), "t");

    expect(options(target)).toHaveLength(0);
  });

  it("2 caractères et plus : les résultats de recherche s'affichent", () => {
    h.search = [makeRecipeIndexEntry({ title: "Tarte aux pommes" })];
    const { target } = mountCard();

    setInputValue(searchInput(target), "ta");

    expect(options(target)).toHaveLength(1);
    expect(options(target)[0].textContent).toContain("Tarte aux pommes");
  });

  it("clic sur un résultat : onSelect(recette, type, parts) puis reset du champ", () => {
    h.search = [
      makeRecipeIndexEntry({ title: "Tarte aux pommes", typeR: "dessert" }),
    ];
    const { target, onSelect } = mountCard();

    setInputValue(searchInput(target), "ta");
    options(target)[0].click();
    flushSync();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tarte aux pommes" }),
      "dessert",
      100,
    );
    expect(searchInput(target).value).toBe("");
    expect(options(target)).toHaveLength(0);
  });

  it("chevron : la liste complète s'ouvre sans saisie", () => {
    h.all = [
      makeRecipeIndexEntry({ id: "recipeA", title: "Soupe" }),
      makeRecipeIndexEntry({ id: "recipeB", title: "Tarte" }),
    ];
    const { target } = mountCard();

    const toggle = target.querySelector<HTMLButtonElement>(
      'button[aria-label="Ouvrir le menu"]',
    );
    if (!toggle) throw new Error("Chevron d'ouverture introuvable");
    toggle.click();
    flushSync();

    expect(options(target)).toHaveLength(2);
  });

  it("Entrée sur un champ vide : onEmptySubmit", () => {
    const { target, onEmptySubmit } = mountCard();

    searchInput(target).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(onEmptySubmit).toHaveBeenCalledTimes(1);
  });

  it("disabled : champ de recherche verrouillé", () => {
    const { target } = mountCard({ disabled: true });

    expect(searchInput(target).disabled).toBe(true);
  });
});
