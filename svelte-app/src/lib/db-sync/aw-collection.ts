/**
 * aw-sync — Sync Collection
 *
 * Provides `createSyncCollection()`, the core bridge between Appwrite and Dexie (IndexedDB).
 *
 * Responsibilities:
 * - **Initial fetch**: incremental delta sync from last `$updatedAt` timestamp
 * - **Realtime subscriptions**: Appwrite WebSocket events are applied to Dexie
 * - **CRUD with optimistic writes**: create / update / remove with automatic rollback
 * - **Merge strategies**: per-field conflict resolution for concurrent array modifications
 *
 * Architecture:
 * ```
 * Appwrite (TablesDB + Realtime)
 *   ↕ delta sync + optimistic writes
 * Dexie (IndexedDB)
 *   ↕ liveQuery
 * SvelteMap / Components
 * ```
 *
 * @module aw-sync/collection
 */

import { Query, ID } from 'appwrite';
import type { Table } from 'dexie';
import {
	getAppwriteInstances,
	getDatabaseId,
	getCollectionId
} from '$lib/services/appwrite';
import { db, type SyncMetaRow } from './aw-db';
import {
	registerRealtime as registerInRegistry,
	registerRealtimeDynamic,
	isRealtimeInitialized,
	unregisterRealtime
} from './aw-realtime';
import type {
	AwDoc,
	AwFetchOptions,
	AwSubscribeOptions,
	AwSyncOptions,
	AwCollectionName,
	SubscriptionRef
} from './aw-types';

// =============================================================================
// MERGE HELPERS
// =============================================================================

/**
 * Factory that creates a merge strategy for array fields.
 * Merges local and remote arrays by a unique key, preferring local values on conflict.
 *
 * @example
 * ```ts
 * mergeStrategies: { participants: mergeByKey<Participant>('id') }
 * ```
 */
export function mergeByKey<T>(key: keyof T & string) {
	return (local: T[], remote: T[]): T[] => {
		const map = new Map<unknown, T>();
		for (const item of remote ?? []) map.set((item as Record<string, unknown>)[key], item);
		for (const item of local ?? []) map.set((item as Record<string, unknown>)[key], item);
		return Array.from(map.values());
	};
}

/** Apply merge strategies to a payload, using the server record as base. */
function applyMergeStrategies<T extends AwDoc>(
	payload: Partial<T>,
	serverRecord: T,
	strategies: AwSyncOptions<T>['mergeStrategies']
): Partial<T> {
	if (!strategies) return payload;
	const merged = { ...payload };
	for (const field of Object.keys(strategies) as (keyof T)[]) {
		if (field in payload && strategies[field]) {
			(merged as Record<string, unknown>)[field as string] = strategies[field]!(
				payload[field] as NonNullable<T[keyof T]>,
				serverRecord[field] as NonNullable<T[keyof T]>
			);
		}
	}
	return merged;
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Thrown when an Appwrite operation returns 404 — the record was hard-deleted on the server.
 */
export class RecordDeletedError extends Error {
	readonly recordId: string;
	readonly collectionId: string;

	constructor(recordId: string, collectionId: string) {
		super(`Record "${recordId}" was deleted from "${collectionId}"`);
		this.name = 'RecordDeletedError';
		this.recordId = recordId;
		this.collectionId = collectionId;
	}
}

// =============================================================================
// createSyncCollection
// =============================================================================

/**
 * Creates a sync collection that binds an Appwrite table to a Dexie table
 * with realtime subscriptions, optimistic writes, and merge strategies.
 *
 * @param options - Configuration for the sync collection
 * @returns Object with lifecycle, CRUD, and utility methods
 *
 * @example
 * ```ts
 * const teamdocs = createSyncCollection<Teamdocs>({
 *   table: db.teamdocs,
 *   collectionName: 'teamdocs',
 * });
 *
 * await teamdocs.initialFetch();
 * teamdocs.subscribe();
 * // Components read via liveQuery on teamdocs.getTable()
 * ```
 */
export function createSyncCollection<T extends AwDoc>(options: {
	table: Table<T>;
	/** Logical name matching a key in APPWRITE_CONFIG.collections */
	collectionName: AwCollectionName;
	/** Additional sync options (merge strategies, soft-delete, etc.) */
	syncOptions?: AwSyncOptions<T>;
}) {
	const { table, collectionName, syncOptions } = options;
	const mergeStrategies = syncOptions?.mergeStrategies;
	const softDelete = syncOptions?.softDelete ?? false;
	const onSubscriptionChange = syncOptions?.onSubscriptionChange;

	let subCounter = 0;
	const subscriptions = new Map<
		string,
		{
			ref: SubscriptionRef;
			unsubscribe: (() => void) | null;
		}
	>();

	// Resolved lazily — collection ID from Appwrite config
	let _collectionId: string | null = null;
	async function resolveCollectionId(): Promise<string> {
		if (!_collectionId) {
			_collectionId = getCollectionId(collectionName as any);
		}
		return _collectionId;
	}

	// =====================================================================
	// LIFECYCLE — INITIAL FETCH (DELTA SYNC)
	// =====================================================================

	/**
	 * Incremental sync: fetches records updated since the last local `$updatedAt`.
	 * Paginates automatically (cursor-based, 500 per page).
	 *
	 * @param fetchOptions - Optional extra Appwrite queries to scope the fetch
	 */
	async function initialFetch(fetchOptions?: AwFetchOptions): Promise<void> {
		const { tables, config } = await getAppwriteInstances();
		const collectionId = await resolveCollectionId();
		const syncKey = fetchOptions?.scopeKey ? `${collectionId}:${fetchOptions.scopeKey}` : collectionId;

		// 1. Read last sync timestamp from Dexie (scoped if scopeKey provided)
		const meta = await db.syncMeta.get(syncKey);
		const lastSync = meta?.lastSync ?? null;

		// 2. Build queries
		const queries: unknown[] = [];
		if (lastSync) {
			// Utilise greaterThanEqual pour ne pas manquer les enregistrements
			// ayant le même $updatedAt que le dernier sync (bulkPut dédup par $id)
			queries.push(Query.greaterThanEqual('$updatedAt', lastSync));
		}
		queries.push(Query.orderAsc('$updatedAt'));
		queries.push(Query.limit(500));
		if (fetchOptions?.queries) {
			queries.push(...fetchOptions.queries);
		}

		// 3. Paginated fetch (cursor-based)
		let allRows: T[] = [];
		let cursor: string | undefined;
		let page = 0;

		do {
			const pageQueries = [...queries];
			if (cursor) {
				pageQueries.push(Query.cursorAfter(cursor));
			}

			const response = await tables.listRows({
				databaseId: config.databaseId,
				tableId: collectionId,
				queries: pageQueries as string[]
			});

			const rows = response.rows as unknown as T[];
			allRows = allRows.concat(rows);
			cursor = rows.length > 0 ? rows[rows.length - 1].$id : undefined;
			page++;
		} while (cursor && (page * 500) === allRows.length);

		// 4. Bulk put into Dexie (transaction)
		if (allRows.length > 0) {
			await db.transaction('rw', table, async () => {
				await table.bulkPut(allRows);
			});
		}

		// 5. Update sync metadata
		const newTimestamp =
			allRows.length > 0
				? allRows[allRows.length - 1].$updatedAt
				: new Date().toISOString();
		await db.syncMeta.put({
			collectionId: syncKey,
			lastSync: newTimestamp
		} satisfies SyncMetaRow);

		console.log(
			`[aw-sync] ${String(collectionName)}${fetchOptions?.scopeKey ? `:${fetchOptions.scopeKey}` : ''}: ${allRows.length} records synced (lastSync: ${lastSync ?? 'full'} → ${newTimestamp.slice(0, 19)})`
		);
	}

	// =====================================================================
	// LIFECYCLE — REALTIME SUBSCRIPTION
	// =====================================================================

	/**
	 * Registers a realtime subscription for this collection in the central registry.
	 * Events (create / update / delete) are applied to Dexie automatically.
	 *
	 * The actual WebSocket subscription is deferred until `initializeRealtime()` is called
	 * (centralized batch subscription). For post-init subscriptions, uses dynamic registration.
	 *
	 * @param subOptions - Optional: scope to a specific document
	 * @returns A SubscriptionRef for later unsubscription
	 */
	function subscribeToCollection(subOptions?: AwSubscribeOptions): SubscriptionRef {
		const subId = `${String(collectionName)}_${++subCounter}`;
		const DB_ID = getDatabaseId();

		const collectionId = getCollectionId(collectionName as any);

		// Build Appwrite channel(s)
		const channels: string[] = subOptions?.documentId
			? [
					`databases.${DB_ID}.collections.${collectionId}.documents.${subOptions.documentId}`
				]
			: [`databases.${DB_ID}.collections.${collectionId}.documents`];

		const ref: SubscriptionRef = { id: subId, collectionId };

		// Handler: applies realtime events to Dexie
		const handler = async (response: any) => {
			const { events, payload } = response;
			if (!payload) return;

			const isCreate = events.some((e: string) => e.includes('.create'));
			const isUpdate = events.some((e: string) => e.includes('.update'));
			const isDelete = events.some((e: string) => e.includes('.delete'));

			if (isDelete) {
				if (softDelete) {
					const existing = await table.get(payload.$id);
					if (existing) {
						await table.put({ ...existing, deleted: true } as unknown as T);
					}
				} else {
					await table.delete(payload.$id);
				}
				console.log(`[aw-sync] realtime DELETE ${String(collectionName)}/${payload.$id}`);
			} else if (isCreate || isUpdate) {
				await table.put(payload as T);
				console.log(
					`[aw-sync] realtime ${isCreate ? 'CREATE' : 'UPDATE'} ${String(collectionName)}/${payload.$id}`
				);
			}
		};

		let dynamicCleanup: (() => void) | null = null;
		if (isRealtimeInitialized()) {
			dynamicCleanup = registerRealtimeDynamic(channels, handler);
		} else {
			registerInRegistry(subId, channels, handler);
		}

		subscriptions.set(subId, {
			ref,
			unsubscribe: () => {
				if (dynamicCleanup) {
					dynamicCleanup();
				} else {
					unregisterRealtime(subId);
				}
			}
		});
		onSubscriptionChange?.(true);

		console.log(`[aw-sync] subscribe ${subId} → ${channels.join(', ')}${dynamicCleanup ? ' (dynamic)' : ''}`);
		return ref;
	}

	/**
	 * Closes a specific realtime subscription.
	 */
	async function unsubscribe(subRefOrId: SubscriptionRef | string): Promise<void> {
		const subId = typeof subRefOrId === 'string' ? subRefOrId : subRefOrId.id;
		const sub = subscriptions.get(subId);
		if (sub) {
			sub.unsubscribe();
			subscriptions.delete(subId);
			console.log(`[aw-sync] unsubscribe ${subId}`);
			if (subscriptions.size === 0) onSubscriptionChange?.(false);
		}
	}

	/**
	 * Closes all active realtime subscriptions for this collection.
	 */
	async function unsubscribeAll(): Promise<void> {
		for (const [, sub] of subscriptions) {
			try {
				sub.unsubscribe();
			} catch {
				// Non-blocking
			}
		}
		subscriptions.clear();
		onSubscriptionChange?.(false);
		console.log(`[aw-sync] unsubscribeAll ${String(collectionName)}`);
	}

	// =====================================================================
	// CRUD — CREATE
	// =====================================================================

	/**
	 * Creates a record on Appwrite, then mirrors to Dexie.
	 *
	 * @param data - Record data (without $id, $createdAt, $updatedAt)
	 * @param permissions - Optional Appwrite permission strings
	 * @returns The confirmed record from Appwrite
	 */
	async function create(
		data: Omit<T, '$id' | '$createdAt' | '$updatedAt'>,
		permissions?: string[]
	): Promise<T> {
		const { tables, config } = await getAppwriteInstances();
		const collectionId = await resolveCollectionId();

		const confirmed = (await tables.createRow({
			databaseId: config.databaseId,
			tableId: collectionId,
			rowId: ID.unique(),
			data: data as Record<string, unknown>,
			permissions
		})) as unknown as T;

		await table.put(confirmed);
		console.log(`[aw-sync] create ${String(collectionName)}/${confirmed.$id}`);
		return confirmed;
	}

	// =====================================================================
	// CRUD — UPDATE (OPTIMISTIC WITH ROLLBACK)
	// =====================================================================

	/**
	 * Optimistic update: writes to Dexie immediately, pushes to Appwrite,
	 * rolls back on failure. Applies merge strategies for array fields if configured.
	 *
	 * @param id - Record $id
	 * @param data - Partial update data
	 * @returns The confirmed record from Appwrite
	 */
	async function update(id: string, data: Partial<T>): Promise<T> {
		const { tables, config } = await getAppwriteInstances();
		const collectionId = await resolveCollectionId();

		// 1. Snapshot current state (for rollback)
		const current = await table.get(id);
		if (!current) {
			throw new Error(`[aw-sync] Record ${id} not found in Dexie (${String(collectionName)})`);
		}

		// 2. Optimistic write to Dexie
		await table.update(id, data as any);

		try {
			// 3. Apply merge strategies if needed
			let payload = data;
			if (mergeStrategies) {
				const fieldsToMerge = Object.keys(mergeStrategies) as (keyof T)[];
				const hasConflictableField = fieldsToMerge.some((f) => f in data);
				if (hasConflictableField) {
					const serverRecord = (await tables.getRow({
						databaseId: config.databaseId,
						tableId: collectionId,
						rowId: id
					})) as unknown as T;
					payload = applyMergeStrategies(data, serverRecord, mergeStrategies);
				}
			}

			// 4. Push to Appwrite
			const confirmed = (await tables.updateRow({
				databaseId: config.databaseId,
				tableId: collectionId,
				rowId: id,
				data: payload as Record<string, unknown>
			})) as unknown as T;

			// 5. Confirm with server state
			await table.put(confirmed);
			console.log(`[aw-sync] update ${String(collectionName)}/${id}`);
			return confirmed;
		} catch (err: any) {
			// 6. Rollback on error
			if (err?.code === 404) {
				// Record was hard-deleted on server
				await table.put({ ...current, deleted: true } as unknown as T);
				throw new RecordDeletedError(id, collectionId);
			}
			await table.put(current);
			console.warn(`[aw-sync] update ROLLBACK ${String(collectionName)}/${id}`, err.message);
			throw err;
		}
	}

	// =====================================================================
	// CRUD — REMOVE (OPTIMISTIC WITH ROLLBACK)
	// =====================================================================

	/**
	 * Removes a record. Deletes optimistically from Dexie, then from Appwrite.
	 * Rolls back on failure.
	 *
	 * @param id - Record $id
	 */
	async function remove(id: string): Promise<void> {
		const { tables, config } = await getAppwriteInstances();
		const collectionId = await resolveCollectionId();

		const snapshot = await table.get(id);
		if (!snapshot) {
			throw new Error(`[aw-sync] Record ${id} not found in Dexie (${String(collectionName)})`);
		}

		try {
			// Optimistic delete
			if (softDelete) {
				await table.put({ ...snapshot, deleted: true } as unknown as T);
			} else {
				await table.delete(id);
			}

			// Push to Appwrite
			await tables.deleteRow({
				databaseId: config.databaseId,
				tableId: collectionId,
				rowId: id
			});

			console.log(`[aw-sync] remove ${String(collectionName)}/${id}`);
		} catch (err: any) {
			if (err?.code === 404) {
				// Already deleted on server — consider it done
				if (!softDelete) {
					await table.delete(id);
				}
				return;
			}
			// Rollback
			await table.put(snapshot);
			console.warn(`[aw-sync] remove ROLLBACK ${String(collectionName)}/${id}`, err.message);
			throw err;
		}
	}

	// =====================================================================
	// UTILITY
	// =====================================================================

	/** Returns the underlying Dexie table for direct queries / liveQuery. */
	function getTable(): Table<T> {
		return table;
	}

	/** Returns the Appwrite collection ID (resolved). */
	async function getAwCollectionId(): Promise<string> {
		return resolveCollectionId();
	}

	/**
	 * Clears the Dexie table and sync metadata for this collection.
	 * Used on logout to prevent stale data from leaking across users.
	 */
	async function clearLocal(): Promise<void> {
		const collectionId = await resolveCollectionId();
		await db.transaction('rw', [table, db.syncMeta], async () => {
			await table.clear();
			await db.syncMeta.where('collectionId').startsWith(collectionId).delete();
		});
		console.log(`[aw-sync] clearLocal ${String(collectionName)}`);
	}

	return {
		// Lifecycle
		initialFetch,
		subscribe: subscribeToCollection,
		unsubscribe,
		unsubscribeAll,

		// CRUD
		create,
		update,
		remove,

		// Utility
		getTable,
		get collectionName() {
			return collectionName;
		},
		getAwCollectionId,
		clearLocal
	};
}
