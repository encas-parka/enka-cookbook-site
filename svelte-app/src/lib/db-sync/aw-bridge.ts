/**
 * aw-sync — LiveQuery → SvelteMap Bridge
 *
 * Connects a Dexie `liveQuery` to a SvelteMap for fine-grained reactivity.
 * When the Dexie table changes, the SvelteMap is updated incrementally.
 *
 * Comparison strategy: uses `updated` (O(1)) instead of JSON.stringify.
 *
 * @module aw-sync/bridge
 */

import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import { SvelteMap } from 'svelte/reactivity';
import type { PbDoc } from './aw-types';

/**
 * Result of bridging a liveQuery to a SvelteMap.
 * Call `subscription.unsubscribe()` on teardown.
 */
export interface BridgeResult<T extends PbDoc> {
	/** Reactive SvelteMap keyed by id, kept in sync with Dexie */
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
export function bridgeToMap<T extends PbDoc>(
	queryFn: () => T[] | Promise<T[]>
): BridgeResult<T> {
	const map = new SvelteMap<string, T>();

	const subscription = liveQuery(queryFn).subscribe({
		next: (items) => {
			const currentIds = new Set(map.keys());

			for (const item of items) {
				currentIds.delete(item.id);

				const existing = map.get(item.id);
				// Fast comparison via updated — avoids JSON.stringify overhead
				if (!existing || existing.updated !== item.updated) {
					map.set(item.id, item);
				}
			}

			// Remove entries that no longer exist in Dexie
			for (const id of currentIds) {
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
export function bridgeToMapFiltered<T extends PbDoc>(
	table: import('dexie').Table<T>,
	filterFn: (table: import('dexie').Table<T>) => T[] | Promise<T[]>
): BridgeResult<T> {
	return bridgeToMap(() => filterFn(table));
}
