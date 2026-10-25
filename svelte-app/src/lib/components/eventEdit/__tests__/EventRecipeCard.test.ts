/**
 * @vitest-environment jsdom
 */

/**
 * EventRecipeCard — la fiche d'une recette dans le contexte d'un repas
 * d'événement (ADR 0004, D).
 *
 * Seam : vrai composant monté en jsdom sur une fixture de recette minimale
 * (les enfants ingrédients/préparation sont de purs affichages) ; les
 * overrides du repas (`meal`, `mealRecipe`) portent le contexte événement.
 *
 * Contrats épinglés :
 *  - le type affiché est celui du repas quand il existe, sinon celui de la recette
 *  - les couverts sont ceux du repas, à défaut les parts de la recette
 *    (singulier « 1 couvert »)
 *  - la date et le moment du repas s'affichent quand le repas en porte
 *  - les badges servir chaud/froid et avec/sans cuisson suivent la recette
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
import EventRecipeCard from "../EventRecipeCard.svelte";
import { mountSvelte, cleanupSvelte } from "$lib/test/mount-svelte";
import type { RecipeForDisplay } from "$lib/types/recipes.types";
import type { EventMeal } from "$lib/types/events";
import {
  extractDate,
  formatDateWdDayMonthShort,
} from "$lib/utils/date-helpers";

function makeRecipe(overrides: Record<string, unknown> = {}): RecipeForDisplay {
  return {
    id: "recipe0000000001",
    title: "Blanquette de veau",
    typeR: "plat",
    categories: [],
    regime: null,
    serveHot: true,
    cuisson: true,
    materiel: [],
    quantite_desc: null,
    plate: 100,
    ingredients: [],
    preparation: "Étape unique.",
    preparation24h: null,
    astuces: [],
    ...overrides,
  } as unknown as RecipeForDisplay;
}

function makeMeal(overrides: Partial<EventMeal> = {}): EventMeal {
  return {
    id: "meal0000000001",
    date: "2026-10-24T20:00:00",
    guests: 80,
    recipes: [],
    ...overrides,
  };
}

function mountCard(props: Record<string, unknown> = {}) {
  return mountSvelte(EventRecipeCard, {
    recipe: makeRecipe(),
    totalGuests: 80,
    ...props,
  });
}

afterEach(() => cleanupSvelte());

describe("EventRecipeCard", () => {
  it("le type du repas prime sur le type de la recette", () => {
    const target = mountCard({
      recipe: makeRecipe({ typeR: "dessert" }),
      mealRecipe: {
        recipeUuid: "recipe0000000001",
        plates: 80,
        typeR: "entree",
      },
    });

    expect(target.textContent).toContain("Entrée");
    expect(target.textContent).not.toContain("Dessert");
  });

  it("sans override de repas : le type de la recette s'affiche", () => {
    const target = mountCard({ recipe: makeRecipe({ typeR: "dessert" }) });

    expect(target.textContent).toContain("Dessert");
  });

  it("les couverts viennent du repas quand il en porte", () => {
    const target = mountCard({
      meal: makeMeal(),
      mealRecipe: { recipeUuid: "recipe0000000001", plates: 80, typeR: "plat" },
    });

    expect(target.textContent).toContain("80 couverts");
  });

  it("à défaut, les parts de la recette servent de couverts", () => {
    const target = mountCard({ recipe: makeRecipe({ plate: 100 }) });

    expect(target.textContent).toContain("100 couverts");
  });

  it("un seul couvert s'écrit au singulier", () => {
    const target = mountCard({
      mealRecipe: { recipeUuid: "recipe0000000001", plates: 1, typeR: "plat" },
    });

    expect(target.textContent).toContain("1 couvert");
    expect(target.textContent).not.toContain("1 couverts");
  });

  it("la date et le moment du repas s'affichent", () => {
    const date = "2026-10-24T20:00:00";
    const target = mountCard({ meal: makeMeal({ date }) });

    expect(target.textContent).toContain(
      formatDateWdDayMonthShort(extractDate(date)),
    );
    expect(target.textContent).toContain("Soir");
  });

  it("sans repas daté : aucune date affichée", () => {
    const target = mountCard({ meal: makeMeal({ date: "" }) });

    expect(target.textContent).not.toContain("Soir");
  });

  it("les badges servir et cuisson suivent la recette", () => {
    const target = mountCard({
      recipe: makeRecipe({ serveHot: false, cuisson: false }),
    });

    expect(target.textContent).toContain("Servir Froid");
    expect(target.textContent).toContain("Sans Cuisson");
    expect(target.textContent).not.toContain("Servir Chaud");
  });
});
