/**
 * Utilitaire pour recharger tous les stores de l'application
 * Utilisé en mode développement pour forcer le rafraîchissement des données
 *
 * Stratégies de rafraîchissement :
 * - reload() : Recharge les données depuis Appwrite (préserve le cache IDB)
 * - hardReset() : Vide TOUT (état Svelte + cache IDB) et recharge depuis zéro
 */

import { productsStore } from "../stores/ProductsStore.svelte";
import { recipesStore } from "../stores/RecipesStore.svelte";
import { nativeTeamsStore as teamsStore } from "../stores/NativeTeamsStore.svelte";
import { eventsStore } from "../stores/EventsStore.svelte";
import { materielStore } from "../stores/MaterielStore.svelte";
import { globalState } from "../stores/GlobalState.svelte";

/**
 * Rafraîchit tous les stores de l'application avec hard reset
 * Vide TOUT (état Svelte + cache IDB) et recharge depuis zéro
 *
 * @returns Un objet avec le statut de chaque rechargement
 */
export async function refreshAllStores(): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; error?: string }>;
}> {
  const results: Record<string, { success: boolean; error?: string }> = {};

  console.log("[StoresReload] 🔄 HARD RESET de tous les stores...");

  try {
    // 1. Hard reset des équipes
    try {
      await teamsStore.hardReset();
      results.teams = { success: true };
      console.log("[StoresReload] ✓ Teams hard reset OK");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      results.teams = { success: false, error: message };
      console.error("[StoresReload] ✗ Teams erreur:", message);
    }

    // 2. Hard reset des événements
    try {
      await eventsStore.hardReset();
      results.events = { success: true };
      console.log("[StoresReload] ✓ Events hard reset OK");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      results.events = { success: false, error: message };
      console.error("[StoresReload] ✗ Events erreur:", message);
    }

    // 3. Hard reset des recettes
    try {
      await recipesStore.hardReset();
      results.recipes = { success: true };
      console.log("[StoresReload] ✓ Recipes hard reset OK");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      results.recipes = { success: false, error: message };
      console.error("[StoresReload] ✗ Recipes erreur:", message);
    }

    // 4. Hard reset du matériel
    try {
      await materielStore.hardReset();
      results.materiel = { success: true };
      console.log("[StoresReload] ✓ Materiel hard reset OK");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      results.materiel = { success: false, error: message };
      console.error("[StoresReload] ✗ Materiel erreur:", message);
    }

    // 5. Hard reset des produits (seulement si un eventId est actif)
    try {
      const currentEventId = productsStore.currentMainId;
      if (currentEventId) {
        await productsStore.forceReload(currentEventId); // forceReload fait déjà un hard reset
        results.products = { success: true };
        console.log("[StoresReload] ✓ Products hard reset OK");
      } else {
        results.products = { success: true };
        console.log("[StoresReload] ⊘ Products skipé (pas d'eventId actif)");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      results.products = { success: false, error: message };
      console.error("[StoresReload] ✗ Products erreur:", message);
    }

    // Vérifier le succès global
    const allSuccess = Object.values(results).every((r) => r.success);

    console.log(
      `[StoresReload] Hard reset terminé: ${allSuccess ? "✓ SUCCÈS" : "⚠ PARTIEL"}`,
    );

    return { success: allSuccess, results };
  } catch (error) {
    console.error("[StoresReload] Erreur critique lors du hard reset:", error);
    return {
      success: false,
      results,
    };
  }
}
