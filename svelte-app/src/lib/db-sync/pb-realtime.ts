/**
 * pb-realtime — signaux de connexion SSE PocketBase (connect / disconnect).
 *
 * Portage du durcissement Appwrite (a25f3fe8 P1 + 564cfffd + debounce
 * 4c4f4692) adapté au SDK PocketBase, qui reconnecte l'EventSource tout seul
 * (backoff interne ~2 s) :
 *
 *  - `PB_CONNECT` : émis par le SDK à chaque (re)connexion établie. La
 *    première est consommée (`hasConnectedOnce` — c'est la connexion
 *    initiale du login) ; toute suivante signale une reconnexion et notifie
 *    les listeners (le resync delta orchestrateur de main.ts).
 *  - `pb.realtime.onDisconnect` : invoqué par le SDK à CHAQUE tentative de
 *    reconnexion (cycle de backoff) — le debounce 3 s est OBLIGATOIRE, sans
 *    lui la StatusBar clignoterait « Connexion perdue » à chaque
 *    micro-coupure. Un reconnect dans la fenêtre de debounce annule
 *    l'affichage (micro-coupure guérie avant d'avoir été montrée).
 *
 * Cycle de vie auth : `initRealtimeSignals()` au login,
 * `teardownRealtimeSignals()` au logout (câblé dans GlobalState, pattern
 * destroy() des stores). La souscription `PB_CONNECT` vit dans la map de
 * souscriptions du SDK : oubliée au logout, elle maintiendrait l'EventSource
 * ouvert (zombie) et bloquerait l'autoclose.
 *
 * @module db-sync/pb-realtime
 */

import { pb } from './pb';
import { statusBarStore } from '$lib/stores/StatusBarStore.svelte';

/**
 * Debounce de l'état « déconnecté ». Doit rester > au backoff interne du SDK
 * (~2 s par cycle de reconnexion) : onDisconnect tire à chaque cycle, un
 * affichage immédiat clignoterait.
 */
const DISCONNECT_DEBOUNCE_MS = 3_000;

let hasConnectedOnce = false;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pbConnectUnsub: (() => Promise<void>) | null = null;
const reconnectListeners = new Set<() => void>();

function clearDisconnectTimer(): void {
	if (disconnectTimer !== null) {
		clearTimeout(disconnectTimer);
		disconnectTimer = null;
	}
}

/**
 * Active les signaux SSE (idempotent). Appelé au login, AVANT la souscription
 * des stores : la connexion initiale consomme `hasConnectedOnce` ici, de sorte
 * que tout PB_CONNECT ultérieur soit traité comme une reconnexion (resync).
 *
 * Résilient : un échec de connexion au moment du login (serveur momentanément
 * injoignable — le SDK rejette la 1re tentative) est loggé sans casser le
 * flux d'authentification ; les signaux resteront inactifs jusqu'au prochain
 * login, le resync par visibilitychange/online de main.ts couvre entre-temps.
 */
async function initRealtimeSignals(): Promise<void> {
	if (pbConnectUnsub) return;

	hasConnectedOnce = false;

	pb.realtime.onDisconnect = (activeSubscriptions: string[]) => {
		// Débranchement propre (plus aucun abonné — ex. teardown logout) :
		// ce n'est pas une panne, ne pas afficher « Connexion perdue ».
		if (activeSubscriptions.length === 0) return;
		clearDisconnectTimer();
		disconnectTimer = setTimeout(() => {
			disconnectTimer = null;
			console.warn(
				'[pb-realtime] SSE déconnecté de façon stable — serveur injoignable',
			);
			statusBarStore.setServerStatus('disconnected');
		}, DISCONNECT_DEBOUNCE_MS);
	};

	try {
		pbConnectUnsub = await pb.realtime.subscribe('PB_CONNECT', () => {
			// Reconnecté avant l'expiration du debounce : micro-coupure
			// guérie, jamais affichée.
			clearDisconnectTimer();
			if (!hasConnectedOnce) {
				hasConnectedOnce = true;
				console.log('[pb-realtime] SSE connecté (première connexion)');
				return;
			}
			console.log('[pb-realtime] SSE reconnecté — resync orchestrateur');
			for (const listener of reconnectListeners) listener();
		});
	} catch (err) {
		console.error('[pb-realtime] Abonnement PB_CONNECT échoué:', err);
		pb.realtime.onDisconnect = undefined;
		hasConnectedOnce = false;
	}
}

/**
 * Enregistre un callback invoqué à chaque reconnexion SSE (après la
 * première). Retourne la fonction de désenregistrement.
 */
function onRealtimeReconnect(listener: () => void): () => void {
	reconnectListeners.add(listener);
	return () => reconnectListeners.delete(listener);
}

/**
 * Désactive les signaux SSE et remet le statut serveur à zéro. Appelé au
 * logout AVANT la destruction des stores : la souscription PB_CONNECT est
 * retirée en premier, si bien que l'autoclose final du SDK (dernier
 * unsubscribe des stores) se produit sans abonné résiduel.
 */
async function teardownRealtimeSignals(): Promise<void> {
	clearDisconnectTimer();
	if (pbConnectUnsub) {
		await pbConnectUnsub();
		pbConnectUnsub = null;
	}
	pb.realtime.onDisconnect = undefined;
	hasConnectedOnce = false;
	statusBarStore.setServerStatus(null);
}

export { initRealtimeSignals, onRealtimeReconnect, teardownRealtimeSignals };
