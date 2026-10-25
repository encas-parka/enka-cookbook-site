/**
 * @vitest-environment jsdom
 */

/**
 * EventMealCard — édition d'un repas d'événement (ADR 0004, W/V + D).
 *
 * Seam : vrai composant monté en jsdom sur un `meal` fixture ; seul
 * `recipesStore.getRecipeIndexByUuid` est remplacé (Map pilotée par le
 * test) — le catalogue de recettes est hors contrat ici. Les deux effets
 * d'écriture du composant (tri par type, synchro des parts) mutent le
 * `$bindable meal` : les assertions passent par le proxy `holder`, jamais
 * par l'objet brut (fait mesuré lot 1).
 *
 * Contrats épinglés :
 *  - un repas sans couverts prend `defaultGuests`
 *  - l'effet de tri maintient meal.recipes dans l'ordre entrée → plat →
 *    dessert → autre
 *  - l'effet de synchro aligne recipe.plates sur meal.guests, sauf parts
 *    propres (`hasOwnPlatesNb`) — parts individuelles persistées
 *  - date déjà utilisée : avertissement en édition
 *  - recette absente de l'index : « (Recette introuvable) »
 *  - Éditer / valider basculent isEditing (Éditer remonte onEditToggle)
 *  - retrait d'une recette ; édition puis reset des couverts d'une recette
 *  - suppression : confirmation si le repas porte des recettes, directe sinon
 */

const h = vi.hoisted(() => ({
  index: new Map<string, Record<string, unknown>>(),
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    getRecipeIndexByUuid: (uuid: string) => h.index.get(uuid) ?? null,
    searchRecipes: () => [],
    getAllRecipes: () => [],
  },
}));

// ModalContainer (ConfirmModal) lit globalState.isMobile
vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userId: "user0000000001",
    userName: "Test",
    isAuthenticated: true,
    isMobile: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import EventMealCard from "../EventMealCard.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  setInputValue,
} from "$lib/test/mount-svelte";
import type { EventMeal, EventMealRecipe } from "$lib/types/events.d";
import type { RecipesTypeROptions } from "$lib/types/recipes.types";

function makeMeal(overrides: Partial<EventMeal> = {}): EventMeal {
  return {
    id: "meal0000000001",
    date: "2026-10-24T20:00:00",
    guests: 100,
    recipes: [],
    ...overrides,
  };
}

function makeMealRecipe(
  overrides: Partial<EventMealRecipe> = {},
): EventMealRecipe {
  return {
    recipeUuid: "recipe0000000001",
    plates: 100,
    typeR: "plat",
    hasOwnPlatesNb: false,
    ...overrides,
  };
}

function registerRecipe(
  uuid: string,
  title: string,
  typeR: RecipesTypeROptions = "plat",
) {
  h.index.set(uuid, { id: uuid, title, typeR });
}

function mountCard(
  meal: EventMeal,
  extra: {
    isEditing?: boolean;
    allDates?: string[];
    onDelete?: () => void;
    onEditToggle?: () => void;
  } = {},
) {
  const onDelete = extra.onDelete ?? vi.fn();
  const onEditToggle = extra.onEditToggle ?? vi.fn();
  const holder = bindableProps({
    meal,
    isEditing: extra.isEditing ?? false,
    onDelete,
    onEditToggle,
    allDates: extra.allDates ?? [],
  });
  const target = mountSvelte(EventMealCard, holder as never);
  return { target, holder, onDelete, onEditToggle };
}

function buttonByTitle(target: HTMLElement, title: string): HTMLButtonElement {
  const button = target.querySelector<HTMLButtonElement>(
    `button[title="${title}"]`,
  );
  if (!button) throw new Error(`Bouton « ${title} » introuvable`);
  return button;
}

beforeEach(() => h.index.clear());
afterEach(() => cleanupSvelte());

describe("EventMealCard — initialisation et état dérivé", () => {
  it("un repas sans couverts prend defaultGuests", () => {
    const { target, holder } = mountCard(makeMeal({ guests: 0 }));

    expect(holder.meal.guests).toBe(100);
    expect(target.textContent).toContain("100 pers.");
  });

  it("l'effet de tri ordonne les recettes par type", () => {
    registerRecipe("recipeD", "Tarte", "dessert");
    registerRecipe("recipeE", "Soupe", "entree");
    const { holder } = mountCard(
      makeMeal({
        recipes: [
          makeMealRecipe({ recipeUuid: "recipeD", typeR: "dessert" }),
          makeMealRecipe({ recipeUuid: "recipeE", typeR: "entree" }),
        ],
      }),
    );

    expect(holder.meal.recipes.map((r) => r.recipeUuid)).toEqual([
      "recipeE",
      "recipeD",
    ]);
  });

  it("l'effet de synchro aligne les parts sur les couverts, sauf parts propres", () => {
    const { holder } = mountCard(
      makeMeal({
        guests: 80,
        recipes: [
          makeMealRecipe({ recipeUuid: "recipeA", plates: 100 }),
          makeMealRecipe({
            recipeUuid: "recipeB",
            plates: 90,
            hasOwnPlatesNb: true,
          }),
        ],
      }),
    );

    expect(holder.meal.recipes[0].plates).toBe(80);
    expect(holder.meal.recipes[1].plates).toBe(90);
  });

  it("preview : chaque recette rend un badge avec son titre et ses parts", () => {
    registerRecipe("recipeA", "Blanquette de veau");
    const { target } = mountCard(
      makeMeal({
        recipes: [
          makeMealRecipe({
            recipeUuid: "recipeA",
            plates: 80,
            hasOwnPlatesNb: true,
          }),
        ],
      }),
    );

    const badge = target.querySelector(".badge");
    expect(badge?.textContent).toContain("Blanquette de veau");
    expect(badge?.textContent).toContain("80");
  });

  it("preview sans recette : « Aucune recette »", () => {
    const { target } = mountCard(makeMeal({ recipes: [] }));

    expect(target.textContent).toContain("Aucune recette");
  });
});

describe("EventMealCard — édition", () => {
  it("date déjà utilisée : avertissement affiché", () => {
    const meal = makeMeal();
    const { target } = mountCard(meal, {
      isEditing: true,
      allDates: [meal.date, meal.date],
    });

    expect(target.textContent).toContain("Cette date/heure est déjà utilisée");
  });

  it("recette absente de l'index : « (Recette introuvable) »", () => {
    const { target } = mountCard(
      makeMeal({
        recipes: [makeMealRecipe({ recipeUuid: "recipeGone" })],
      }),
      { isEditing: true },
    );

    expect(target.textContent).toContain("(Recette introuvable)");
  });

  it("Éditer bascule isEditing et remonte onEditToggle", () => {
    const { target, holder, onEditToggle } = mountCard(makeMeal());

    buttonByTitle(target, "Éditer").click();
    flushSync();

    expect(holder.isEditing).toBe(true);
    expect(onEditToggle).toHaveBeenCalled();
  });

  it("valider quitte l'édition", () => {
    const { target, holder } = mountCard(makeMeal(), { isEditing: true });

    buttonByTitle(target, "Terminer l'édition").click();
    flushSync();

    expect(holder.isEditing).toBe(false);
  });

  it("retirer une recette la sort du repas", () => {
    registerRecipe("recipeA", "Soupe", "entree");
    registerRecipe("recipeB", "Tarte", "dessert");
    const { target, holder } = mountCard(
      makeMeal({
        recipes: [
          makeMealRecipe({ recipeUuid: "recipeA", typeR: "entree" }),
          makeMealRecipe({ recipeUuid: "recipeB", typeR: "dessert" }),
        ],
      }),
      { isEditing: true },
    );

    const removeButtons = target.querySelectorAll<HTMLButtonElement>(
      'button[title="Retirer la recette"]',
    );
    expect(removeButtons).toHaveLength(2);
    removeButtons[0].click();
    flushSync();

    expect(holder.meal.recipes.map((r) => r.recipeUuid)).toEqual(["recipeB"]);
  });

  it("éditer les couverts d'une recette marque ses parts comme propres et écrit la saisie", () => {
    registerRecipe("recipeA", "Blanquette");
    const { target, holder } = mountCard(
      makeMeal({
        guests: 100,
        recipes: [makeMealRecipe({ recipeUuid: "recipeA", plates: 100 })],
      }),
      { isEditing: true },
    );

    buttonByTitle(target, "Éditer les couverts").click();
    flushSync();

    expect(holder.meal.recipes[0].hasOwnPlatesNb).toBe(true);
    const plateInput = target.querySelector<HTMLInputElement>(
      'input[type="number"].text-center',
    );
    if (!plateInput) throw new Error("Saisie des parts introuvable");

    setInputValue(plateInput, "80");
    expect(holder.meal.recipes[0].plates).toBe(80);
  });

  it("revenir au nombre de couverts du repas remet les parts et le drapeau", () => {
    registerRecipe("recipeA", "Blanquette");
    const { target, holder } = mountCard(
      makeMeal({
        guests: 100,
        recipes: [
          makeMealRecipe({
            recipeUuid: "recipeA",
            plates: 80,
            hasOwnPlatesNb: true,
          }),
        ],
      }),
      { isEditing: true },
    );

    buttonByTitle(target, "Éditer les couverts").click();
    flushSync();
    const reset = target.querySelector<HTMLButtonElement>(
      'button[title^="Revenir au nombre de couvert"]',
    );
    if (!reset) throw new Error("Bouton de reset des couverts introuvable");
    reset.click();
    flushSync();

    expect(holder.meal.recipes[0].plates).toBe(100);
    expect(holder.meal.recipes[0].hasOwnPlatesNb).toBe(false);
  });
});

describe("EventMealCard — suppression", () => {
  it("un repas qui porte des recettes demande confirmation", () => {
    registerRecipe("recipeA", "Blanquette");
    const { target, onDelete } = mountCard(
      makeMeal({
        recipes: [makeMealRecipe({ recipeUuid: "recipeA" })],
      }),
      { isEditing: true },
    );

    buttonByTitle(target, "Supprimer").click();
    flushSync();

    expect(target.textContent).toContain("Ce repas contient 1 recette(s)");
    expect(onDelete).not.toHaveBeenCalled();

    getByText(target, "button", "Supprimer").click();
    flushSync();

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("un repas sans recette se supprime directement, sans modale", () => {
    const { target, onDelete } = mountCard(makeMeal({ recipes: [] }), {
      isEditing: true,
    });

    buttonByTitle(target, "Supprimer").click();
    flushSync();

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(target.textContent).not.toContain("Ce repas contient");
  });
});
