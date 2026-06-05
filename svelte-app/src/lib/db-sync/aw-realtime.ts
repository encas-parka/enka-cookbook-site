/**
 * aw-sync — Centralized Realtime Registry
 *
 * Replaces the dual subscription system (aw-sync direct + RealtimeManager)
 * with a single `client.subscribe()` call that multiplexes all channels.
 *
 * Flow:
 * 1. Stores call `registerRealtime()` during setup (NO WebSocket yet)
 * 2. `initializeRealtime()` is called ONCE after all stores are ready
 * 3. Events are routed to the correct handler by channel matching
 * 4. Dynamic registrations (post-init) use `registerRealtimeDynamic()`
 *
 * Uses the legacy `client.subscribe()` URL-based protocol compatible with
 * Appwrite server 1.9.0 (self-hosted). The SDK v25 `Realtime` class uses
 * a message-based protocol only supported by Appwrite Cloud.
 *
 * @module aw-sync/realtime
 */

import {
	subscribe as appwriteSubscribe
} from '$lib/services/appwrite';

// =============================================================================
// TYPES
// =============================================================================

interface RealtimeRegistration {
	/** Unique identifier for this registration */
	id: string;
	/** Appwrite channels to subscribe to */
	channels: string[];
	/** Handler invoked when a matching event arrives */
	handler: (response: any) => void;
	/** Cleanup function for dynamic Appwrite subscriptions */
	appwriteUnsubscribe?: () => void;
	/**
	 * True while `#setupDynamicSubscription()` is in flight (between
	 * `registerDynamic()` returning and `appwriteSubscribe()` resolving).
	 * During this window, `appwriteUnsubscribe` is still undefined, so
	 * `unregister()` must defer its cleanup via `pendingPromise`.
	 */
	pending?: boolean;
	/**
	 * The promise returned by `#setupDynamicSubscription()`. `unregister()`
	 * awaits it (via `.finally()`) before deleting the registration, so
	 * the WebSocket acquisition either lands on the registration (and
	 * gets cleaned up) or fires after deletion (and gets its leaked
	 * `unsubscribe` invoked manually).
	 */
	pendingPromise?: Promise<void>;
}

// =============================================================================
// REGISTRY — Singleton
// =============================================================================

class AwRealtimeRegistry {
	/** All registered handlers (static + dynamic) */
	#registrations = new Map<string, RealtimeRegistration>();
	/** Main WebSocket unsubscribe function */
	#unsubscribe: (() => void) | null = null;
	/** Whether initializeRealtime() has been called */
	#isInitialized = false;
	/** Counter for generating unique dynamic IDs */
	#dynamicCounter = 0;
	/** Callback invoked when the WebSocket reconnects (client.connected event) */
	#onReconnect: (() => void) | null = null;
	/** Whether the first client.connected has been seen (to skip initial connection) */
	#hasConnectedOnce = false;
	/** Re-entrancy guard: blocks concurrent reconnectRealtime() calls */
	#isReconnecting = false;

	register(id: string, channels: string[], handler: (response: any) => void): void {
		if (this.#registrations.has(id)) {
			console.warn(`[aw-realtime] Registration "${id}" already exists, replacing.`);
			this.unregister(id);
		}
		this.#registrations.set(id, { id, channels, handler });
		console.log(`[aw-realtime] Registered: "${id}" → ${channels.join(', ')}`);
	}

	registerDynamic(
		channels: string[],
		handler: (response: any) => void
	): () => void {
		const id = `_dynamic_${++this.#dynamicCounter}`;
		// pending: true is set immediately so a synchronous unregister() (rare,
		// but possible if the caller discards the cleanup function right away)
		// will still see the registration as in-flight and defer its cleanup.
		const reg: RealtimeRegistration = {
			id,
			channels,
			handler,
			pending: true
		};
		this.#registrations.set(id, reg);
		console.log(`[aw-realtime] Registered dynamic "${id}" → ${channels.join(', ')}`);

		if (this.#isInitialized) {
			// Capture the promise BEFORE the microtask queue yields so
			// unregister() (called synchronously right after) can attach
			// its `.finally()` callback reliably.
			const promise = this.#setupDynamicSubscription(id, channels, handler);
			reg.pendingPromise = promise;
		}

		return () => {
			this.unregister(id);
		};
	}

	unregister(id: string): void {
		const reg = this.#registrations.get(id);

		// Race condition guard (M4): if the dynamic subscription is still being
		// acquired (appwriteSubscribe() hasn't resolved yet), `appwriteUnsubscribe`
		// is undefined. Defer the actual cleanup until the acquisition resolves —
		// by then, `#setupDynamicSubscription` will either have stored the
		// unsubscribe on the registration (we cleanup it) or have detected the
		// deletion and called unsubscribe() itself to close the leaked WS.
		if (reg?.pending && reg.pendingPromise) {
			reg.pendingPromise.finally(() => this.unregister(id));
			return;
		}

		try {
			reg?.appwriteUnsubscribe?.();
		} finally {
			this.#registrations.delete(id);
			console.log(`[aw-realtime] Unregistered: "${id}"`);
		}
	}

	async initialize(): Promise<void> {
		if (this.#isInitialized) {
			console.log('[aw-realtime] Already initialized');
			return;
		}

		const allChannels = [
			...new Set(
				Array.from(this.#registrations.values()).flatMap((r) => r.channels)
			)
		];

		if (allChannels.length === 0) {
			console.log('[aw-realtime] No channels to subscribe to.');
			this.#isInitialized = true;
			return;
		}

		try {
			console.log(
				`[aw-realtime] Initializing with ${allChannels.length} channels...`
			);

			this.#unsubscribe = await appwriteSubscribe(allChannels, (response: any) => {
				if (response.event === 'client.connected') {
					if (!this.#hasConnectedOnce) {
						this.#hasConnectedOnce = true;
						console.log('[aw-realtime] ✅ WebSocket connected for the first time');
					} else {
						console.log('[aw-realtime] ✅ WebSocket reconnected — triggering resync');
						this.#onReconnect?.();
					}
				}
				this.#routeEvent(response);
			});

			this.#isInitialized = true;
			console.log(
				`[aw-realtime] ✅ Connected with ${allChannels.length} channels, ${this.#registrations.size} handlers.`
			);
		} catch (err) {
			console.error('[aw-realtime] Initialization failed:', err);
			throw err;
		}
	}

	#routeEvent(response: any): void {
		for (const reg of this.#registrations.values()) {
			const hasMatchingChannel = response.channels?.some((ch: string) =>
				reg.channels.includes(ch)
			);
			if (hasMatchingChannel) {
				try {
					reg.handler(response);
				} catch (err) {
					console.error(`[aw-realtime] Handler "${reg.id}" error:`, err);
				}
			}
		}
	}

	async #setupDynamicSubscription(
		id: string,
		channels: string[],
		handler: (response: any) => void
	): Promise<void> {
		try {
			const unsubscribe = await appwriteSubscribe(channels, (response: any) => {
				handler(response);
			});
			const reg = this.#registrations.get(id);
			if (reg) {
				reg.appwriteUnsubscribe = unsubscribe;
				reg.pending = false;
			} else {
				// Registration was unregistered during the await — close the
				// WebSocket we just acquired to prevent a leak. The Appwrite SDK
				// also leaks its heartbeat setInterval (SDK bug), but the WS
				// closure at least stops new events; the interval will throw a
				// DOMException on its next tick on a dead socket (non-fatal).
				console.warn(
					`[aw-realtime] Dynamic "${id}" unregistered during setup — closing leaked WS`
				);
				unsubscribe();
			}
			console.log(`[aw-realtime] ✅ Dynamic channels added: ${channels.join(', ')}`);
		} catch (err) {
			// If the registration still exists, clear `pending` so unregister()
			// (potentially called from the `.finally()` chain) doesn't re-defer.
			const reg = this.#registrations.get(id);
			if (reg) {
				reg.pending = false;
			}
			console.error('[aw-realtime] Dynamic subscription failed:', err);
		}
	}

	get isInitialized(): boolean {
		return this.#isInitialized;
	}

	get registrationCount(): number {
		return this.#registrations.size;
	}

	setOnReconnect(callback: (() => void) | null): void {
		this.#onReconnect = callback;
	}

	destroy(): void {
		for (const reg of this.#registrations.values()) {
			if (reg.appwriteUnsubscribe) {
				reg.appwriteUnsubscribe();
			}
		}
		if (this.#unsubscribe) {
			this.#unsubscribe();
			this.#unsubscribe = null;
		}
		this.#registrations.clear();
		this.#isInitialized = false;
		this.#hasConnectedOnce = false;
		this.#onReconnect = null;
		console.log('[aw-realtime] Destroyed. WebSocket closed.');
	}

	/**
	 * Force-reconnect all WebSockets (main + dynamic) while preserving the
	 * registration Map. Use this to recover from WS zombie state (Appwrite SDK
	 * #11271: `readyState === OPEN` but no more events).
	 *
	 * Difference vs. `destroy()`:
	 * - `destroy()` clears the Map and resets all flags (full teardown)
	 * - `reconnectRealtime()` keeps the Map and `#hasConnectedOnce` intact,
	 *   only re-establishes the WebSocket connections.
	 *
	 * The new main WebSocket's `client.connected` callback always invokes
	 * `#onReconnect()` (forced reconnect = always signal a resync is needed).
	 *
	 * Concurrent calls are blocked via `#isReconnecting`.
	 */
	async reconnectRealtime(): Promise<void> {
		if (this.#isReconnecting) {
			console.warn('[aw-realtime] Reconnect already in progress, skipping');
			return;
		}
		if (!this.#isInitialized) {
			throw new Error('[aw-realtime] Cannot reconnect: not initialized');
		}

		this.#isReconnecting = true;
		console.log('[aw-realtime] 🔄 Forcing WS reconnect...');

		try {
			// 1. Snapshot registrations BEFORE closing anything. Important because
			//    closing a dynamic sub could (in theory) trigger a cleanup that
			//    mutates the Map. Snapshotting isolates the iteration from mutations.
			const snapshot = Array.from(this.#registrations.values());

			// 2. Close all existing WebSockets (main + dynamic)
			this.#unsubscribe?.();
			this.#unsubscribe = null;
			for (const reg of snapshot) {
				if (reg.appwriteUnsubscribe) {
					try {
						reg.appwriteUnsubscribe();
					} catch (err) {
						console.error(
							`[aw-realtime] Error closing dynamic sub "${reg.id}":`,
							err
						);
					}
					reg.appwriteUnsubscribe = undefined;
				}
			}

			// 3. Recreate the main WebSocket with static channels (batch + dedup).
			//    Dynamic subs are excluded — they each get their own WebSocket.
			const staticRegs = snapshot.filter((r) => !r.id.startsWith('_dynamic_'));
			const staticChannels = [
				...new Set(staticRegs.flatMap((r) => r.channels))
			];

			if (staticChannels.length > 0) {
				try {
					this.#unsubscribe = await appwriteSubscribe(
						staticChannels,
						(response: any) => {
							if (response.event === 'client.connected') {
								// Forced reconnect: always signal resync (vs. initialize()
								// which uses #hasConnectedOnce to differentiate first-time).
								console.log('[aw-realtime] ✅ Reconnected (forced)');
								this.#onReconnect?.();
							}
							this.#routeEvent(response);
						}
					);
				} catch (err) {
					// Rollback: ensure no partial state on the main WS slot
					this.#unsubscribe = null;
					console.error('[aw-realtime] ❌ Main WS reconnect failed:', err);
					throw err;
				}
			}

			// 4. Recreate each dynamic WebSocket with its original channels/handler.
			//    A failure on one dynamic sub does NOT block the others (best-effort).
			for (const reg of snapshot) {
				if (reg.id.startsWith('_dynamic_')) {
					try {
						const unsub = await appwriteSubscribe(
							reg.channels,
							(response: any) => {
								reg.handler(response);
							}
						);
						reg.appwriteUnsubscribe = unsub;
					} catch (err) {
						console.error(
							`[aw-realtime] ❌ Dynamic sub "${reg.id}" reconnect failed:`,
							err
						);
						// Continue with the remaining dynamic subs
					}
				}
			}

			console.log(
				`[aw-realtime] ✅ WS reconnect complete (${staticRegs.length} static + ${
					snapshot.length - staticRegs.length
				} dynamic)`
			);
		} finally {
			this.#isReconnecting = false;
		}
	}
}

const awRealtimeRegistry = new AwRealtimeRegistry();

export function registerRealtime(
	id: string,
	channels: string[],
	handler: (response: any) => void
): void {
	awRealtimeRegistry.register(id, channels, handler);
}

export function registerRealtimeDynamic(
	channels: string[],
	handler: (response: any) => void
): () => void {
	return awRealtimeRegistry.registerDynamic(channels, handler);
}

export function unregisterRealtime(id: string): void {
	awRealtimeRegistry.unregister(id);
}

export async function initializeRealtime(): Promise<void> {
	await awRealtimeRegistry.initialize();
}

export function destroyRealtime(): void {
	awRealtimeRegistry.destroy();
}

export async function reconnectRealtime(): Promise<void> {
	await awRealtimeRegistry.reconnectRealtime();
}

export function isRealtimeInitialized(): boolean {
	return awRealtimeRegistry.isInitialized;
}

export function setRealtimeOnReconnect(callback: (() => void) | null): void {
	awRealtimeRegistry.setOnReconnect(callback);
}
