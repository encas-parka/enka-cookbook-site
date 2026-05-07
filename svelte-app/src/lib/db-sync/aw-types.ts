/**
 * aw-sync — Types for Appwrite synchronization
 *
 * Defines the contracts for the sync layer bridging Appwrite (remote)
 * and Dexie / IndexedDB (local).
 *
 * @module aw-sync/types
 */

// =============================================================================
// DOCUMENT CONSTRAINT
// =============================================================================

/**
 * Minimum shape for a document that can be synced.
 * PocketBase rows expose id, created, updated.
 */
export interface PbDoc {
	id: string;
	created: string;
	updated: string;
}

// =============================================================================
// QUERY OPTIONS
// =============================================================================

/**
 * Options passed to `initialFetch()`.
 * Uses native Appwrite Query helpers (Query.equal, Query.greaterThan, …).
 */
export interface AwFetchOptions {
	/** Additional Appwrite queries to scope the fetch (e.g. Query.equal("mainId", id)) */
	queries?: unknown[];
}

/**
 * Options passed to `subscribe()`.
 */
export interface AwSubscribeOptions extends AwFetchOptions {
	/** Watch a specific document instead of the whole collection */
	documentId?: string;
}

// =============================================================================
// MERGE STRATEGIES
// =============================================================================

/**
 * Per-field merge function: (localValue, serverValue) => mergedValue.
 * Used for array fields that may be concurrently modified.
 */
export type MergeStrategy<T> = (local: T, remote: T) => T;

// =============================================================================
// SYNC COLLECTION OPTIONS
// =============================================================================

/**
 * Configuration for a sync collection.
 */
export interface AwSyncOptions<T extends PbDoc> {
	/** Per-field merge strategies for concurrent array resolution */
	mergeStrategies?: {
		[K in keyof T]?: MergeStrategy<NonNullable<T[K]>>;
	};
	/**
	 * Mark deleted instead of removing from Dexie.
	 * Appwrite doesn't have native soft-delete, but the store may want
	 * to keep tombstones locally.
	 */
	softDelete?: boolean;
	/** Called when realtime subscription becomes active / inactive */
	onSubscriptionChange?: (active: boolean) => void;
}

// =============================================================================
// SUBSCRIPTION REF
// =============================================================================

/** Opaque handle returned by `subscribe()`. */
export interface SubscriptionRef {
	readonly id: string;
	readonly collectionId: string;
}

// =============================================================================
// COLLECTION NAME TYPE
// =============================================================================

/**
 * Keys matching PocketBase collections.
 */
export type PbCollectionName =
	| 'events'
	| 'ingredients'
	| 'categories'
	| 'main'
	| 'purchases'
	| 'products'
	| 'kteams'
	| 'locks'
	| 'user_notifications'
	| 'materiel'
	| 'materiel_loan'
	| 'event_materiel'
	| 'teamdocs'
	| 'recipes';
