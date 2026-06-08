/**
 * Convert a Hugo recipe detail (from db.recipeData) to an Appwrite Recettes row.
 *
 * Simulates what happens in production when a user edits a Hugo recipe:
 * the Appwrite version is created via `updateRecipeAppwrite()` and takes
 * priority over the Hugo version in `RecipesStore.#recipesIndex`.
 *
 * Usage:
 * ```ts
 * const row = await db.recipeData.get("detail:chorizo-vegan_gqf4yi01uime");
 * const appwriteRecipe = hugoToAppwriteRecipe(row!.data, {
 *   $updatedAt: "2026-06-06T00:00:00.000Z",
 * });
 * await db.recipes.put(appwriteRecipe);
 * ```
 */
import type { Recettes } from "$lib/types/appwrite.d";

/**
 * Derive an Appwrite Recettes from a Hugo recipe detail.
 * Ingredients are serialized to `string[]` (Appwrite format).
 * All fields default to reasonable values — override via `overrides`.
 */
export function hugoToAppwriteRecipe(
  detail: any,
  overrides?: Partial<Recettes>,
): Recettes {
  const id = detail.uuid || detail.$id || "";
  return {
    $id: id,
    $createdAt: detail.$createdAt || "2026-01-01T00:00:00.000Z",
    $updatedAt: detail.$updatedAt || "2026-01-01T00:00:00.000Z",
    $permissions: [],
    $databaseId: "fake-db",
    $tableId: "recettes",
    title: detail.title ?? "Test Recipe",
    plate: detail.plate ?? 4,
    preparation: detail.preparation ?? "",
    draft: false,
    typeR: detail.typeR ?? "plat",
    categories: detail.categories ?? null,
    regime: detail.regime ?? null,
    publishedAt: detail.publishedAt ?? null,
    createdBy: "test-user",
    teams: null,
    materiel: detail.materiel ?? null,
    prepAlt: detail.prepAlt ?? null,
    ingredients: (detail.ingredients ?? []).map((ing: any) =>
      JSON.stringify(ing),
    ),
    description: detail.description ?? null,
    region: detail.region ?? null,
    cuisson: detail.cuisson ?? false,
    quantite_desc: detail.quantite_desc ?? null,
    check: false,
    preparation24h: detail.preparation24h ?? null,
    permissionWrite: null,
    serveHot: detail.serveHot ?? true,
    lockedBy: null,
    saison: detail.saison ?? null,
    auteur: detail.auteur ?? null,
    astuces: detail.astuces
      ? detail.astuces.map((a: any) => JSON.stringify(a))
      : null,
    status: "published" as Recettes["status"],
    rootRecipeId: detail.rootRecipeId ?? null,
    versionLabel: detail.versionLabel ?? null,
    ...overrides,
  } as Recettes;
}

/**
 * Create a modified copy of a recipe detail with doubled ingredient quantities.
 * Used to test that ProductsStore recalculates productNeeds when recipe data changes.
 */
export function doubleIngredientQuantities(detail: any): any {
  return {
    ...detail,
    ingredients: (detail.ingredients ?? []).map((ing: any) => ({
      ...ing,
      originalQuantity: (ing.originalQuantity ?? 0) * 2,
      normalizedQuantity: (ing.normalizedQuantity ?? 0) * 2,
    })),
  };
}
