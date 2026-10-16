/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — recherche recettes et sync filtres↔URL.
 *
 * Couvre : hydratation, écriture+historique, non-boucle, back simulé, fuzzy
 * recettes, bypass, debounce, cycle de vie.
 *
 * Point d'attention : `searchParams` (sv-router) garde son propre état,
 * synchronisé à l'URL réelle uniquement par ses set/delete (pas par un
 * history.replaceState brut) — les tests passent donc toujours par le
 * wrapper, y compris pour le nettoyage inter-tests.
 */

vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    getRecipeUpdatedAt: vi.fn(),
    getRecipesByUuidsBulk: vi.fn(async () => new Map()),
    getRecipeByUuid: vi.fn(async () => null),
  },
}));

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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { searchParams } from "sv-router";
import { currentFakePb } from "./harness/stub-pb";
import { clearDexie, seedProductNeeds } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  makePurchaseRecord,
  TEST_DATE,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import type { ProductNeedRow } from "$lib/db-sync/pb-sync";

const URL_KEYS = [
  "status",
  "group",
  "temp",
  "types",
  "stores",
  "smode",
  "who",
  "wmode",
  "delivery",
  "search",
];

/** Vide les params via le wrapper (seul chemin qui le resynchronise). */
function clearUrl() {
  for (const key of URL_KEYS) {
    searchParams.delete(key, undefined, { replace: true });
  }
}

function flatIds(): string[] {
  return Object.values(productsStore.groupedProducts)
    .flat()
    .map((m) => m.data.id);
}

async function initFresh(
  urlParams: Record<string, string> = {},
  needRows?: ProductNeedRow[],
) {
  const fakePb = currentFakePb();
  fakePb.reset();
  await productsStore.softReset();
  await clearDexie();
  clearUrl();

  fakePb.seed("products", [makeProductRecord()]);
  fakePb.seed("purchases", [makePurchaseRecord()]);
  await seedProductNeeds(needRows ?? [makeNeedRow()]);

  const event = makeEvent({ date: [TEST_DATE] });
  vi.mocked(eventsStore.getEventById).mockImplementation((id: string) =>
    id === TEST_EVENT_ID ? event : null,
  );

  for (const [key, value] of Object.entries(urlParams)) {
    searchParams.set(key, value);
  }
  await productsStore.initialize(TEST_EVENT_ID);
  await waitForTick(5);
}

beforeEach(async () => {
  await initFresh();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ProductsStore — sync filtres↔URL (G)", () => {
  it("URL vide → filtres par défaut", () => {
    expect(productsStore.filters.completionStatus).toBe("all");
    expect(productsStore.filters.groupBy).toBe("productType");
    expect(productsStore.filters.selectedProductTypes).toEqual([]);
  });

  it("hydrate les filtres vue depuis l'URL avant initialize", async () => {
    await initFresh({
      status: "incomplete",
      group: "store",
      types: "boissons",
    });
    expect(productsStore.filters.completionStatus).toBe("incomplete");
    expect(productsStore.filters.groupBy).toBe("store");
    expect(productsStore.filters.selectedProductTypes).toEqual(["boissons"]);
  });

  it("setter → URL + filtres (passage read-side)", async () => {
    productsStore.setCompletionStatus("incomplete");
    expect(window.location.search).toContain("status=incomplete");
    await waitForTick(3);
    expect(productsStore.filters.completionStatus).toBe("incomplete");
  });

  it("garde d'égalité : 0 écriture URL si rien ne change", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    productsStore.setCompletionStatus("all"); // déjà la valeur par défaut
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("une entrée d'historique par action (push puis replace)", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    // 1 seul changement réel (delivery, status déjà null) = 1 push, 0 replace
    productsStore.setDeliveryDateFilter("2026-12-19");
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    await waitForTick(3);
    expect(productsStore.filters.deliveryDateFilter).toBe("2026-12-19");
    // 2 changements réels (status + suppression delivery) = 1 push + 1 replace
    productsStore.setCompletionStatus("incomplete");
    expect(push).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("non-boucle : l'effet converge (pas d'effect_update_depth_exceeded)", async () => {
    const consoleError = vi.spyOn(console, "error");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    productsStore.setCompletionStatus("incomplete");
    await waitForTick(5);
    const snap1 = JSON.parse(JSON.stringify(productsStore.filters));
    await waitForTick(5);
    const snap2 = JSON.parse(JSON.stringify(productsStore.filters));
    expect(snap1).toEqual(snap2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    const crashes = consoleError.mock.calls.filter((args) =>
      String(args[0]).includes("effect_update_depth_exceeded"),
    );
    expect(crashes).toEqual([]);
  });

  it("back simulé : suppression du param → retour au défaut", async () => {
    productsStore.setCompletionStatus("incomplete");
    await waitForTick(3);
    expect(productsStore.filters.completionStatus).toBe("incomplete");
    // Équivalent exact de syncSearchParams au popstate (le Router n'est pas monté ici)
    searchParams.delete("status", undefined, { replace: true });
    await waitForTick(3);
    expect(productsStore.filters.completionStatus).toBe("all");
  });

  it("clearFilters vide l'URL (vue) + reset mémoire (search/tri)", async () => {
    productsStore.toggleProductType("boissons");
    await waitForTick(3);
    expect(window.location.search).toContain("types=");
    productsStore.clearFilters();
    await waitForTick(3);
    for (const key of URL_KEYS) {
      expect(searchParams.get(key)).toBeNull();
    }
    expect(productsStore.filters.selectedProductTypes).toEqual([]);
  });

  it("reset() détruit l'effet URL : setter post-reset n'hydrate plus", async () => {
    await productsStore.softReset();
    clearUrl();
    productsStore.toggleProductType("boissons");
    await waitForTick(3);
    // Write-side vivante (URL écrite)…
    expect(window.location.search).toContain("types=boissons");
    // …mais sans read-side (filtres intacts)
    expect(productsStore.filters.selectedProductTypes).toEqual([]);
  });
});

describe("ProductsStore — recherche (C) + flag URL", () => {
  it("flag search dans l'URL, contenu en mémoire", async () => {
    vi.useFakeTimers();
    productsStore.setSearchQuery("eau");
    await vi.advanceTimersByTimeAsync(800);
    expect(String(searchParams.get("search"))).toBe("true");
    expect(productsStore.filters.searchQuery).toBe("eau");
    productsStore.setSearchQuery("");
    await vi.advanceTimersByTimeAsync(800);
    expect(searchParams.get("search")).toBeNull();
  });

  it("back sur le flag vide la recherche mémoire", async () => {
    vi.useFakeTimers();
    productsStore.setSearchQuery("eau");
    await vi.advanceTimersByTimeAsync(800);
    expect(productsStore.isSearchActive).toBe(true);
    searchParams.delete("search", undefined, { replace: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(productsStore.filters.searchQuery).toBe("");
  });

  it("recherche par titre de recette avec le flag, masquée sans", async () => {
    const needWithRecipe = makeNeedRow({
      byDate: JSON.stringify({
        "2026-12-19": {
          totalConsolidated: [{ q: 2, u: "l" }],
          recipes: [
            {
              r: "Soupe à l'oignon",
              q: 2,
              u: "l",
              qEq: 2,
              uEq: "l",
              a: 10,
            },
          ],
          totalAssiettes: 10,
          recipeCount: 1,
        },
      }),
    });
    await initFresh({}, [needWithRecipe]);
    vi.useFakeTimers();

    productsStore.setSearchInRecipes(true);
    productsStore.setSearchQuery("soupe");
    await vi.advanceTimersByTimeAsync(800);
    expect(flatIds()).toContain(TEST_PRODUCT_ID);

    productsStore.setSearchInRecipes(false);
    expect(flatIds()).not.toContain(TEST_PRODUCT_ID);
  });

  it("bypass : la recherche préserve les filtres vue et les réapplique après", async () => {
    vi.useFakeTimers();
    // Le filtre type masque le produit (boissons ≠ boucherie)
    productsStore.toggleProductType("boucherie");
    await vi.advanceTimersByTimeAsync(300);
    expect(flatIds()).not.toContain(TEST_PRODUCT_ID);

    // Recherche active : le produit matché reste affiché malgré le filtre
    productsStore.setSearchQuery("eau");
    await vi.advanceTimersByTimeAsync(800);
    expect(flatIds()).toContain(TEST_PRODUCT_ID);
    // …et le filtre vue est toujours là, en pause
    expect(productsStore.filters.selectedProductTypes).toEqual(["boucherie"]);

    // Fin de recherche : le filtre se réapplique
    productsStore.setSearchQuery("");
    await vi.advanceTimersByTimeAsync(800);
    expect(flatIds()).not.toContain(TEST_PRODUCT_ID);
  });

  it("debounce : une rafale de frappes = une seule écriture du flag", async () => {
    vi.useFakeTimers();
    const push = vi.spyOn(window.history, "pushState");
    productsStore.setSearchQuery("e");
    productsStore.setSearchQuery("ea");
    productsStore.setSearchQuery("eau");
    await vi.advanceTimersByTimeAsync(800);
    expect(push).toHaveBeenCalledTimes(1);
    expect(String(searchParams.get("search"))).toBe("true");
  });
});
