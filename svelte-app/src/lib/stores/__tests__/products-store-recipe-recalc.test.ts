/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — recalcul des besoins au changement d'ingrédient (D).
 *
 * Le guard de recalcul (#lastMealsHash) porte les timestamps des recettes
 * liées à l'event (getRecipeUpdatedAt, lecture réactive de l'index
 * RecipesStore), pas seulement JSON.stringify(event.meals) : modifier un
 * ingrédient d'une recette → `updated` bouge → hash différent → besoins
 * recalculés et persistés, sans toucher aux repas.
 *
 * Le mock RecipesStore expose une vraie SvelteMap (`__recipeUpdatedIndex`) :
 * c'est elle qui déclenche le re-run de l'effect, comme le bridge liveQuery
 * en production.
 */

vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", async () => {
  const { SvelteMap } = await import("svelte/reactivity");
  const recipeUpdatedIndex = new SvelteMap<string, string>();
  return {
    __recipeUpdatedIndex: recipeUpdatedIndex,
    recipesStore: {
      syncReady: Promise.resolve(),
      getRecipeUpdatedAt: (uuid: string) => recipeUpdatedIndex.get(uuid),
      getRecipesByUuidsBulk: vi.fn(async (uuids: string[]) => {
        const { recipesByUuid } = (globalThis as any).__recalcFixtures;
        return new Map(
          [...uuids].flatMap((u) => {
            const r = recipesByUuid?.get(u);
            return r ? [[u, r] as const] : [];
          }),
        );
      }),
      getRecipeByUuid: vi.fn(async () => null),
    },
  };
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import { makeEvent, TEST_DATE, TEST_EVENT_ID, T0, T1 } from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import {
  recipesStore,
  // Export test-only du mock (cf. vi.mock ci-dessus)
  __recipeUpdatedIndex as recipeUpdatedIndex,
} from "$lib/stores/RecipesStore.svelte";
import { db } from "$lib/db-sync/pb-sync";
import type { RecipeForDisplay, RecipeIngredient } from "$lib/types/recipes.types";

const RECIPE_UUID = "rec-ingr-0001";

function makeIngredient(quantity: number): RecipeIngredient {
  return {
    ref: "eau-ref",
    name: "Eau",
    originalQuantity: quantity,
    originalUnit: "gr.",
    normalizedQuantity: quantity,
    normalizedUnit: "gr.",
    comment: "",
    allergens: [],
    type: "boissons",
  };
}

function makeRecipeFixture(quantity: number): RecipeForDisplay {
  return {
    id: RECIPE_UUID,
    created: pbDate(T0),
    updated: pbDate(T0),
    title: "Soupe",
    typeR: "plat",
    plate: 4,
    ingredients: [makeIngredient(quantity)],
    astuces: [],
  } as unknown as RecipeForDisplay;
}

function makeEventWithRecipe(): EnrichedEventLike {
  const base = makeEvent();
  return {
    ...base,
    meals: [
      {
        date: TEST_DATE,
        guests: 4,
        recipes: [{ recipeUuid: RECIPE_UUID, plates: 4, typeR: "plat" }],
      },
    ],
  } as EnrichedEventLike;
}

type EnrichedEventLike = ReturnType<typeof makeEvent> & {
  meals: Array<{
    date: string;
    guests: number;
    recipes: Array<{ recipeUuid: string; plates: number; typeR: string }>;
  }>;
};

async function readNeed(): Promise<{ id: string; totalNeededArray: string } | undefined> {
  return db.productNeeds
    .where("mainId")
    .equals(TEST_EVENT_ID)
    .first() as Promise<{ id: string; totalNeededArray: string } | undefined>;
}

describe("ProductsStore — recalcul des besoins au changement d'ingrédient", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    (globalThis as any).__recalcFixtures = {
      recipesByUuid: new Map([[RECIPE_UUID, makeRecipeFixture(500)]]),
    };
    recipeUpdatedIndex.clear();
    recipeUpdatedIndex.set(RECIPE_UUID, pbDate(T0));

    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? (makeEventWithRecipe() as any) : null),
    );
  });

  it("calcule les besoins à l'initialisation depuis les recettes liées", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    const need = await readNeed();
    expect(need).toBeDefined();
    expect(JSON.parse(need!.totalNeededArray)).toEqual([{ q: 500, u: "gr." }]);
  });

  it("recalcule quand l'ingrédient change (timestamp bouge, meals identiques)", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);
    expect(JSON.parse((await readNeed())!.totalNeededArray)).toEqual([
      { q: 500, u: "gr." },
    ]);

    // L'ingrédient passe de 500 à 700 gr. — la recette est réécrite (nouveau
    // contenu + nouveau `updated`), comme après une édition dans l'app.
    (globalThis as any).__recalcFixtures = {
      recipesByUuid: new Map([[RECIPE_UUID, makeRecipeFixture(700)]]),
    };
    recipeUpdatedIndex.set(RECIPE_UUID, pbDate(T1));
    await waitForTick(8);

    const need = await readNeed();
    expect(JSON.parse(need!.totalNeededArray)).toEqual([{ q: 700, u: "gr." }]);
  });

  it("ne recalcule pas quand le hash meals+timestamps est inchangé (guard)", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);
    const bulkCallsAtStart = vi.mocked(
      recipesStore.getRecipesByUuidsBulk as ReturnType<typeof vi.fn>,
    ).mock.calls.length;
    expect(bulkCallsAtStart).toBeGreaterThanOrEqual(1);

    // Re-run de l'effect sans changement effectif : delete+set de la même
    // valeur déclenche la notification, mais le hash reconstruit est
    // identique → le guard court-circuite (pas de nouveau calcul).
    const ts = recipeUpdatedIndex.get(RECIPE_UUID)!;
    recipeUpdatedIndex.delete(RECIPE_UUID);
    recipeUpdatedIndex.set(RECIPE_UUID, ts);
    await waitForTick(8);

    const bulkCallsAfter = vi.mocked(
      recipesStore.getRecipesByUuidsBulk as ReturnType<typeof vi.fn>,
    ).mock.calls.length;
    expect(bulkCallsAfter).toBe(bulkCallsAtStart);
    expect(JSON.parse((await readNeed())!.totalNeededArray)).toEqual([
      { q: 500, u: "gr." },
    ]);
  });
});
