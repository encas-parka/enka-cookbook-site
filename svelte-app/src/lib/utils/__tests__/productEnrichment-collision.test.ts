/**
 * productEnrichment — collisions d'id dérivé (deux refs → même nom → même id).
 *
 * L'id d'un besoin calculé est dérivé du slug du nom (20 car.) + suffixe
 * event. Deux ingrédients de refs distinctes portant le même nom produisent
 * deux EnrichedProduct au même id : sans dédup, le bulkPut Dexie (clé
 * primaire `id`) écrase silencieusement le premier besoin par le second.
 * La dédup fusionne les agrégations (byDate, totaux, assiettes) et pose un
 * tag `sourceProductName` sur les recettes absorbées (sources seules — les
 * recettes de la cible gardent leur occurrence d'origine).
 *
 * NB : le spy console.warn est posé UNE fois en beforeEach (re-spier une
 * méthode déjà spyée partage l'historique sous vitest 4) et l'historique
 * est vidé entre tests.
 */

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    getRecipesByUuidsBulk: vi.fn(async (uuids: string[]) => {
      const { recipesByUuid } = (globalThis as any).__collisionFixtures;
      return new Map(
        [...uuids].flatMap((u) => {
          const r = recipesByUuid.get(u);
          return r ? [[u, r] as const] : [];
        }),
      );
    }),
    getRecipeByUuid: vi.fn(async () => null),
  },
}));

vi.mock("$lib/services/toast.service.svelte", () => ({
  toastService: { track: vi.fn() },
}));

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createEnrichedProductsFromEvent } from "../productEnrichment";
import type { EnrichedEvent } from "$lib/types/events";
import type { RecipeForDisplay, RecipeIngredient } from "$lib/types/recipes.types";

const MAIN_ID = "t12event00000001";
const DATE = "2026-12-19";

/** Ingrédient minimal valide (shape RecipeIngredient). */
function makeIngredient(
  overrides: Partial<RecipeIngredient> & Pick<RecipeIngredient, "ref" | "name">,
): RecipeIngredient {
  return {
    originalQuantity: 500,
    originalUnit: "gr.",
    normalizedQuantity: 500,
    normalizedUnit: "gr.",
    comment: "",
    allergens: [],
    type: "sec",
    ...overrides,
  };
}

/** Recette minimale (shape RecipeForDisplay utilisée par processMeal). */
function makeRecipe(
  uuid: string,
  title: string,
  ingredients: RecipeIngredient[],
  plate = 4,
): RecipeForDisplay {
  return {
    id: uuid,
    created: "2026-01-01 00:00:00.000Z",
    updated: "2026-01-01 00:00:00.000Z",
    title,
    typeR: "plat",
    plate,
    ingredients,
    astuces: [],
  } as unknown as RecipeForDisplay;
}

function makeEvent(recipeUuids: string[]): EnrichedEvent {
  return {
    id: MAIN_ID,
    created: "2026-01-01 00:00:00.000Z",
    updated: "2026-01-01 00:00:00.000Z",
    name: "T12 collision event",
    meals: [
      {
        date: DATE,
        guests: 4,
        recipes: recipeUuids.map((recipeUuid) => ({
          recipeUuid,
          plates: 4,
          typeR: "plat" as const,
        })),
      },
    ],
  } as unknown as EnrichedEvent;
}

describe("createEnrichedProductsFromEvent — collision d'id dérivé", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as any).__collisionFixtures = { recipesByUuid: new Map() };
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSpy.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("fusionne deux refs homonymes en un seul produit (pas d'écrasement de besoin)", async () => {
    const recipesByUuid = new Map<string, RecipeForDisplay>([
      [
        "recA",
        makeRecipe("recA", "Tarte au citron", [
          makeIngredient({ ref: "ref-hugo-a", name: "Jus de citron", normalizedQuantity: 200 }),
        ]),
      ],
      [
        "recB",
        makeRecipe("recB", "Limonade", [
          makeIngredient({ ref: "ref-aw-b", name: "Jus de citron", normalizedQuantity: 300 }),
        ]),
      ],
    ]);
    (globalThis as any).__collisionFixtures = { recipesByUuid };

    const products = await createEnrichedProductsFromEvent(
      makeEvent(["recA", "recB"]),
      async () => null,
      MAIN_ID,
    );

    // Un seul produit (au lieu de deux au même id)
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe(`jus-de-citron_${MAIN_ID.slice(-10)}`);

    // Les deux agrégations sont absorbées : 2 occurrences de recette,
    // assiettes sommées, quantités additionnées (200 + 300 gr.)
    expect(products[0].byDate[DATE].recipes).toHaveLength(2);
    expect(products[0].byDate[DATE].totalAssiettes).toBe(8);
    expect(products[0].totalNeededArray).toEqual([{ q: 500, u: "gr." }]);

    // Traçabilité : seules les recettes de la SOURCE absorbée portent le tag
    const tagged = products[0].byDate[DATE].recipes.filter(
      (r) => r.sourceProductName != null,
    );
    expect(tagged).toHaveLength(1);
    expect(tagged[0].r).toBe("Limonade");
    expect(tagged[0].sourceProductName).toBe("Jus de citron");

    const warns = warnSpy.mock.calls.map((args) => String(args[0]));
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain(
      `Collision id "jus-de-citron_${MAIN_ID.slice(-10)}"`,
    );
  });

  it("ne logge pas de collision quand deux recettes partagent le même ref (agrégation normale)", async () => {
    const recipesByUuid = new Map<string, RecipeForDisplay>([
      [
        "recA",
        makeRecipe("recA", "Tarte au citron", [
          makeIngredient({ ref: "ref-commun", name: "Jus de citron", normalizedQuantity: 200 }),
        ]),
      ],
      [
        "recB",
        makeRecipe("recB", "Limonade", [
          makeIngredient({ ref: "ref-commun", name: "Jus de citron", normalizedQuantity: 300 }),
        ]),
      ],
    ]);
    (globalThis as any).__collisionFixtures = { recipesByUuid };

    const products = await createEnrichedProductsFromEvent(
      makeEvent(["recA", "recB"]),
      async () => null,
      MAIN_ID,
    );

    expect(products).toHaveLength(1);
    expect(products[0].totalNeededArray).toEqual([{ q: 500, u: "gr." }]);
    expect(warnSpy.mock.calls).toHaveLength(0);
  });

  it("fusionne aussi les produits d'ingrédients dont le slug de 20 car. converge", async () => {
    // Noms distincts mais même préfixe slugifié de 20 caractères :
    // "Beurre de cacahuètes (salé)" et "Beurre de cacahuètes" → "beurre-de-cacahuetes"
    const recipesByUuid = new Map<string, RecipeForDisplay>([
      [
        "recA",
        makeRecipe("recA", "Sandwich", [
          makeIngredient({ ref: "ref-sale", name: "Beurre de cacahuètes (salé)", normalizedQuantity: 100 }),
        ]),
      ],
      [
        "recB",
        makeRecipe("recB", "Dessert", [
          makeIngredient({ ref: "ref-sucre", name: "Beurre de cacahuètes", normalizedQuantity: 50 }),
        ]),
      ],
    ]);
    (globalThis as any).__collisionFixtures = { recipesByUuid };

    const products = await createEnrichedProductsFromEvent(
      makeEvent(["recA", "recB"]),
      async () => null,
      MAIN_ID,
    );

    // Parité sœur : la collision de préfixe est fusionnée (limite connue du
    // slug 20 car. — la révision de la limite est hors périmètre du port).
    expect(products).toHaveLength(1);
  });
});
