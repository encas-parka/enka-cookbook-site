/**
 * @vitest-environment jsdom
 */

/**
 * Boucle de diagnostic P1-recipes/datastores (handoff click-through 26-10-07,
 * itération 2 — après les logs "456 synced → 0 en store").
 *
 * Reproduit la chaîne COMPLETE en conditions harnais (faux PB + vrai Dexie +
 * vrai liveQuery + vrai $derived Svelte 5) :
 *   seed serveur PB → initialFetch (transaction Dexie) → bridgeToMap(liveQuery)
 *   → SvelteMap → $derived (#recipesIndex / #ingredientsMap)
 *
 * Le log utilisateur montre : « 456 records synced » puis « 0 recettes »,
 * « 845 records synced » puis « 0 ingrédients », alors que categories (60 → 19
 * filtrés) fonctionne avec le MÊME bridge. Si cette boucle est verte, la cause
 * est spécifique au navigateur réel (IndexedDB réel), pas au code pb-sync.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  bridgeToMap,
  createSyncCollection,
  db,
  pb,
} from "$lib/db-sync/pb-sync";
import type { Recettes } from "$lib/types/pb";
import type { IngredientsRecord } from "$lib/types/pb-generated";

const RECIPE_COUNT = 456;
const INGREDIENT_COUNT = 845;

/** Recette PB fidèle au shape post re-import T17 (json natif). */
function makeRecipeRecord(i: number): Recettes {
  return {
    id: `recipe${String(i).padStart(11, "0")}`,
    created: pbDate(new Date("2026-06-08T10:00:00.000Z")),
    updated: pbDate(new Date("2026-10-06T23:04:00.000Z")),
    title: `Recette ${i}`,
    plate: 4,
    preparation: null,
    draft: false,
    typeR: "plat",
    categories: ["Plats"],
    regime: null,
    publishedAt: null,
    status: "public",
    auteur: "",
    check: false,
    cuisson: false,
    description: "",
    ingredients: [{ allergens: [], name: "Ail", ref: "xo0ibs" }],
    astuces: null,
    materiel: null,
    prepAlt: null,
    quantite_desc: "",
    region: "",
    saison: null,
    serveHot: false,
    preparation24h: "",
    versionLabel: "",
    lockedBy: "",
    permissionWrite: [],
    rootRecipeId: "",
    createdBy: "user1",
    teams: null,
  } as unknown as Recettes;
}

/** Ingrédient PB fidèle au shape DB réel (type catégoriel : legumes, sec…). */
function makeIngredientRecord(i: number): IngredientsRecord {
  return {
    id: `ingred${String(i).padStart(12, "0")}`,
    created: pbDate(new Date("2026-06-08T10:00:00.000Z")),
    updated: pbDate(new Date("2026-10-06T23:04:00.000Z")),
    ref: `ref${String(i).padStart(7, "0")}`,
    name: `Ingrédient ${i}`,
    type: "legumes",
    allergens: [],
    pF: false,
    pS: false,
    saisons: null,
  } as unknown as IngredientsRecord;
}

describe("Chaîne complète sync → bridge → store (volumes réels)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await clearDexie();

    fakePb.seed(
      "recipes",
      Array.from({ length: RECIPE_COUNT }, (_, i) => makeRecipeRecord(i)),
    );
    fakePb.seed(
      "ingredients",
      Array.from({ length: INGREDIENT_COUNT }, (_, i) =>
        makeIngredientRecord(i),
      ),
    );
  });

  it("recipes : initialFetch → bridge liveQuery voit 456 records", async () => {
    const recipesCollection = createSyncCollection<Recettes>(
      pb,
      db.recipes,
      "recipes",
    );
    const bridge = bridgeToMap<Recettes>(() => db.recipes.toArray());

    await recipesCollection.initialFetch();
    await waitForTick(5);

    const localCount = await db.recipes.count();
    expect(localCount).toBe(RECIPE_COUNT);
    expect(bridge.map.size).toBe(RECIPE_COUNT);
    bridge.subscription.unsubscribe();
  });

  it("ingredients : initialFetch → bridge liveQuery voit 845 records", async () => {
    const ingredientsCollection = createSyncCollection<IngredientsRecord>(
      pb,
      db.ingredients,
      "ingredients",
    );
    const bridge = bridgeToMap<IngredientsRecord>(() =>
      db.ingredients.toArray(),
    );

    await ingredientsCollection.initialFetch();
    await waitForTick(5);

    const localCount = await db.ingredients.count();
    expect(localCount).toBe(INGREDIENT_COUNT);
    expect(bridge.map.size).toBe(INGREDIENT_COUNT);
    bridge.subscription.unsubscribe();
  });
});
