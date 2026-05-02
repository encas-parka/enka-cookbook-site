/**
 * pb-sync — Sync Collection
 *
 * Provides `createSyncCollection()`, the core bridge between PocketBase and Dexie (IndexedDB).
 *
 * This is the PocketBase equivalent of `aw-collection.ts`, with the **same external contract**
 * so that stores can switch with minimal changes (only query options differ).
 *
 * Key design decisions vs aw-collection:
 * - **Normalization**: PocketBase records (`id`/`created`/`updated`) are converted to
 *   Appwrite format (`$id`/`$createdAt`/`$updatedAt`) before touching Dexie or SvelteMap.
 *   This means the entire rest of the codebase (types, bridge, stores, components) is untouched.
 * - **Delta sync**: Uses `updated > {:since}` filter on the `updated` field (auto-managed by PB).
 *   No separate `syncMeta` table needed — we read the latest `updated` from Dexie directly.
 * - **Realtime**: PocketBase SSE replaces Appwrite WebSocket. No central registry needed —
 *   each collection subscribes directly via `pb.collection().subscribe()`.
 * - **Pagination**: Uses `getFullList()` for initial sync (auto-paginates internally).
 * - **Batch**: Uses PocketBase native `pb.createBatch()` for bulk operations.
 *
 * Architecture:
 * ```
 * PocketBase (REST + SSE Realtime)
 *   ↕ delta sync + optimistic writes
 * Dexie (IndexedDB) — records use $id as PK
 *   ↕ liveQuery
 * SvelteMap / Components — reads $id, $updatedAt (unchanged)
 * ```
 *
 * @module db-sync/pb-collection
 */

import type { Table, UpdateSpec } from 'dexie';
import type PocketBase from 'pocketbase';
import type {
	PbFetchOptions,
	PbSubscribeOptions,
	PbListOptions,
	PbSyncOptions,
	PbSubscriptionRef,
	PbCollectionName
} from './types';
import type { AwDoc } from './aw-types';

// =============================================================================
// NORMALIZATION: PocketBase ↔ Appwrite format
// =============================================================================

/**
 * Normalizes a PocketBase record into Appwrite-compatible format.
 * PocketBase uses `id`/`created`/`updated`; the codebase uses `$id`/`$createdAt`/`$updatedAt`.
 *
 * This function is called on every record entering Dexie from PocketBase
 * (initial fetch, realtime events, CRUD responses).
 */
function normalizeRecord<T extends AwDoc>(pbRecord: Record<string, unknown>): T {
	const { id, created, updated, ...data } = pbRecord;
	return {
		...data,
		$id: id as string,
		$createdAt: created as string,
		$updatedAt: updated as string
	} as T;
}

/**
 * Converts an internal record (Appwrite format) to PocketBase format.
 * Strips `$id`/`$createdAt`/`$updatedAt` — PocketBase manages `id`/`created`/`updated` itself.
 */
function toPBRecord<T extends AwDoc>(doc: Partial<T>): Record<string, unknown> {
	const { $id, $createdAt, $updatedAt, ...data } = doc as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		// Skip internal fields and undefined values
		if (!key.startsWith('$') && value !== undefined) {
			result[key] = value;
		}
	}
	return result;
}

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
	strategies: PbSyncOptions<T>['mergeStrategies']
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
// FILTER RESOLUTION
// =============================================================================

/**
 * Resolves a PbFetchOptions filter to a PocketBase filter string.
 * Supports both raw strings and parameterized tuples via `pb.filter()`.
 */
function resolveFilter(
	pb: PocketBase,
	params?: PbFetchOptions
): string | undefined {
	if (!params?.filter) return undefined;
	if (Array.isArray(params.filter)) {
		return pb.filter(params.filter[0], params.filter[1]);
	}
	return params.filter;
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Thrown when a PocketBase operation returns 404 — the record was hard-deleted on the server.
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
 * Creates a sync collection that binds a PocketBase collection to a Dexie table
 * with realtime subscriptions, optimistic writes, and merge strategies.
 *
 * **Same external contract as `aw-collection.ts`** — the only difference is the
 * PocketBase-specific query options (`filter` instead of `queries`).
 *
 * @param pb - PocketBase client instance
 * @param table - Dexie table (uses `$id` as primary key)
 * @param collectionName - PocketBase collection name
 * @param options - Optional sync configuration (merge strategies, soft-delete)
 *
 * @example
 * ```ts
 * const teamdocs = createSyncCollection<Teamdocs>(pb, db.teamdocs, 'teamdocs');
 *
 * await teamdocs.initialFetch();
 * teamdocs.subscribe();
 * // Components read via liveQuery on teamdocs.getTable()
 * ```
 */
export function createSyncCollection<T extends AwDoc>(
	pb: PocketBase,
	table: Table<T>,
	collectionName: PbCollectionName,
	options?: PbSyncOptions<T>
) {
	const mergeStrategies = options?.mergeStrategies;
	const softDelete = options?.softDelete ?? false;
	const onSubscriptionChange = options?.onSubscriptionChange;

	let subCounter = 0;
	const subscriptions = new Map<
		string,
		{
			ref: PbSubscriptionRef;
			unsub: (() => Promise<void>) | null;
			promise: Promise<() => Promise<void>>;
		}
	>();

	// =====================================================================
	// LIFECYCLE — INITIAL FETCH (DELTA SYNC)
	// =====================================================================

	/**
	 * Incremental sync: fetches records updated since the latest `updated`
	 * timestamp found in the local Dexie table.
	 *
	 * Uses `getFullList()` with auto-pagination (PocketBase SDK handles this).
	 *
	 * @param fetchOptions - Optional PocketBase filter/scope for the fetch
	 */
	async function initialFetch(fetchOptions?: PbFetchOptions): Promise<void> {
		// 1. Find the latest `updated` timestamp in local data
		const latest = await table.orderBy('$updatedAt').last();
		const since = (latest as any)?.$updatedAt ?? '2000-01-01 00:00:00';

		// 2. Build the delta filter
		const userFilter = resolveFilter(pb, fetchOptions);
		const combinedVars = {
			...(Array.isArray(fetchOptions?.filter) ? fetchOptions!.filter[1] : {}),
			since
		};

		const deltaFilter = userFilter
			? pb.filter(`(${userFilter}) && updated > {:since}`, combinedVars)
			: pb.filter('updated > {:since}', { since });

		// 3. Fetch all updated records from PocketBase
		const freshRecords = await pb.collection(collectionName).getFullList({
			filter: deltaFilter,
			sort: 'updated',
			...(fetchOptions?.fields ? { fields: fetchOptions.fields } : {}),
			...(fetchOptions?.expand ? { expand: fetchOptions.expand } : {}),
			...(fetchOptions?.query ? { query: fetchOptions.query } : {})
		});

		// 4. Normalize and upsert into Dexie
		if (freshRecords.length > 0) {
			const normalized = freshRecords.map((r) =>
				normalizeRecord<T>(r as unknown as Record<string, unknown>)
			);

			await table.db.transaction('rw', table, async () => {
				for (const record of normalized) {
					const existing = await table.get(record.$id);
					if (existing) {
						await table.update(record.$id, record as unknown as UpdateSpec<T>);
					} else {
						await table.put(record);
					}
				}
			});
		}

		console.log(
			`[pb-sync] ${collectionName}: ${freshRecords.length} records synced (since: ${since.slice(0, 19)})`
		);
	}

	// =====================================================================
	// LIFECYCLE — REALTIME SUBSCRIPTION
	// =====================================================================

	/**
	 * Subscribes to PocketBase SSE realtime events for this collection.
	 * Events (create / update / delete) are normalized and applied to Dexie.
	 *
	 * PocketBase SSE replaces the Appwrite WebSocket multiplexer.
	 * Each subscription is independent — no central registry needed.
	 *
	 * @param subOptions - Optional: scope to a specific record or add filter
	 * @returns A PbSubscriptionRef for later unsubscription
	 */
	function subscribeToCollection(subOptions?: PbSubscribeOptions): PbSubscriptionRef {
		const subId = `${collectionName}_${++subCounter}`;
		const resolvedFilter = resolveFilter(pb, subOptions);
		const topic = subOptions?.record ?? '*';

		const ref: PbSubscriptionRef = {
			id: subId,
			collection: collectionName,
			filter: resolvedFilter
		};

		// Handler: applies realtime events to Dexie (with normalization)
		const subscribePromise = pb
			.collection(collectionName)
			.subscribe(
				topic,
				async (event) => {
					const normalized = normalizeRecord<T>(
						event.record as unknown as Record<string, unknown>
					);

					if (event.action === 'delete') {
						if (softDelete) {
							const existing = await table.get(normalized.$id);
							if (existing) {
								await table.put({ ...existing, deleted: true } as unknown as T);
							}
						} else {
							await table.delete(normalized.$id);
						}
						console.log(
							`[pb-sync] realtime DELETE ${collectionName}/${normalized.$id}`
						);
					} else {
						// create or update — merge with existing to preserve local fields
						const existing = await table.get(normalized.$id);
						if (existing) {
							await table.update(normalized.$id, normalized as unknown as UpdateSpec<T>);
						} else {
							await table.put(normalized);
						}
						console.log(
							`[pb-sync] realtime ${event.action.toUpperCase()} ${collectionName}/${normalized.$id}`
						);
					}
				},
				{
					...(resolvedFilter ? { filter: resolvedFilter } : {}),
					...(subOptions?.query ? { query: subOptions.query } : {})
				}
			);

		subscriptions.set(subId, { ref, unsub: null, promise: subscribePromise });
		subscribePromise.then((unsub) => {
			const entry = subscriptions.get(subId);
			if (entry) entry.unsub = unsub;
		});

		onSubscriptionChange?.(true);
		console.log(`[pb-sync] subscribe ${subId} → ${collectionName}/${topic}`);

		return ref;
	}

	/**
	 * Closes a specific realtime subscription.
	 */
	async function unsubscribe(subRefOrId: PbSubscriptionRef | string): Promise<void> {
		const subId = typeof subRefOrId === 'string' ? subRefOrId : subRefOrId.id;
		const entry = subscriptions.get(subId);
		if (entry) {
			const unsub = entry.unsub ?? (await entry.promise);
			await unsub();
			subscriptions.delete(subId);
			console.log(`[pb-sync] unsubscribe ${subId}`);
			if (subscriptions.size === 0) onSubscriptionChange?.(false);
		}
	}

	/**
	 * Closes all active realtime subscriptions for this collection.
	 */
	async function unsubscribeAll(): Promise<void> {
		for (const [, entry] of subscriptions) {
			try {
				const unsub = entry.unsub ?? (await entry.promise);
				await unsub();
			} catch {
				// Non-blocking
			}
		}
		subscriptions.clear();
		onSubscriptionChange?.(false);
		console.log(`[pb-sync] unsubscribeAll ${collectionName}`);
	}

	// =====================================================================
	// CRUD — CREATE
	// =====================================================================

	/**
	 * Creates a record on PocketBase, normalizes the response, and mirrors to Dexie.
	 *
	 * @param data - Record data (without $id, $createdAt, $updatedAt)
	 * @returns The confirmed record (normalized to Appwrite format)
	 */
	async function create(
		data: Omit<T, '$id' | '$createdAt' | '$updatedAt'>
	): Promise<T> {
		const pbData = toPBRecord(data as Partial<T>);

		const pbResult = await pb.collection(collectionName).create(pbData);

		const confirmed = normalizeRecord<T>(pbResult as unknown as Record<string, unknown>);
		await table.put(confirmed);
		console.log(`[pb-sync] create ${collectionName}/${confirmed.$id}`);
		return confirmed;
	}

	// =====================================================================
	// CRUD — UPDATE (OPTIMISTIC WITH ROLLBACK)
	// =====================================================================

	/**
	 * Optimistic update: writes to Dexie immediately, pushes to PocketBase,
	 * rolls back on failure. Applies merge strategies for array fields if configured.
	 *
	 * @param id - Record $id
	 * @param data - Partial update data
	 * @returns The confirmed record (normalized to Appwrite format)
	 */
	async function update(id: string, data: Partial<T>): Promise<T> {
		// 1. Snapshot current state (for rollback)
		const current = await table.get(id);
		if (!current) {
			throw new Error(
				`[pb-sync] Record ${id} not found in Dexie (${collectionName})`
			);
		}

		// 2. Optimistic write to Dexie
		await table.update(id, data as unknown as UpdateSpec<T>);

		try {
			// 3. Apply merge strategies if needed
			let payload = toPBRecord(data);
			if (mergeStrategies) {
				const fieldsToMerge = Object.keys(mergeStrategies) as (keyof T)[];
				const hasConflictableField = fieldsToMerge.some((f) => f in data);
				if (hasConflictableField) {
					// Fetch server record to resolve conflicts
					const serverRaw = await pb.collection(collectionName).getOne(id, {
						requestKey: null
					});
					const serverRecord = normalizeRecord<T>(
						serverRaw as unknown as Record<string, unknown>
					);
					const merged = applyMergeStrategies(data, serverRecord, mergeStrategies);
					payload = toPBRecord(merged);
				}
			}

			// 4. Push to PocketBase
			const pbResult = await pb.collection(collectionName).update(id, payload);

			// 5. Confirm with server state
			const confirmed = normalizeRecord<T>(
				pbResult as unknown as Record<string, unknown>
			);
			await table.update(id, confirmed as unknown as UpdateSpec<T>);
			console.log(`[pb-sync] update ${collectionName}/${id}`);
			return confirmed;
		} catch (err: any) {
			// 6. Rollback on error
			if (err?.status === 404) {
				// Record was hard-deleted on server
				await table.put({ ...current, deleted: true } as unknown as T);
				throw new RecordDeletedError(id, collectionName);
			}
			await table.put(current);
			console.warn(
				`[pb-sync] update ROLLBACK ${collectionName}/${id}`,
				err.message
			);
			throw err;
		}
	}

	// =====================================================================
	// CRUD — REMOVE (OPTIMISTIC WITH ROLLBACK)
	// =====================================================================

	/**
	 * Removes a record. Deletes optimistically from Dexie, then from PocketBase.
	 * Rolls back on failure.
	 *
	 * @param id - Record $id
	 */
	async function remove(id: string): Promise<void> {
		const snapshot = await table.get(id);
		if (!snapshot) {
			throw new Error(
				`[pb-sync] Record ${id} not found in Dexie (${collectionName})`
			);
		}

		try {
			// Optimistic delete
			if (softDelete) {
				await table.put({ ...snapshot, deleted: true } as unknown as T);
			} else {
				await table.delete(id);
			}

			// Push to PocketBase
			await pb.collection(collectionName).delete(id);

			console.log(`[pb-sync] remove ${collectionName}/${id}`);
		} catch (err: any) {
			if (err?.status === 404) {
				// Already deleted on server — consider it done
				if (!softDelete) {
					await table.delete(id);
				}
				return;
			}
			// Rollback
			await table.put(snapshot);
			console.warn(
				`[pb-sync] remove ROLLBACK ${collectionName}/${id}`,
				err.message
			);
			throw err;
		}
	}

	// =====================================================================
	// BATCH OPERATIONS
	// =====================================================================

	interface PendingOp {
		type: 'create' | 'update' | 'delete';
		id?: string;
		data?: Record<string, unknown>;
	}

	interface BatchResult {
		records: T[];
	}

	interface CollectionBatch {
		create(data: Omit<T, '$id' | '$createdAt' | '$updatedAt'>): CollectionBatch;
		update(id: string, data: Partial<T>): CollectionBatch;
		delete(id: string): CollectionBatch;
		send(): Promise<BatchResult>;
	}

	/**
	 * Creates a batch builder for atomic multi-operation requests.
	 * Uses PocketBase native `pb.createBatch()`.
	 */
	function createBatch(): CollectionBatch {
		const ops: PendingOp[] = [];

		const builder: CollectionBatch = {
			create(data) {
				ops.push({ type: 'create', data: toPBRecord(data as Partial<T>) });
				return builder;
			},
			update(id, data) {
				ops.push({ type: 'update', id, data: toPBRecord(data) });
				return builder;
			},
			delete(id) {
				ops.push({ type: 'delete', id });
				return builder;
			},

			async send(): Promise<BatchResult> {
				if (ops.length === 0) return { records: [] };

				// Snapshot for rollback
				const snapshotIds = ops
					.filter((op) => op.type === 'update' || op.type === 'delete')
					.map((op) => op.id!);
				const snapshots =
					snapshotIds.length > 0 ? await table.bulkGet(snapshotIds) : [];

				// Optimistic local writes
				for (const op of ops) {
					switch (op.type) {
						case 'update': {
							const current = await table.get(op.id!);
							if (current) {
								const normalized = normalizeRecord<T>({
									...(current as unknown as Record<string, unknown>),
									...op.data
								});
								await table.put(normalized);
							}
							break;
						}
						case 'delete':
							await table.delete(op.id!);
							break;
					}
				}

				try {
					// PocketBase batch
					const batch = pb.createBatch();

					for (const op of ops) {
						switch (op.type) {
							case 'create':
								batch.collection(collectionName).create(op.data);
								break;
							case 'update':
								batch.collection(collectionName).update(op.id!, op.data);
								break;
							case 'delete':
								batch.collection(collectionName).delete(op.id!);
								break;
						}
					}

					const results = await batch.send();

					// Normalize and confirm
					const confirmed = results
						.map((r) => r.body)
						.filter(Boolean)
						.map((body) =>
							normalizeRecord<T>(body as unknown as Record<string, unknown>)
						);

					if (confirmed.length > 0) {
						await table.bulkPut(confirmed);
					}

					return { records: confirmed };
				} catch (err) {
					// Rollback
					const valid = snapshots.filter(Boolean) as T[];
					if (valid.length > 0) await table.bulkPut(valid);

					for (const op of ops) {
						if (op.type === 'create') {
							// Can't know the ID — best effort
						}
					}

					throw err;
				}
			}
		};

		return builder;
	}

	/** Bulk create multiple records in a single batch request. */
	async function bulkCreate(
		items: Omit<T, '$id' | '$createdAt' | '$updatedAt'>[]
	): Promise<T[]> {
		const b = createBatch();
		for (const item of items) b.create(item);
		const { records } = await b.send();
		return records;
	}

	/** Bulk update multiple records in a single batch request. */
	async function bulkUpdate(items: { id: string; data: Partial<T> }[]): Promise<T[]> {
		const b = createBatch();
		for (const item of items) b.update(item.id, item.data);
		const { records } = await b.send();
		return records;
	}

	/** Bulk delete multiple records in a single batch request. */
	async function bulkDelete(ids: string[]): Promise<void> {
		const b = createBatch();
		for (const id of ids) b.delete(id);
		await b.send();
	}

	// =====================================================================
	// CONVENIENCE QUERIES
	// =====================================================================

	/**
	 * Paginated list from PocketBase (bypasses Dexie — use for admin/debug).
	 * Results are NOT cached in Dexie.
	 */
	async function list(params?: PbListOptions) {
		const resolvedFilter = resolveFilter(pb, params);
		return pb.collection(collectionName).getList(params?.page ?? 1, params?.perPage ?? 30, {
			...(resolvedFilter ? { filter: resolvedFilter } : {}),
			...(params?.sort ? { sort: params.sort } : {}),
			...(params?.fields ? { fields: params.fields } : {}),
			...(params?.expand ? { expand: params.expand } : {}),
			...(params?.query ? { query: params.query } : {})
		});
	}

	/**
	 * Fetch a single record by ID from PocketBase (bypasses Dexie).
	 */
	async function view(id: string, params?: PbFetchOptions): Promise<T> {
		const raw = await pb.collection(collectionName).getOne(id, {
			...(params?.fields ? { fields: params.fields } : {}),
			...(params?.expand ? { expand: params.expand } : {}),
			...(params?.query ? { query: params.query } : {})
		});
		return normalizeRecord<T>(raw as unknown as Record<string, unknown>);
	}

	// =====================================================================
	// UTILITY
	// =====================================================================

	/** Returns the underlying Dexie table for direct queries / liveQuery. */
	function getTable(): Table<T> {
		return table;
	}

	/**
	 * Clears the Dexie table for this collection.
	 * Used on logout to prevent stale data from leaking across users.
	 *
	 * Note: Unlike aw-sync, we don't have a `syncMeta` table to clean up.
	 * Delta sync is based on the latest `$updatedAt` in the Dexie table itself.
	 */
	async function clearLocal(): Promise<void> {
		await table.clear();
		console.log(`[pb-sync] clearLocal ${collectionName}`);
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

		// Batch
		createBatch,
		bulkCreate,
		bulkUpdate,
		bulkDelete,

		// Convenience queries
		list,
		view,

		// Utility
		getTable,
		get collectionName() {
			return collectionName;
		},
		clearLocal
	};
}
