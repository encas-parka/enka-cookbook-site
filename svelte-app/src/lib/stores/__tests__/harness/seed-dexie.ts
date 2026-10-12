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

/** Tables touched by the store tests — cleared between tests. */
export async function clearDexie(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.products,
      db.purchases,
      db.productNeeds,
      db.recipes,
      db.syncMeta,
      db.materiels,
      db.materielLoans,
      db.eventMateriels,
    ],
    async () => {
      await db.products.clear();
      await db.purchases.clear();
      await db.productNeeds.clear();
      await db.recipes.clear();
      await db.syncMeta.clear();
      await db.materiels.clear();
      await db.materielLoans.clear();
      await db.eventMateriels.clear();
    }
  );
}

/** Seed calculated product needs directly into Dexie (store skips recalc when non-empty). */
export async function seedProductNeeds(rows: ProductNeedRow[]): Promise<void> {
  await db.transaction("rw", [db.productNeeds], async () => {
    await db.productNeeds.bulkPut(rows);
  });
}
