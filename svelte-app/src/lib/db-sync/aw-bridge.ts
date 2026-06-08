/**
 * aw-sync — LiveQuery → SvelteMap Bridge
 *
 * Connects a Dexie `liveQuery` to a SvelteMap for fine-grained reactivity.
 * When the Dexie table changes, the SvelteMap is updated incrementally.
 *
 * Comparison strategy: uses `$updatedAt` (O(1)) instead of JSON.stringify.
 *
 * @module aw-sync/bridge
 */

import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import { SvelteMap } from 'svelte/reactivity';
import type { AwDoc } from './aw-types';

/**
 * Result of bridging a liveQuery to a SvelteMap.
 * Call `subscription.unsubscribe()` on teardown.
 */
export interface BridgeResult<T extends AwDoc> {
	/** Reactive SvelteMap keyed by $id, kept in sync with Dexie */
	map: SvelteMap<string, T>;
	/** Dexie subscription — call .unsubscribe() to stop updates */
	subscription: Subscription;
}

/**
 * Bridges a Dexie liveQuery to a SvelteMap.
 *
 * The queryFn is re-executed whenever the underlying Dexie table changes.
 * The SvelteMap is updated incrementally (add / update / delete individual entries)
 * rather than replaced wholesale, preserving Svelte 5 fine-grained reactivity.
 *
 * @param queryFn - Function returning a Dexie query result (e.g. `() => db.products.toArray()`)
 * @returns BridgeResult with the reactive map and cleanup subscription
 *
 * @example
 * ```ts
 * const { map, subscription } = bridgeToMap(() =>
 *   db.teamdocs.toArray()
 * );
 *
 * // Use map reactively in store
 * get documents() { return Array.from(map.values()); }
 *
 * // Cleanup on teardown
 * subscription.unsubscribe();
 * ```
 */
export function bridgeToMap<T extends AwDoc>(
	queryFn: () => T[] | Promise<T[]>
): BridgeResult<T> {
	const map = new SvelteMap<string, T>();
	let fireCount = 0;

	const subscription = liveQuery(queryFn).subscribe({
		next: (items) => {
			fireCount++;
			console.log(`[aw-bridge] liveQuery fire #${fireCount}: ${items.length} items, closed=${subscription.closed}`);
			const currentIds = new Set(map.keys());

			for (const item of items) {
				currentIds.delete(item.$id);

				const existing = map.get(item.$id);
				// Fast comparison via $updatedAt — avoids JSON.stringify overhead
				if (!existing || existing.$updatedAt !== item.$updatedAt) {
					console.log(`[aw-bridge] SET ${item.$id} (updatedAt: ${existing?.$updatedAt ?? 'null'} → ${item.$updatedAt})`);
					map.set(item.$id, item);
				} else {
					console.log(`[aw-bridge] SKIP ${item.$id} (same updatedAt)`);
				}
			}

			// Remove entries that no longer exist in Dexie
			for (const id of currentIds) {
				console.log(`[aw-bridge] DELETE ${id}`);
				map.delete(id);
			}
		},
		error: (err) => {
			console.error('[aw-bridge] liveQuery error:', err);
		}
	});

	return { map, subscription };
}

/**
 * Scoped variant: bridges a filtered liveQuery (e.g. by mainId or eventId).
 * Same behavior as bridgeToMap but accepts extra queries via a filter function.
 *
 * @param table - Dexie table
 * @param filterFn - Function returning a filtered query (e.g. `t => t.where('mainId').equals(id).toArray()`)
 *
 * @example
 * ```ts
 * const { map, subscription } = bridgeToMapFiltered(
 *   db.products,
 *   (t) => t.where('mainId').equals(eventId).toArray()
 * );
 * ```
 */
export function bridgeToMapFiltered<T extends AwDoc>(
	table: import('dexie').Table<T>,
	filterFn: (table: import('dexie').Table<T>) => T[] | Promise<T[]>
): BridgeResult<T> {
	return bridgeToMap(() => filterFn(table));
}
