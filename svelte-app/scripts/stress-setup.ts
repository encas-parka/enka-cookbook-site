/**
 * stress-setup.ts — Provisioning du sandbox (event + products + cleanup)
 *
 * Setup :
 *   - scanOrphans() : détecte les sandboxes orphelins (runs précédents crashés)
 *   - cleanupOrphans() : supprime orphelins + leurs products
 *   - createSandboxEvent() : crée l'event STRESS_TEST_{ts}
 *   - fetchRecipes() : récupère N recipes pour les productHugoUuid
 *   - createProducts() : crée M products avec permissions label:eventId
 *   - verifySetup() : valide que tout est en place
 *
 * Teardown :
 *   - teardownSandbox() : delete products (via IDs stockés) + delete event
 *
 * ⚠️ Spécificités serveur ec-dev 1.9.0 :
 *   - `queries[]` non supporté (retourne "Invalid query: Syntax error")
 *   - `equal=attr,value` ignoré (retourne tous les rows)
 *   - `limit=N` parfois ignoré selon les collections
 *   → Tout le filtrage se fait côté client après listRows
 *
 * Permissions :
 *   Tous les documents sont créés avec read(label:eventId) + update(label:eventId),
 *   comme dans l'app Svelte. L'API key admin bypass de toute façon.
 */

import type { StressClient } from "./stress-client";

// =============================================================================
// TYPES
// =============================================================================

export interface SandboxInfo {
  eventId: string;
  eventName: string;
  createdAt: string;
  /** ProductIds créés — conservés pour teardown direct (pas besoin de re-filter) */
  productIds: string[];
}

export interface OrphanEvent {
  $id: string;
  name: string;
  createdAt: string;
  /** ProductIds liés (best-effort) — pour cleanup ciblé */
  productIds: string[];
}

// =============================================================================
// CONSTANTES
// =============================================================================

const SANDBOX_PREFIX = "STRESS_TEST_";
const PRODUCT_PREFIX = "STRESS_PRODUCT_";

// rowId max 36 chars sur Appwrite 1.9.0
// Format : sp_{base36(timestamp)}_{index} — ~15 chars max
function makeProductRowId(eventId: string, index: number): string {
  // Utiliser les 8 derniers chars de l'eventId (unicité suffisante pour le sandbox)
  const suffix = eventId.slice(-8);
  return `sp_${suffix}_${index}`;
}

function makeEventRowId(): string {
  // Format : se_{base36(timestamp)} — ~13 chars
  return `se_${Date.now().toString(36)}`;
}

// =============================================================================
// HELPERS DE FILTRAGE CÔTÉ CLIENT
// =============================================================================

/**
 * listRows avec filtrage côté client.
 * Le serveur 1.9.0 ne supporte pas queries[], on filtre après fetch.
 *
 * Attention : peut ramener beaucoup de données si la collection est grosse.
 * Pagination automatique tant que total > cumul.
 */
async function listRowsAndFilter(
  client: StressClient,
  tableId: string,
  predicate: (row: any) => boolean,
  options?: { pageSize?: number; maxPages?: number },
): Promise<any[]> {
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? 50; // safety: max 5000 rows
  const collected: any[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const data = await client.listRows(tableId, {
      limit: pageSize,
      offset: page * pageSize,
      orderDesc: "$createdAt", // plus récents d'abord pour trouver les nôtres vite
    });

    if (data.rows.length === 0) break;
    collected.push(...data.rows.filter(predicate));

    // Si on a récupéré moins que la page, on est à la fin
    if (data.rows.length < pageSize) break;

    offset += pageSize;
  }

  return collected;
}

// =============================================================================
// SCAN ORPHELINS
// =============================================================================

/**
 * Scanne les events orphelins (commençant par STRESS_TEST_).
 * Filtre côté client car queries[] non supporté sur serveur 1.9.0.
 *
 * ⚠️ LIMITATION SERVEUR 1.9.0 : `listRows` ne retourne PAS les rows récemment
 * créés (latence d'indexation non documentée). Les orphelins récents (< 1h)
 * peuvent ne pas être détectés. Si tu as un sandbox orphelin récent, utilise
 * le mode --cleanup-orphans avec eventId explicite ou cleanup via CLI.
 */
export async function scanOrphans(
  client: StressClient,
): Promise<OrphanEvent[]> {
  const events = await listRowsAndFilter(
    client,
    "main",
    (e) =>
      typeof e.name === "string" && e.name.startsWith(SANDBOX_PREFIX),
    { pageSize: 100, maxPages: 5 }, // max 500 events scannés
  );

  const orphans: OrphanEvent[] = [];
  for (const event of events) {
    // Récupérer les productIds liés (best-effort via filtrage côté client)
    const products = await listRowsAndFilter(
      client,
      "products",
      (p) => p.mainId === event.$id,
      { pageSize: 100, maxPages: 5 },
    );

    orphans.push({
      $id: event.$id,
      name: event.name,
      createdAt: event.$createdAt,
      productIds: products.map((p) => p.$id),
    });
  }

  return orphans;
}

/**
 * Supprime une liste d'orphelins (event + products associés).
 */
export async function cleanupOrphans(
  client: StressClient,
  orphans: OrphanEvent[],
): Promise<{ deletedEvents: number; deletedProducts: number; errors: string[] }> {
  let deletedEvents = 0;
  let deletedProducts = 0;
  const errors: string[] = [];

  for (const orphan of orphans) {
    // 1. Delete tous les products liés (via IDs stockés)
    for (const productId of orphan.productIds) {
      try {
        await client.deleteRow("products", productId);
        deletedProducts++;
      } catch (e: any) {
        // 404 = déjà supprimé, OK
        if (e.status !== 404) {
          errors.push(`delete product ${productId}: ${e.message}`);
        }
      }
    }

    // 2. Delete l'event
    try {
      await client.deleteRow("main", orphan.$id);
      deletedEvents++;
    } catch (e: any) {
      if (e.status !== 404) {
        errors.push(`delete event ${orphan.$id}: ${e.message}`);
      }
    }
  }

  return { deletedEvents, deletedProducts, errors };
}

// =============================================================================
// CRÉATION SANDBOX
// =============================================================================

/**
 * Crée l'event sandbox STRESS_TEST_{timestamp}.
 *
 * @returns eventId du nouveau sandbox
 */
export async function createSandboxEvent(
  client: StressClient,
): Promise<{ eventId: string; eventName: string }> {
  const timestamp = Date.now();
  const eventName = `${SANDBOX_PREFIX}${timestamp}`;
  const eventId = makeEventRowId();

  // Permissions : tout user avec le label eventId peut read/update
  const permissions = [
    `read("label:${eventId}")`,
    `update("label:${eventId}")`,
  ];

  const now = new Date();
  const dateStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const dateEnd = new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000).toISOString();

  await client.createRow(
    "main",
    {
      name: eventName,
      createdBy: client.userId,
      isActive: true,
      dateStart,
      dateEnd,
      teams: [],
      status: "proposition",
      allDates: [],
      contributors: [],
      meals: [],
      todos: [],
      description: `Sandbox stress test (auto-créé ${timestamp})`,
    },
    { rowId: eventId, permissions },
  );

  return { eventId, eventName };
}

/**
 * Fetch N recipes depuis la table "recettes".
 * Le serveur 1.9.0 ignore parfois `limit`, on slice côté client.
 */
export async function fetchRecipes(
  client: StressClient,
  count: number,
): Promise<{ uuid: string; name: string }[]> {
  const data = await client.listRows("recettes", { limit: count });
  return data.rows
    .slice(0, count)
    .map((r: any) => ({
      uuid: r.productHugoUuid || r.$id,
      name: r.name || r.title || "unknown",
    }));
}

/**
 * Crée M products dans le sandbox avec permissions label:eventId.
 * Utilise les productHugoUuid des recipes en round-robin.
 *
 * @returns liste des productIds créés (pour teardown ciblé)
 */
export async function createProducts(
  client: StressClient,
  eventId: string,
  recipes: { uuid: string; name: string }[],
  count: number,
): Promise<string[]> {
  if (recipes.length === 0) {
    throw new Error(
      "[stress-setup] Aucune recipe fetchée — impossible de créer des products",
    );
  }

  const permissions = [
    `read("label:${eventId}")`,
    `update("label:${eventId}")`,
  ];

  const productIds: string[] = [];

  // Création en batches parallèles de 10 pour éviter de surcharger le serveur
  const batchSize = 10;
  for (let offset = 0; offset < count; offset += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, count - offset) },
      (_, i) => offset + i,
    );

    const results = await Promise.all(
      batch.map(async (i) => {
        const recipe = recipes[i % recipes.length];
        const rowId = makeProductRowId(eventId, i);
        const data = {
          mainId: eventId,
          productHugoUuid: recipe.uuid,
          productName: `${PRODUCT_PREFIX}${i}`,
          status: "active",
          isSynced: true,
          store: JSON.stringify({ storeName: "", storeComment: "" }),
          updatedBy: client.userName || "stress-test",
        };

        try {
          await client.createRow("products", data, { rowId, permissions });
          return rowId;
        } catch (e: any) {
          console.warn(
            `[stress-setup] createRow product ${i} failed: ${e.message}`,
          );
          return null;
        }
      }),
    );

    productIds.push(...results.filter((r): r is string => r !== null));
  }

  return productIds;
}

// =============================================================================
// VÉRIFICATION
// =============================================================================

/**
 * Vérifie que le sandbox est bien en place : event existe + products visibles.
 */
export async function verifySetup(
  client: StressClient,
  eventId: string,
  expectedProductIds: string[],
): Promise<{
  eventOk: boolean;
  productsFound: number;
  expectedCount: number;
  ok: boolean;
}> {
  // Vérifier event
  let eventOk = false;
  try {
    await client.getRow("main", eventId);
    eventOk = true;
  } catch {
    eventOk = false;
  }

  // Vérifier products via getRow (un par un, best-effort)
  const sample = expectedProductIds.slice(0, 5); // check 5 max
  let productsFound = 0;
  for (const pid of sample) {
    try {
      await client.getRow("products", pid);
      productsFound++;
    } catch {
      // product absent
    }
  }

  return {
    eventOk,
    productsFound,
    expectedCount: expectedProductIds.length,
    ok: eventOk && productsFound === sample.length,
  };
}

// =============================================================================
// SETUP COMPLET (wrapper)
// =============================================================================

/**
 * Setup complet du sandbox : event + recipes + products + verify.
 * Retourne SandboxInfo si succès (avec productIds pour teardown).
 */
export async function setupSandbox(
  client: StressClient,
  config: { productsCount: number; recipesCount: number },
): Promise<SandboxInfo> {
  const t0 = performance.now();

  console.log("[stress-setup] Création du sandbox...");
  console.log(`  → ${config.productsCount} products depuis ${config.recipesCount} recipes`);

  // 1. Create event
  const { eventId, eventName } = await createSandboxEvent(client);
  console.log(`  ✓ Event créé : ${eventName} (${eventId})`);

  // 2. Fetch recipes
  const recipes = await fetchRecipes(client, config.recipesCount);
  console.log(`  ✓ ${recipes.length} recipes fetchées`);

  // 3. Create products
  const productIds = await createProducts(client, eventId, recipes, config.productsCount);
  console.log(`  ✓ ${productIds.length}/${config.productsCount} products créés`);

  // 4. Verify
  const verify = await verifySetup(client, eventId, productIds);
  if (!verify.ok) {
    console.warn(
      `[stress-setup] ⚠️ Vérification partielle : event=${verify.eventOk}, products=${verify.productsFound}/5`,
    );
  } else {
    console.log(`  ✓ Vérification OK`);
  }

  const durationMs = performance.now() - t0;
  console.log(`[stress-setup] Sandbox prêt en ${durationMs.toFixed(0)}ms`);

  return {
    eventId,
    eventName,
    createdAt: new Date().toISOString(),
    productIds,
  };
}

// =============================================================================
// TEARDOWN
// =============================================================================

/**
 * Teardown complet du sandbox : delete products (via IDs stockés) + delete event.
 * Tolérant aux erreurs (pour garanti cleanup partiel).
 *
 * Utilise sandbox.productIds directement (pas besoin de re-filter, queries[] non supporté).
 */
export async function teardownSandbox(
  client: StressClient,
  sandbox: SandboxInfo,
): Promise<{ deletedProducts: number; eventDeleted: boolean; errors: string[] }> {
  console.log(`[stress-setup] Teardown du sandbox ${sandbox.eventName}...`);

  let deletedProducts = 0;
  let eventDeleted = false;
  const errors: string[] = [];

  // 1. Delete tous les products via IDs stockés
  for (const productId of sandbox.productIds) {
    try {
      await client.deleteRow("products", productId);
      deletedProducts++;
    } catch (e: any) {
      // 404 = déjà supprimé, OK
      if (e.status !== 404) {
        errors.push(`delete product ${productId}: ${e.message}`);
      }
    }
  }
  console.log(`  ✓ ${deletedProducts}/${sandbox.productIds.length} products supprimés`);

  // 2. Delete l'event
  try {
    await client.deleteRow("main", sandbox.eventId);
    eventDeleted = true;
    console.log(`  ✓ Event supprimé`);
  } catch (e: any) {
    if (e.status !== 404) {
      errors.push(`delete event ${sandbox.eventId}: ${e.message}`);
    } else {
      eventDeleted = true; // déjà supprimé
    }
  }

  return { deletedProducts, eventDeleted, errors };
}
