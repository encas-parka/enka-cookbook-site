/**
 * Seed Dexie with a fixture JSON file extracted from a real running app.
 *
 * Why a real fixture (vs synthetic):
 * - Catches real-world bugs (date format inconsistencies, missing fields,
 *   serialization quirks) that synthetic data would never expose.
 * - The fixture is exported by running a script in the browser console
 *   (see project notes / AGENTS.md for the extraction script).
 *
 * JSON-string gotcha: Appwrite stores nested fields like `event.meals`,
 * `event.contributors`, `event.todos` as JSON strings. The fixture script
 * leaves the raw event intact, so we defensively parse them here.
 *
 * Recursive parsing: `event.meals` is typed as `string[]` but the store
 * treats each element as an object (with `.recipes`, `.guests`, etc.).
 * We recursively parse strings so the seeded event matches what the store
 * expects at runtime.
 *
 * Returns the parsed event so tests can wire it into store mocks:
 * ```ts
 * vi.mocked(eventsStore.getEventById).mockReturnValue(result.event);
 * ```
 *
 * Usage:
 * ```ts
 * import { seedDexie, clearDexie } from "./harness/seed-dexie";
 * import fixture from "./fixtures/realistic/event-test-1.json";
 *
 * beforeEach(async () => {
 *   await clearDexie();
 *   const result = await seedDexie(fixture);
 *   vi.mocked(eventsStore.getEventById).mockReturnValue(result.event);
 * });
 * ```
 */
import { db } from "$lib/db-sync/aw-sync";
import type { Main, Products, Purchases, Recettes } from "$lib/types/appwrite.d";
import type {
  ProductNeedRow,
  RecipeDataRow,
  CatalogRow,
} from "$lib/db-sync/aw-db";

export interface Fixture {
  exportedAt?: string;
  event: Main;
  products: Products[];
  purchases: Purchases[];
  productNeeds: ProductNeedRow[];
  recipes: Recettes[];
  recipeData: RecipeDataRow[];
  catalog: CatalogRow[];
}

export interface SeedResult {
  eventId: string;
  /** Event with `meals`/`contributors`/`todos` recursively parsed to objects. */
  event: Main;
}

/**
 * Recursively parse JSON strings. Handles:
 * - `string` → `JSON.parse(s)` (then recurse in case the result is still a string or array of strings)
 * - `Array` → map each element recursively
 * - other → return as-is
 */
function deeplyParse(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return deeplyParse(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map(deeplyParse);
  }
  return value;
}

/**
 * Seed all relevant Dexie tables with the contents of a fixture.
 * Runs inside a single transaction for atomicity.
 */
export async function seedDexie(fixture: Fixture): Promise<SeedResult> {
  // Store the RAW event in Dexie (strings JSON, matching Appwrite format).
  // The store's #enrichEvent() handles parsing via parseEventMeals etc.
  // We also produce a parsed version for tests that mock getEventById.
  const rawEvent: Main = {
    ...fixture.event,
    // Keep meals/contributors/todos as-is (string[] from fixture)
  };

  const parsedEvent: Main = {
    ...fixture.event,
    meals: deeplyParse(fixture.event.meals) as Main["meals"],
    contributors: deeplyParse(fixture.event.contributors) as Main["contributors"],
    todos: deeplyParse(fixture.event.todos) as Main["todos"],
  };

  await db.transaction(
    "rw",
    [
      db.events,
      db.products,
      db.purchases,
      db.productNeeds,
      db.recipes,
      db.recipeData,
      db.catalog,
    ],
    async () => {
      await db.events.put(rawEvent);
      if (fixture.products?.length) await db.products.bulkPut(fixture.products);
      if (fixture.purchases?.length)
        await db.purchases.bulkPut(fixture.purchases);
      if (fixture.productNeeds?.length)
        await db.productNeeds.bulkPut(fixture.productNeeds);
      if (fixture.recipes?.length) await db.recipes.bulkPut(fixture.recipes);
      if (fixture.recipeData?.length)
        await db.recipeData.bulkPut(fixture.recipeData);
      if (fixture.catalog?.length) await db.catalog.bulkPut(fixture.catalog);
    },
  );

  return { eventId: rawEvent.$id, event: parsedEvent };
}

/**
 * Clear all tables used by fixtures. Call this in `beforeEach` to ensure
 * test isolation without having to recreate the `EnkaDB` instance.
 */
export async function clearDexie(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.events,
      db.products,
      db.purchases,
      db.productNeeds,
      db.recipes,
      db.recipeData,
      db.catalog,
      db.syncMeta,
    ],
    async () => {
      await db.events.clear();
      await db.products.clear();
      await db.purchases.clear();
      await db.productNeeds.clear();
      await db.recipes.clear();
      await db.recipeData.clear();
      await db.catalog.clear();
      await db.syncMeta.clear();
    },
  );
}
