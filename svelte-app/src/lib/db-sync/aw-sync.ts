/**
 * aw-sync — Barrel export
 *
 * Single entry point for the Appwrite synchronization layer.
 *
 * @example
 * ```ts
 * import { createSyncCollection, bridgeToMap, db } from '$lib/db-sync/aw-sync';
 * ```
 */

export { db, cleanupLegacyCaches, type EnkaDB, type RecipeDataRow, type HugoProductRow, type SyncMetaRow } from './aw-db';
export { createSyncCollection, mergeByKey, RecordDeletedError } from './aw-collection';
export { bridgeToMap, bridgeToMapFiltered, type BridgeResult } from './aw-bridge';
export type {
	AwDoc,
	AwFetchOptions,
	AwSubscribeOptions,
	AwSyncOptions,
	AwCollectionName,
	MergeStrategy,
	SubscriptionRef
} from './aw-types';
