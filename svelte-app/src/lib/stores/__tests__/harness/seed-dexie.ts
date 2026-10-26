/**
 * Seed / clear the Dexie tables used by store integration tests.
 *
 * The sync data (products, purchases) lives in the fake PocketBase server
 * (see stub-pb.ts) and flows into Dexie through the REAL `initialFetch` —
 * only locally-computed tables (productNeeds) and static reference data
 * are seeded directly here.
 */
import { db } from "$lib/db-sync/pb-sync";
import type { ProductNeedRow } from "$lib/db-sync/pb-sync";

/**
 * Tables touched by the store/component tests — cleared between tests.
 * Covers every sync scope the lots under run consume (events, teamdocs,
 * locks, ingredients, categories, nativeTeams included: teams components
 * read the Dexie cache, so a leftover row leaks across tests).
 *
 * Single source of truth: the transaction table list and the clear calls
 * MUST stay in sync — both derive from this array.
 */
const CLEARED_TABLES = [
  db.products,
  db.purchases,
  db.productNeeds,
  db.recipes,
  db.syncMeta,
  db.materiels,
  db.materielLoans,
  db.eventMateriels,
  db.events,
  db.teamdocs,
  db.locks,
  db.ingredients,
  db.categories,
  db.nativeTeams,
];

export async function clearDexie(): Promise<void> {
  await db.transaction("rw", CLEARED_TABLES, async () => {
    for (const table of CLEARED_TABLES) {
      await table.clear();
    }
  });
}

/** Seed calculated product needs directly into Dexie (store skips recalc when non-empty). */
export async function seedProductNeeds(rows: ProductNeedRow[]): Promise<void> {
  await db.transaction("rw", [db.productNeeds], async () => {
    await db.productNeeds.bulkPut(rows);
  });
}
