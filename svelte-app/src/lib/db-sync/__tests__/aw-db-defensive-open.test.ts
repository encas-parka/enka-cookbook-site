/**
 * @vitest-environment jsdom
 */

/**
 * Test du portage oupla #1 (handoff click-through 26-10-07) — open défensif
 * Dexie : une base EnkaDB incompatible (version IndexedDB supérieure à celle
 * déclarée, ex. v100 vs v10) doit être droppée et recréée au boot, pas
 * laissée dans un état où toute opération (liveQuery des bridges) échoue en
 * silence. Le cache local n'est pas source de vérité : PocketBase l'est.
 */
import { describe, it, expect } from "vitest";

describe("ensureDbReady — open défensif (portage oupla #1)", () => {
  it("reset la base quand une version supérieure bloque l'open (VersionError)", async () => {
    // Simuler une base EnkaDB montée à v100 par une manipulation externe
    // (idiome « bump pour forcer un wipe ») — aucune déclaration Dexie ne
    // peut l'ouvrir à une version inférieure.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("EnkaDB", 100);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("open v100 blocked"));
    });

    // Import dynamique : le singleton `db` n'existe pas encore — aucun open
    // n'a eu lieu avant ensureDbReady.
    const mod = await import("$lib/db-sync/aw-db");
    await mod.ensureDbReady(); // doit drop + reopen sans lever

    // La base recréée est opérationnelle (schéma v10, tables présentes)
    const count = await mod.db.recipes.count();
    expect(count).toBe(0);
    const meta = await mod.db.syncMeta.count();
    expect(meta).toBe(0);
  });

  it("est mémoïsé : le 2e appel réutilise la promesse (base déjà ouverte)", async () => {
    const mod = await import("$lib/db-sync/aw-db");
    await mod.ensureDbReady();
    await mod.ensureDbReady(); // ne doit ni lever ni re-dropper la base
    expect(await mod.db.recipes.count()).toBe(0);
  });
});
