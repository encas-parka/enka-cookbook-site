/**
 * stress-scenarios.ts — Fonctions exécutant les scénarios de charge
 *
 * 2 scénarios (CF retiré en révision 4) :
 *   - runRead : 3× listRows("products", limit=10)
 *   - runWrite : 2× updateRow("products", $id, {store, updatedBy})
 *
 * Chaque scénario :
 *   1. Mesure la latence de l'appel
 *   2. Enregistre dans le StressReporter (succès ou erreur avec code HTTP)
 *   3. Est tolérant aux erreurs (ne throw pas — c'est au caller de décider)
 *
 * Note sur les reads : le serveur 1.9.0 ne supporte pas queries[] (filtres).
 * On listRows sans filter — la charge lecture vient de la récupération de N rows.
 * Le `limit=10` est un hint parfois ignoré selon les collections.
 */

import type { StressClient } from "./stress-client";
import type { StressReporter } from "./stress-reporter";

// =============================================================================
// SCÉNARIO READ
// =============================================================================

/**
 * Lecture : 3× listRows("products") avec limit=10.
 * Génère de la charge de lecture sur la table products (la plus grosse).
 *
 * @returns nombre de succès
 */
export async function runRead(
  client: StressClient,
  reporter: StressReporter,
): Promise<number> {
  let successCount = 0;

  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      const result = await client.listRows("products", { limit: 10 });
      const durationMs = performance.now() - t0;
      reporter.record({
        scenario: "read",
        userIndex: client.user.index,
        durationMs,
        status: "success",
        timestamp: Date.now(),
      });
      successCount++;
    } catch (e: any) {
      const durationMs = e.durationMs ?? performance.now() - t0;
      reporter.record({
        scenario: "read",
        userIndex: client.user.index,
        durationMs,
        status: "error",
        httpStatus: e.status,
        errorMessage: e.message,
        timestamp: Date.now(),
      });
    }
  }

  return successCount;
}

// =============================================================================
// SCÉNARIO WRITE
// =============================================================================

/**
 * Écriture : 2× updateRow sur le produit avec des valeurs .store aléatoires.
 * Le produit est mis à jour avec un store JSON string + updatedBy = userName.
 *
 * @param productIds - IDs des products à updater (round-robin entre calls)
 * @returns nombre de succès
 */
export async function runWrite(
  client: StressClient,
  productIds: string[],
  reporter: StressReporter,
): Promise<number> {
  if (productIds.length === 0) {
    throw new Error("[runWrite] productIds vide");
  }

  let successCount = 0;

  for (let i = 0; i < 2; i++) {
    // Round-robin sur les productIds
    const productId = productIds[Math.floor(Math.random() * productIds.length)];

    // Génère un store JSON aléatoire (champ .store est une string JSON)
    const stores = ["carrefour", "casino", "ldlc", "leclerc", "other"];
    const randomStore = stores[Math.floor(Math.random() * stores.length)];
    const storeValue = JSON.stringify({
      storeName: randomStore,
      storeComment: `stress-${Date.now()}-${i}`,
    });

    const t0 = performance.now();
    try {
      await client.updateRow("products", productId, {
        store: storeValue,
        updatedBy: client.userName || `stress-${client.user.index}`,
      });
      const durationMs = performance.now() - t0;
      reporter.record({
        scenario: "write",
        userIndex: client.user.index,
        durationMs,
        status: "success",
        timestamp: Date.now(),
      });
      successCount++;
    } catch (e: any) {
      const durationMs = e.durationMs ?? performance.now() - t0;
      reporter.record({
        scenario: "write",
        userIndex: client.user.index,
        durationMs,
        status: "error",
        httpStatus: e.status,
        errorMessage: e.message,
        timestamp: Date.now(),
      });
    }
  }

  return successCount;
}

// =============================================================================
// SCÉNARIO COMPOSÉ (pour une rafale)
// =============================================================================

/**
 * Rafale complète pour un user : 3 reads + 2 writes.
 * À appeler dans Promise.all() sur tous les users pour paralléliser.
 *
 * @returns { reads, writes } — nombre de succès par scénario
 */
export async function runUserRafale(
  client: StressClient,
  productIds: string[],
  reporter: StressReporter,
): Promise<{ reads: number; writes: number }> {
  // Lance read et write en parallèle au sein d'un même user
  // (simule un user qui charge une page et modifie en même temps)
  const [reads, writes] = await Promise.all([
    runRead(client, reporter),
    runWrite(client, productIds, reporter),
  ]);

  return { reads, writes };
}
