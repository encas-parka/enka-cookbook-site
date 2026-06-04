import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { setRealtimeOnReconnect } from "$lib/db-sync/aw-realtime";

/**
 * Resyncs data for all currently active stores.
 * Called on visibility change (tab becomes visible) and WebSocket reconnection.
 * Stores that aren't initialized are safely skipped by their internal guards
 * (!userId, !currentMainId, etc.).
 * Debounced to avoid double sync when both signals fire simultaneously.
 */
let resyncTimeout: ReturnType<typeof setTimeout> | null = null;
function resyncActiveStores(): void {
  if (resyncTimeout) clearTimeout(resyncTimeout);
  resyncTimeout = setTimeout(async () => {
    resyncTimeout = null;
    console.log("[sync] Resyncing active stores...");
    const results = await Promise.allSettled([
      productsStore.syncFromAppwrite(),
      recipesStore.syncFromAppwrite(),
      eventsStore.syncFromRemote(),
      materielStore.syncFromRemote(),
      teamdocsStore.syncFromRemote(),
      nativeTeamsStore.syncFromRemote(),
    ]);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[sync] ${failures.length} store(s) failed to resync:`, failures);
    } else {
      console.log("[sync] All stores resynced successfully");
    }
  }, 500);
}

// Enregistrer le Service Worker en production uniquement
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker
      .register("/app/sw.js")
      .catch((err) => {
        console.warn("[PWA] Échec de l'enregistrement du Service Worker:", err);
        return null;
      });

    // Vérification quand l'utilisateur revient sur l'onglet
    // (timers throttlés en arrière-plan sur mobile, ce check compense)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // SW update pour les mises à jour JS
        registration?.update().catch(() => {});
        // Resync data pour rattraper les événements manqués en arrière-plan
        resyncActiveStores();
      }
    });
  });

  // Auto-reload quand une nouvelle version du SW est activée
  // (skipWaiting + clientsClaim dans workbox → activation immédiate)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[PWA] Nouvelle version activée — rechargement de la page");
    window.location.reload();
  });
} else {
  // En dev, pas de SW mais on veut quand même le resync sur visibility
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resyncActiveStores();
    }
  });
}

// Resync sur reconnexion WebSocket (pertes réseau pendant onglet visible)
setRealtimeOnReconnect(resyncActiveStores);

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
