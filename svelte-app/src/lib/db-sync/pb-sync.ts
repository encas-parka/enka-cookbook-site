/**
 * pb-sync — Barrel export
 *
 * Single entry point for the PocketBase synchronization layer.
 * Drop-in replacement for `aw-sync.ts` during Phase 1 migration.
 *
 * @example
 * ```ts
 * import { createSyncCollection, bridgeToMap, db, pb } from '$lib/db-sync/pb-sync';
 * ```
 */

// PocketBase client
export { pb } from './pb';

// Dexie database (unchanged — same EnkaDB, same $id PK)
export {
	db,
	cleanupLegacyCaches,
	type EnkaDB,
	type RecipeDataRow,
	type CatalogRow,
	type ProductNeedRow,
	type SyncMetaRow
} from './aw-db';

// Core sync collection
export { createSyncCollection, mergeByKey, RecordDeletedError } from './pb-collection';

// Bridge (100% backend-agnostic — 0 change)
export { bridgeToMap, bridgeToMapFiltered, type BridgeResult } from './aw-bridge';

// LiveQuery hook (100% backend-agnostic — 0 change)
export { useLiveQuery } from './use-live-query.svelte';

// PocketBase-specific types
export type {
	PbFetchOptions,
	PbSubscribeOptions,
	PbListOptions,
	PbSyncOptions,
	PbSubscriptionRef,
	PbCollectionName,
	PbRawDoc
} from './pb-types';

// Re-export AwDoc for convenience (still the canonical document shape)
export type { AwDoc, AwCollectionName } from './aw-types';
