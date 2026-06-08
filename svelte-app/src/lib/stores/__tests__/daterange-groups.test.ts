/**
 * ProductsStore — DateRange change → groups rebuilt (scenario B2)
 *
 * Validates that when the date range changes:
 *   productsStore.setDateRange(restrictedStart, restrictedEnd)
 *     → dateStore.current changes → $effect → #rebuildGroups
 *     → products with byDate outside the range are filtered out
 *
 * Uses mock stores (palier 1 pattern) — no cross-store reactivity needed.
 *
 * Fixture key formats:
 *   - event.allDates: ["2026-07-27T20:00:00", "2026-07-28T10:00:00.000Z"]
 *   - byDate keys:    "2026-07-27T20:00:00" (soir) / "2026-07-28T10:00:00.000Z" (matin)
 *   - String comparison (>= / <=) used in #passesFilters
 *
 * Products used for assertions:
 *   - eau_18fba53d3d          → byDate key "2026-07-27T20:00:00" only (day 27)
 *   - concombre_18fba53d3d    → byDate key "2026-07-28T10:00:00.000Z" only (day 28)
 *   - ail_18fba53d3d          → both dates
 */

// Mocks MUST be declared before importing the store under test
vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    getRecipeUpdatedAt: vi.fn(() => "2026-06-06T00:00:00.000Z"),
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

vi.mock("$lib/services/toast.service.svelte", () => ({
  toastService: {
    track: vi.fn(async (promise: Promise<unknown>) => promise),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { describe, it, expect, beforeEach, vi } from "vitest";
import { installStubAppwrite } from "./harness/stub-appwrite";
import { seedDexie, clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import fixture from "./fixtures/realistic/event-test-1.json";

const EVENT_ID = "6a23d13b0018fba53d3d";

// Date keys from the fixture (exact strings used in byDate)
const DATE_SOIR = "2026-07-27T20:00:00";
const DATE_MATIN = "2026-07-28T10:00:00.000Z";

// Restricted range that covers only the soir date (day 27)
// String comparison: "2026-07-27T20:00:00" >= start && "2026-07-27T20:00:00" <= end → passes
// "2026-07-28T10:00:00.000Z" <= "2026-07-27T23:59:59" → false → filtered out
const RESTRICTED_START = "2026-07-27T20:00:00";
const RESTRICTED_END = "2026-07-27T23:59:59";

/**
 * Count total products across all groups
 */
function countProducts(groups: Record<string, any[]>): number {
  return Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
}

describe("ProductsStore — DateRange change → groups rebuilt (B2)", () => {
  beforeEach(async () => {
    productsStore.reset();
    installStubAppwrite();
    await clearDexie();
    const { event } = await seedDexie(fixture);
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === EVENT_ID ? event : null),
    );
    await productsStore.initialize(EVENT_ID);
    await waitForTick(5);
  });

  it("restricting date range filters out products outside the range", async () => {
    // Sanity: with full range (initial smart range covers all dates), products exist
    const groupsFull = productsStore.groupedProducts;
    const countFull = countProducts(groupsFull);
    expect(countFull).toBeGreaterThan(0);

    // ACTION: Restrict date range to only the soir date (2026-07-27T20:00:00)
    productsStore.setDateRange(RESTRICTED_START, RESTRICTED_END);

    // Wait for $effect to propagate through dateStore → #rebuildGroups
    await waitForTick(8);

    const groupsRestricted = productsStore.groupedProducts;
    const countRestricted = countProducts(groupsRestricted);

    // ASSERT: fewer products — products only on day 28 are filtered out
    expect(countRestricted).toBeLessThan(countFull);
    expect(countRestricted).toBeGreaterThan(0);
  });

  it("expanding date range back restores all products", async () => {
    // Full range count
    const groupsFull = productsStore.groupedProducts;
    const countFull = countProducts(groupsFull);

    // Restrict to day 27 only
    productsStore.setDateRange(RESTRICTED_START, RESTRICTED_END);
    await waitForTick(5);
    expect(countProducts(productsStore.groupedProducts)).toBeLessThan(countFull);

    // Expand back to full range (soir → matin)
    productsStore.setDateRange(DATE_SOIR, DATE_MATIN);
    await waitForTick(5);

    const groupsExpanded = productsStore.groupedProducts;
    const countExpanded = countProducts(groupsExpanded);
    expect(countExpanded).toBe(countFull);
  });
});
