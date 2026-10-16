import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";
import { pb, onRealtimeReconnect } from "$lib/db-sync/pb-sync";

// Enregistrer le Service Worker en production uniquement.
// NOTE: bloc volontairement brut (pré-juin) — la robustesse SW/PWA
// (modal de mise à jour, chunk guard) est l'Étape 9 du portage, différée.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // La SPA est servie à la racine (fin du sous-chemin /app/ de l'ère Hugo).
    // Un SW ancien au scope /app/ resterait actif sur ces URL : on le
    // désenregistre et on purge ses caches runtime orphelins (idempotent).
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        if (new URL(reg.scope).pathname.startsWith("/app/")) {
          void reg.unregister();
        }
      }
    });
    void caches.delete("hugo-api");
    void caches.delete("hugo-recipes");

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] Échec de l'enregistrement du Service Worker:", err);
    });
  });

  // Notifier l'utilisateur quand une nouvelle version du SW est activée
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[PWA] Nouvelle version activée — rechargement de la page");
    window.location.reload();
  });
}

/**
 * Time threshold under which we skip the post-reconnect resync.
 * 30s matches Firefox's budget-based throttling delay
 * (`dom.timeout.throttling_delay: 30000`). Below this, the SSE connection
 * hasn't been throttled to the point of being missed.
 */
const RESYNC_THRESHOLD_MS = 30_000;

/**
 * After this duration of hidden state, we assume the SSE connection is
 * potentially zombie (iOS kill, proxy timeout, Chrome intensive throttling
 * at 1/min). The PocketBase SDK reconnects the EventSource on its own —
 * we only check `isConnected` for diagnostics; a forced reconnect has no
 * public equivalent (the zombie SSE is healed by delta resync, not by
 * connection mechanics).
 */
const RECONNECT_THRESHOLD_MS = 5 * 60_000;

/**
 * Conservative default hidden duration when restoring from bfcache
 * (iOS Safari). The bfcache restore can happen without a prior
 * `visibilitychange` event, leaving `lastHiddenAt === null`. We assume
 * the page has been away long enough to warrant a resync (default >
 * RESYNC_THRESHOLD_MS).
 */
const BFCACHE_DEFAULT_HIDDEN_MS = 10 * 60_000;

type ResyncReason = "visibility" | "pageshow" | "sse-reconnect" | "online";

/** Timestamp (ms) at which the document last became hidden. */
let lastHiddenAt: number | null = null;
/** Pending debounce timer for coalescing rapid visibility/sse-reconnect triggers. */
let resyncTimeout: ReturnType<typeof setTimeout> | null = null;
/**
 * Re-entrancy guard: true while a resync's `await` is in flight.
 * A new trigger arriving mid-resync is dropped (with a warn log) instead of
 * stacking concurrent resyncs on top of each other. The per-store
 * `#revalidating` guards absorb the login/resync overlap.
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
  if (forceReconnect && !pb.realtime.isConnected) {
    console.warn(
      "[sync] SSE déconnecté — reconnexion laissée au SDK PocketBase (resync delta en cours)",
    );
  }

  console.log(`[sync] Resyncing active stores (reason=${reason})...`);
  const productsLastSyncBefore = productsStore.lastSync;
  // Lecture publique REC-2 : recipesStore est le seul store actif pour un
  // visiteur (les collections auth-scopées rejetteraient et afficheraient
  // à tort « Serveur indisponible »).
  const stores = globalState.isAuthenticated
    ? [
        productsStore.syncRevalidate(),
        recipesStore.syncRevalidate(),
        eventsStore.syncRevalidate(),
        materielStore.syncRevalidate(),
        teamdocsStore.syncRevalidate(),
        nativeTeamsStore.syncRevalidate(),
      ]
    : [recipesStore.syncRevalidate()];
  const results = await Promise.allSettled(stores);
  const failures = results.filter((r) => r.status === "rejected");
  // ProductsStore ne rethrow pas (politique allSettled du durcissement) :
  // un échec partiel se lit via lastSync non rafraîchi. null = store sans
  // event actif (jamais initialisé) — pas de signal exploitable.
  const productsStale =
    productsStore.lastSync !== null &&
    productsStore.lastSync === productsLastSyncBefore;
  if (failures.length > 0 || productsStale) {
    console.error(
      `[sync] Resync incomplet: ${failures.length} store(s) en échec, productsStale=${productsStale}`,
      failures,
    );
    statusBarStore.setServerStatus("unreachable");
  } else {
    console.log("[sync] All stores resynced successfully");
    statusBarStore.setServerStatus("connected");
  }
}

/**
 * Coalesces rapid triggers (visibility + sse-reconnect firing in the same
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
 * →visible round-trip if the page was hidden long enough that the SSE
 * connection state is suspect.
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    lastHiddenAt = Date.now();
    return;
  }
  const hiddenDuration = lastHiddenAt !== null ? Date.now() - lastHiddenAt : 0;
  lastHiddenAt = null;
  if (hiddenDuration < RESYNC_THRESHOLD_MS) return;
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
 * absence and trigger a resync.
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

/**
 * Resync sur retour de connexion réseau (event `online` du navigateur).
 * Une coupure réseau a très probablement tué la connexion SSE (proxy
 * timeout, heartbeat manqué) → le SDK reconnecte de son côté, le resync
 * delta rattrape les events manqués. Indépendamment du `lastHiddenAt` :
 * le user peut perdre le réseau sans changer d'onglet.
 */
function handleOnline(): void {
  scheduleResync({ forceReconnect: true, reason: "online" });
}

// Resync sur retour d'onglet après absence prolongée (prod + dev).
document.addEventListener("visibilitychange", handleVisibilityChange);

// Resync sur restauration bfcache iOS Safari.
// `event.persisted === true` est filtré dans le handler.
window.addEventListener("pageshow", handlePageShow);

// Resync sur reconnexion SSE (pertes réseau pendant onglet visible).
// Pas de forceReconnect ici : le callback PB_CONNECT ne signale pas une
// absence prolongée, juste une reconnexion réseau.
onRealtimeReconnect(() =>
  scheduleResync({ forceReconnect: false, reason: "sse-reconnect" }),
);

window.addEventListener("online", handleOnline);

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
