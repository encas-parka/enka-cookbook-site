/**
 * aw-sync — Realtime Layer (SDK v25 `Realtime` class)
 *
 * Wraps `new Realtime(client)` from the Appwrite SDK v25.
 * Each subscription is independent — no more static/dynamic batch multiplexing.
 *
 * Flow:
 * 1. Stores call `subscribeRealtime()` at any time (lazy WebSocket init)
 * 2. Events are delivered directly by the SDK per-subscription
 * 3. `onOpen()`/`onClose()` hooks update StatusBarStore
 * 4. `destroyRealtime()` on logout closes everything
 *
 * @module aw-sync/realtime
 */

import { Realtime, type RealtimeSubscription } from 'appwrite';
import { getAppwriteInstances } from '$lib/services/appwrite';
import { statusBarStore } from '$lib/stores/StatusBarStore.svelte';

class AwRealtime {
	#realtime: Realtime | null = null;
	#subscriptions = new Map<string, RealtimeSubscription>();
	#isInitialized = false;
	#hasConnectedOnce = false;
	#onReconnect: (() => void) | null = null;
	/** Debounce timer — delays 'disconnected' status to avoid flashing during SDK auto-reconnect */
	#disconnectTimer: ReturnType<typeof setTimeout> | null = null;

	async #ensureRealtime(): Promise<Realtime> {
		if (!this.#realtime) {
			const { client } = await getAppwriteInstances();
			this.#realtime = new Realtime(client);

			this.#realtime.onOpen(() => {
				// Cancel pending disconnect notification (SDK reconnected quickly)
				if (this.#disconnectTimer) {
					clearTimeout(this.#disconnectTimer);
					this.#disconnectTimer = null;
				}

				if (!this.#hasConnectedOnce) {
					this.#hasConnectedOnce = true;
					statusBarStore.setServerStatus('connected');
					console.log('[aw-realtime] ✅ WebSocket connected');
				} else {
					statusBarStore.setServerStatus('connected');
					console.log('[aw-realtime] ✅ WebSocket reconnected');
					this.#onReconnect?.();
				}
			});

			this.#realtime.onClose(() => {
				// Debounce: wait 3s before declaring disconnected.
				// The SDK auto-reconnects in ~1s — if onOpen fires first, this timer is cancelled.
				if (this.#disconnectTimer) clearTimeout(this.#disconnectTimer);
				this.#disconnectTimer = setTimeout(() => {
					this.#disconnectTimer = null;
					statusBarStore.setServerStatus('disconnected');
					console.log('[aw-realtime] ⚠️ WebSocket disconnected (confirmed after 3s)');
				}, 3000);
			});
		}
		return this.#realtime;
	}

	async subscribe(
		id: string,
		channels: string[],
		handler: (response: any) => void
	): Promise<() => void> {
		const rt = await this.#ensureRealtime();

		const existing = this.#subscriptions.get(id);
		if (existing) {
			await existing.unsubscribe().catch(() => {});
		}

		const sub = await rt.subscribe(channels, handler);
		this.#subscriptions.set(id, sub);
		this.#isInitialized = true;

		console.log(`[aw-realtime] Subscribed: "${id}" → ${channels.join(', ')}`);

		return () => this.unsubscribe(id);
	}

	async unsubscribe(id: string): Promise<void> {
		const sub = this.#subscriptions.get(id);
		if (sub) {
			this.#subscriptions.delete(id);
			await sub.unsubscribe().catch((err) => {
				console.warn(`[aw-realtime] Unsubscribe "${id}" error:`, err);
			});
			console.log(`[aw-realtime] Unsubscribed: "${id}"`);
		}
	}

	setOnReconnect(callback: (() => void) | null): void {
		this.#onReconnect = callback;
	}

	get isInitialized(): boolean {
		return this.#isInitialized;
	}

	async destroy(): Promise<void> {
		if (this.#disconnectTimer) {
			clearTimeout(this.#disconnectTimer);
			this.#disconnectTimer = null;
		}
		for (const [id, sub] of this.#subscriptions) {
			await sub.unsubscribe().catch(() => {});
		}
		this.#subscriptions.clear();
		if (this.#realtime) {
			await this.#realtime.disconnect();
			this.#realtime = null;
		}
		this.#isInitialized = false;
		this.#hasConnectedOnce = false;
		this.#onReconnect = null;
		statusBarStore.setServerStatus(null);
		console.log('[aw-realtime] Destroyed.');
	}
}

const awRealtime = new AwRealtime();

export function subscribeRealtime(
	id: string,
	channels: string[],
	handler: (response: any) => void
): () => void {
	let cleaned = false;
	awRealtime.subscribe(id, channels, handler).catch((err) => {
		console.error(`[aw-realtime] Subscribe "${id}" failed:`, err);
	});
	return () => {
		if (!cleaned) {
			cleaned = true;
			awRealtime.unsubscribe(id).catch(() => {});
		}
	};
}

export const registerRealtime = subscribeRealtime;

export const registerRealtimeDynamic = (
	channels: string[],
	handler: (response: any) => void
): (() => void) => {
	return subscribeRealtime(
		`_dynamic_${Date.now()}_${Math.random().toString(36).slice(2)}`,
		channels,
		handler
	);
};

export function unregisterRealtime(id: string): void {
	awRealtime.unsubscribe(id).catch(() => {});
}

export async function initializeRealtime(): Promise<void> {}

export function destroyRealtime(): void {
	awRealtime.destroy().catch((err) => {
		console.error('[aw-realtime] Destroy failed:', err);
	});
}

export function isRealtimeInitialized(): boolean {
	return awRealtime.isInitialized;
}

export function setRealtimeOnReconnect(callback: (() => void) | null): void {
	awRealtime.setOnReconnect(callback);
}
