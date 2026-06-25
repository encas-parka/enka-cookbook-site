import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import {
  setRealtimeOnReconnect,
  reconnectRealtime,
} from "$lib/db-sync/aw-realtime";
import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";
import { updateStore } from "$lib/stores/UpdateStore.svelte";
import { handleChunkError, isChunkLoadError } from "$lib/sw-reload-guard";

/**
 * Time threshold under which we skip the post-reconnect resync.
 * 30s matches Firefox's budget-based throttling delay
 * (`dom.timeout.throttling_delay: 30000`). Below this, the WebSocket is
 * considered alive — the SDK's heartbeat setTimeout hasn't been throttled
 * to the point of being missed.
 */
const RESYNC_THRESHOLD_MS = 30_000;

/**
 * After this duration of hidden state, we assume the WebSocket is potentially
 * zombie (Appwrite SDK bug #11271, iOS kill, proxy timeout, Chrome intensive
 * throttling at 1/min). We force a fresh WebSocket connection before resyncing.
 */
const RECONNECT_THRESHOLD_MS = 5 * 60_000;

/**
 * Conservative default hidden duration when restoring from bfcache
 * (iOS Safari). The bfcache restore can happen without a prior
 * `visibilitychange` event, leaving `lastHiddenAt === null`. We assume
 * the page has been away long enough to warrant both a resync AND a
 * forced WebSocket reconnect (default > RECONNECT_THRESHOLD_MS).
 */
const BFCACHE_DEFAULT_HIDDEN_MS = 10 * 60_000;

type ResyncReason = "visibility" | "pageshow" | "ws-reconnect" | "online";

/** Timestamp (ms) at which the document last became hidden. */
let lastHiddenAt: number | null = null;
/** Pending debounce timer for coalescing rapid visibility/ws-reconnect triggers. */
let resyncTimeout: ReturnType<typeof setTimeout> | null = null;
/**
 * Re-entrancy guard: true while a resync's `await` is in flight.
 * A new trigger arriving mid-resync is dropped (with a warn log) instead of
 * stacking concurrent resyncs on top of each other.
 */
let isResyncing = false;

/**
 * Runs the actual resync work — separated from `scheduleResync` so the
 * debounce/guard logic is testable in isolation. Called only by
 * `scheduleResync` after the debounce window elapses.
 */
async function performResync(
  forceReconnect: boolean,
  reason: ResyncReason,
): Promise<void> {
  if (forceReconnect) {
    console.log("[sync] Forcing WS reconnect + resync");
    try {
      await reconnectRealtime();
    } catch (err) {
      console.error(
        "[sync] reconnectRealtime() failed, continuing with resync:",
        err,
      );
    }
  }

  console.log(`[sync] Resyncing active stores (reason=${reason})...`);
  const results = await Promise.allSettled([
    productsStore.syncRevalidate(),
    recipesStore.syncRevalidate(),
    eventsStore.syncRevalidate(),
    materielStore.syncRevalidate(),
    teamdocsStore.syncRevalidate(),
    nativeTeamsStore.syncRevalidate(),
  ]);
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[sync] ${failures.length} store(s) failed to resync:`,
      failures,
    );
    statusBarStore.setServerStatus("unreachable");
  } else {
    console.log("[sync] All stores resynced successfully");
    statusBarStore.setServerStatus("connected");
  }
}

/**
 * Coalesces rapid triggers (visibility + ws-reconnect firing in the same
 * tick, or multiple visibility transitions within 500ms) into a single
 * resync. Drops triggers arriving while a resync is already in flight.
 */
function scheduleResync({
  forceReconnect,
  reason,
}: {
  forceReconnect: boolean;
  reason: ResyncReason;
}): void {
  if (isResyncing) {
    console.warn(
      `[sync] Resync already in progress, skipping trigger (reason=${reason})`,
    );
    return;
  }
  if (resyncTimeout) clearTimeout(resyncTimeout);
  resyncTimeout = setTimeout(async () => {
    resyncTimeout = null;
    isResyncing = true;
    try {
      await performResync(forceReconnect, reason);
    } finally {
      isResyncing = false;
    }
  }, 500);
}

/**
 * Visibility change handler. Only triggers a resync on the visible→hidden
 * →visible round-trip if the page was hidden long enough that the WebSocket
 * state is suspect. Forces a WS reconnect past RECONNECT_THRESHOLD_MS.
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    lastHiddenAt = Date.now();
    return;
  }
  const hiddenDuration = lastHiddenAt !== null ? Date.now() - lastHiddenAt : 0;
  lastHiddenAt = null;
  if (hiddenDuration < RESYNC_THRESHOLD_MS) return;
  // Check SW si caché plus de 4h (délégué au store)
  updateStore.checkForUpdate(hiddenDuration);
  scheduleResync({
    forceReconnect: hiddenDuration > RECONNECT_THRESHOLD_MS,
    reason: "visibility",
  });
}

/**
 * Handles iOS Safari bfcache restore. The `pageshow` event fires with
 * `event.persisted === true` when the page is restored from bfcache —
 * a path that bypasses normal `load` and `visibilitychange` events.
 * If `lastHiddenAt` is null (the typical bfcache case), we assume a long
 * absence and trigger both resync + reconnect.
 */
function handlePageShow(event: PageTransitionEvent): void {
  if (!event.persisted) return;
  const hiddenDuration =
    lastHiddenAt !== null
      ? Date.now() - lastHiddenAt
      : BFCACHE_DEFAULT_HIDDEN_MS;
  lastHiddenAt = null;
  if (hiddenDuration < RESYNC_THRESHOLD_MS) return;
  scheduleResync({
    forceReconnect: hiddenDuration > RECONNECT_THRESHOLD_MS,
    reason: "pageshow",
  });
}

// Filet de sécurité : si un chunk JS échoue à charger (build déployé,
// onglet ouvert en arrière-plan, precache nettoyé…), on tente un reload
// de réparation. Borné à MAX_RELOADS tentatives consécutives pour éviter
// une boucle infinie (cf. sw-reload-guard.ts). Réarmé après un boot réussi.
window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) handleChunkError();
});

// Le nouveau SW reste en "waiting" (pas de skipWaiting/clientsClaim).
// L'utilisateur est informé via un modal, et le reload n'est déclenché
// qu'à la fermeture du modal → élimine la race condition des chunks 404.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker
      .register("/app/sw.js")
      .catch((err) => {
        console.warn("[SW] Échec de l'enregistrement:", err);
        return null;
      });

    if (!registration) return;

    // Stocker la registration pour applyUpdate()
    updateStore.setRegistration(registration);

    // Détecter un nouveau SW installé → signaler au store → ouvrir le modal
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // Un nouveau SW est installé et en attente (waiting)
          console.log(
            "[SW] Nouvelle version installée, en attente d'activation",
          );
          updateStore.signalUpdateAvailable().catch(() => {});
        }
      });
    });

    // Si un SW est déjà en waiting au chargement de la page
    // (cas : page rechargée manuellement mais SW toujours en attente)
    if (registration.waiting && navigator.serviceWorker.controller) {
      updateStore.signalUpdateAvailable().catch(() => {});
    }
  });
}

// Resync sur retour d'onglet après absence prolongée (prod + dev).
// Toujours branché, indépendamment du SW, pour couvrir le cas dev.
document.addEventListener("visibilitychange", handleVisibilityChange);

// Resync sur restauration bfcache iOS Safari.
// `event.persisted === true` est filtré dans le handler.
window.addEventListener("pageshow", handlePageShow);

// Resync sur reconnexion WebSocket (pertes réseau pendant onglet visible).
// Pas de forceReconnect ici : le callback `client.connected` ne signale
// pas une absence prolongée, juste une reconnexion réseau.
setRealtimeOnReconnect(() =>
  scheduleResync({ forceReconnect: false, reason: "ws-reconnect" }),
);

/**
 * Resync sur retour de connexion réseau (event `online` du navigateur).
 * Une coupure réseau a très probablement tué le WebSocket (proxy timeout,
 * Appwrite SDK heartbeat manqué) → on force la reconnexion + delta sync
 * pour rattraper les events manqués. Indépendamment du `lastHiddenAt` :
 * le user peut perdre le réseau sans changer d'onglet.
 */
function handleOnline(): void {
  scheduleResync({ forceReconnect: true, reason: "online" });
}
window.addEventListener("online", handleOnline);

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
