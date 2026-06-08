/**
 * Bootstrap a real EventsStore for integration tests.
 *
 * Why a real store (not mocked):
 * - ProductsStore's $effect reads `eventsStore.getEventById()` which returns
 *   from a `$derived.by()` on a SvelteMap. A mocked function is not reactive —
 *   it can't re-fire the $effect when Dexie data changes.
 * - By bootstrapping a real EventsStore, the full chain works:
 *     db.events.put(changedEvent) → liveQuery → SvelteMap → $derived.by → getEventById
 * - We skip syncInitial() and setupRealtime() to avoid unnecessary Appwrite calls,
 *   since we control Dexie directly.
 *
 * Usage:
 * ```ts
 * import { bootstrapEventsStore } from "./harness/bootstrap-events-store";
 * import fixture from "./fixtures/realistic/event-test-1.json";
 *
 * beforeEach(async () => {
 *   const { eventId } = await bootstrapEventsStore(fixture);
 *   // eventsStore.getEventById(eventId) is now reactive
 * });
 * ```
 */
import { vi } from "vitest";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { installStubAppwrite } from "./stub-appwrite";
import { seedDexie, clearDexie, type Fixture, type SeedResult } from "./seed-dexie";
import { waitForTick } from "./wait-for-tick";

export interface BootEventsResult extends SeedResult {
  /** The eventsStore is fully initialized and reactive. */
}

/**
 * Bootstrap a real EventsStore with Dexie seeded from a fixture.
 *
 * Steps:
 * 1. Install fresh Appwrite stubs (no network)
 * 2. Clear and re-seed Dexie with the fixture data
 * 3. softReset() the eventsStore — clears its internal state but keeps the
 *    bridge liveQuery alive. The liveQuery will pick up the seeded data.
 * 4. Wait for the bridge to propagate Dexie → SvelteMap
 * 5. Call loadCache() — sets isInitialized=true (requires isAuthenticated)
 * 6. Optionally call syncInitial() + setupRealtime() (both use stubs, harmless)
 *
 * After this, `eventsStore.getEventById(eventId)` returns an enriched event
 * and will react to `db.events.put(...)` changes.
 */
export async function bootstrapEventsStore(
  fixture: Fixture,
  options?: { skipSync?: boolean },
): Promise<BootEventsResult> {
  // 1. Fresh Appwrite stubs
  installStubAppwrite();

  // 2. Ensure globalState.isAuthenticated returns true
  //    (loadCache() checks this)
  try {
    vi.spyOn(globalState, "isAuthenticated", "get").mockReturnValue(true);
  } catch {
    // Already spying — restore and re-spy
    vi.restoreAllMocks();
    vi.spyOn(globalState, "isAuthenticated", "get").mockReturnValue(true);
  }

  // 3. Soft reset the store FIRST — clears maps + flags + Dexie table,
  //    but preserves the bridge liveQuery (which will re-fire when we seed)
  await eventsStore.softReset();

  // 4. Seed Dexie — bridge liveQuery detects the bulkPut → #rawEvents repopulates
  const seed = await seedDexie(fixture);

  // 5. Wait for bridge liveQuery to propagate Dexie → SvelteMap
  await waitForTick(3);

  // 6. loadCache() — verifies isAuthenticated, sets #isInitialized = true
  await eventsStore.loadCache();

  // 7. syncInitial() + setupRealtime() — SKIPPED.
  //    We control Dexie directly, these phases are unnecessary.
  //    syncInitial calls initialFetch() which writes to syncMeta inside
  //    a transaction on [table, db.syncMeta] — this can interfere with
  //    the bridge liveQuery observer on the same table.
  if (options?.skipSync === false) {
    try {
      await eventsStore.syncInitial();
      await eventsStore.setupRealtime();
    } catch {
      // Stubs may not satisfy all invariants — that's OK for tests
    }
  }

  return { eventId: seed.eventId, event: seed.event };
}
