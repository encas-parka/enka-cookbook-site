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

	// =========================================================================
	// REGISTRATION (pre-init)
	// =========================================================================

	/**
	 * Registers channels + handler WITHOUT subscribing.
	 * Used during store setup, BEFORE `initializeRealtime()` is called.
	 *
	 * @param id - Unique identifier (e.g. collection name or store name)
	 * @param channels - Appwrite channel strings
	 * @param handler - Callback for matching events
	 */
	register(id: string, channels: string[], handler: (response: any) => void): void {
		if (this.#registrations.has(id)) {
			console.warn(`[aw-realtime] Registration "${id}" already exists, replacing.`);
			this.unregister(id);
		}

		this.#registrations.set(id, { id, channels, handler });
		console.log(`[aw-realtime] Registered: "${id}" → ${channels.join(', ')}`);
	}

	// =========================================================================
	// DYNAMIC REGISTRATION (post-init)
	// =========================================================================

	/**
	 * Registers channels + handler and subscribes immediately if already initialized.
	 * Used by stores that initialize AFTER the boot sequence (e.g. EventMaterielStore).
	 *
	 * @param channels - Appwrite channel strings
	 * @param handler - Callback for matching events
	 * @returns Cleanup function to unregister
	 */
	registerDynamic(
		channels: string[],
		handler: (response: any) => void
	): () => void {
		const id = `_dynamic_${++this.#dynamicCounter}`;
		this.#registrations.set(id, { id, channels, handler });
		console.log(`[aw-realtime] Registered dynamic "${id}" → ${channels.join(', ')}`);

		// If already initialized, subscribe these channels on the existing WebSocket
		if (this.#isInitialized) {
			this.#setupDynamicSubscription(channels, handler);
		}

		// Return cleanup function
		return () => {
			this.unregister(id);
		};
	}

	// =========================================================================
	// UNREGISTRATION
	// =========================================================================

	/**
	 * Removes a registration by ID.
	 * Note: for the main subscription, channels are not removed from the active
	 * WebSocket (Appwrite SDK limitation). The handler simply won't be called.
	 */
	unregister(id: string): void {
		const removed = this.#registrations.delete(id);
		if (removed) {
			console.log(`[aw-realtime] Unregistered: "${id}"`);
		}
	}

	// =========================================================================
	// INITIALIZATION — single WebSocket connection
	// =========================================================================

	/**
	 * Opens ONE WebSocket connection with ALL registered channels.
	 * Must be called AFTER all stores have called `registerRealtime()`.
	 *
	 * Events are routed to the correct handler by matching `response.channels`
	 * against each registration's channels.
	 */
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
				// Route event to all matching handlers
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

	// =========================================================================
	// EVENT ROUTING
	// =========================================================================

	/**
	 * Routes a realtime event to all matching handlers.
	 * A handler matches if any of its channels appear in `response.channels`.
	 */
	#routeEvent(response: any): void {
		for (const reg of this.#registrations.values()) {
			const hasMatchingChannel = response.channels?.some((ch: string) =>
				reg.channels.includes(ch)
			);
			if (hasMatchingChannel) {
				try {
					reg.handler(response);
				} catch (err) {
					console.error(
						`[aw-realtime] Handler "${reg.id}" error:`,
						err
					);
				}
			}
		}
	}

	// =========================================================================
	// DYNAMIC SUBSCRIPTION (post-init)
	// =========================================================================

	/**
	 * Subscribes to additional channels on the existing WebSocket connection.
	 * The Appwrite SDK handles adding channels to the active connection.
	 */
	async #setupDynamicSubscription(
		channels: string[],
		handler: (response: any) => void
	): Promise<void> {
		try {
			// The SDK reuses the existing WebSocket connection
			await appwriteSubscribe(channels, (response: any) => {
				handler(response);
			});
			console.log(
				`[aw-realtime] ✅ Dynamic channels added: ${channels.join(', ')}`
			);
		} catch (err) {
			console.error('[aw-realtime] Dynamic subscription failed:', err);
		}
	}

	// =========================================================================
	// LIFECYCLE
	// =========================================================================

	/**
	 * Returns whether `initializeRealtime()` has been called.
	 * Stores can check this to decide between `register()` and `registerDynamic()`.
	 */
	get isInitialized(): boolean {
		return this.#isInitialized;
	}

	/**
	 * Returns the total number of registered handlers.
	 */
	get registrationCount(): number {
		return this.#registrations.size;
	}

	/**
	 * Closes the WebSocket and clears all registrations.
	 * Used on logout.
	 */
	destroy(): void {
		if (this.#unsubscribe) {
			this.#unsubscribe();
			this.#unsubscribe = null;
		}
		this.#registrations.clear();
		this.#isInitialized = false;
		console.log('[aw-realtime] Destroyed. WebSocket closed.');
	}
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

const awRealtimeRegistry = new AwRealtimeRegistry();

/**
 * Registers channels + handler for deferred subscription.
 * Call during store setup, before `initializeRealtime()`.
 */
export function registerRealtime(
	id: string,
	channels: string[],
	handler: (response: any) => void
): void {
	awRealtimeRegistry.register(id, channels, handler);
}

/**
 * Registers channels + handler for immediate subscription (post-init).
 * Returns a cleanup function.
 */
export function registerRealtimeDynamic(
	channels: string[],
	handler: (response: any) => void
): () => void {
	return awRealtimeRegistry.registerDynamic(channels, handler);
}

/**
 * Removes a registration by ID.
 */
export function unregisterRealtime(id: string): void {
	awRealtimeRegistry.unregister(id);
}

/**
 * Opens a single WebSocket connection with all registered channels.
 * Call AFTER all stores have registered.
 */
export async function initializeRealtime(): Promise<void> {
	await awRealtimeRegistry.initialize();
}

/**
 * Closes the WebSocket and clears all registrations.
 * Call on logout.
 */
export function destroyRealtime(): void {
	awRealtimeRegistry.destroy();
}

/**
 * Whether the centralized realtime has been initialized.
 */
export function isRealtimeInitialized(): boolean {
	return awRealtimeRegistry.isInitialized;
}
