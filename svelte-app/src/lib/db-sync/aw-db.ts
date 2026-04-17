/**
 * aw-sync — EnkaDB Dexie Schema
 *
 * Central IndexedDB schema for the entire cookbook app.
 * Uses Appwrite conventions: primary key = `$id`, timestamps = `$updatedAt`, `$createdAt`.
 *
 * The old AppDB (PocketBase) is preserved in `./db.ts` until the planning module
 * is migrated separately.
 *
 * @module aw-sync/db
 */

import Dexie, { type Table } from 'dexie';
import type {
	Main,
	Products,
	Purchases,
	Recettes,
	Materiel,
	MaterielLoan,
	EventMateriel,
	Teamdocs,
	Locks,
	EventTodo,
	ShareLinks
} from '$lib/types/appwrite.d';

// =============================================================================
// STATIC DATA TYPES (Hugo)
// =============================================================================

/** Key-value row for Hugo static data (ingredients, recipe-info). */
export interface RecipeDataRow {
	key: string;
	data: unknown;
}

/** Hugo product data scoped to an event. */
export interface HugoProductRow {
	$id: string;
	mainId: string;
	data: unknown;
}

// =============================================================================
// SYNC METADATA
// =============================================================================

/** Tracks the last successful delta sync per collection. */
export interface SyncMetaRow {
	collectionId: string;
	lastSync: string | null;
}

// =============================================================================
// ENKA DB
// =============================================================================

export class EnkaDB extends Dexie {
	// --- Appwrite collections ---
	events!: Table<Main, string>;
	products!: Table<Products, string>;
	purchases!: Table<Purchases, string>;
	recipes!: Table<Recettes, string>;
	materiels!: Table<Materiel, string>;
	materielLoans!: Table<MaterielLoan, string>;
	eventMateriels!: Table<EventMateriel, string>;
	teamdocs!: Table<Teamdocs, string>;
	locks!: Table<Locks, string>;
	eventTodos!: Table<EventTodo, string>;
	shareLinks!: Table<ShareLinks, string>;

	// --- Hugo static data ---
	recipeData!: Table<RecipeDataRow, string>;
	hugoProducts!: Table<HugoProductRow, string>;

	// --- Sync metadata ---
	syncMeta!: Table<SyncMetaRow, string>;

	constructor() {
		super('EnkaDB');

		// Dexie index syntax: "primaryKey, index1, index2, *multiEntryIndex"
		// $id is the Appwrite primary key — used as Dexie outbound key.
		this.version(1).stores({
			events: '$id, status, createdBy, dateStart',
			products: '$id, mainId, productHugoUuid, store, status',
			purchases: '$id, mainId, *products, status, store',
			recipes: '$id, status, typeR, createdBy, lockedBy',
			materiels: '$id, type, status, owner, deleted',
			materielLoans: '$id, status, ownerId, eventId, startDate, endDate',
			eventMateriels: '$id, eventId, type, status, groupId',
			teamdocs: '$id, teamId, eventId, status, lockedBy',
			locks: '$id, userId, expiresAt',
			eventTodos: '$id, eventId, status, taskOn, priority',
			shareLinks: '$id, target_id, link_type, isActive',
			recipeData: 'key',
			hugoProducts: '$id, mainId',
			syncMeta: 'collectionId'
		});
	}
}

// =============================================================================
// SINGLETON
// =============================================================================

export const db = new EnkaDB();

// =============================================================================
// CLEANUP OLD CACHES
// =============================================================================

const OLD_DB_PREFIXES = [
	'products-cache',
	'events-cache',
	'recipes-cache',
	'materiel-cache',
	'event-materiel-cache',
	'recipe-data-cache'
];

/**
 * Deletes legacy per-store IndexedDB databases on first launch with aw-sync.
 * Safe to call multiple times — no-op if old caches don't exist.
 */
export async function cleanupLegacyCaches(): Promise<void> {
	if (typeof indexedDB === 'undefined' || !('databases' in indexedDB)) return;

	try {
		const databases = await indexedDB.databases();
		for (const info of databases) {
			if (
				info.name &&
				OLD_DB_PREFIXES.some((prefix) => info.name!.startsWith(prefix))
			) {
				indexedDB.deleteDatabase(info.name);
				console.log(`[aw-sync] Legacy cache deleted: ${info.name}`);
			}
		}
	} catch {
		// Non-blocking — old caches may be locked or unavailable
	}
}
