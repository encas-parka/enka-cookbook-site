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
		this.#registrations.set(id, { id, channels, handler });
		console.log(`[aw-realtime] Registered dynamic "${id}" → ${channels.join(', ')}`);

		if (this.#isInitialized) {
			this.#setupDynamicSubscription(id, channels, handler);
		}

		return () => {
			this.unregister(id);
		};
	}

	unregister(id: string): void {
		const reg = this.#registrations.get(id);
		try {
			reg?.appwriteUnsubscribe?.();
		} finally {
			this.#registrations.delete(id);
			console.log(`[aw-realtime] Unregistered: "${id}"}`);
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
			}
			console.log(`[aw-realtime] ✅ Dynamic channels added: ${channels.join(', ')}`);
		} catch (err) {
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

export function isRealtimeInitialized(): boolean {
	return awRealtimeRegistry.isInitialized;
}

export function setRealtimeOnReconnect(callback: (() => void) | null): void {
	awRealtimeRegistry.setOnReconnect(callback);
}
