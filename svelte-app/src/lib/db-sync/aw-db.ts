/**
 * aw-sync — EnkaDB Dexie Schema
 *
 * Central IndexedDB schema for the entire cookbook app.
 * Uses PocketBase conventions: primary key = `id`, timestamps = `updated`, `created`.
 *
 * The old AppDB (PocketBase) is preserved in `./db.ts` until the planning module
 * is migrated separately.
 *
 * @module aw-sync/db
 */

import Dexie, { type Table } from "dexie";
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
  ShareLinks,
} from "$lib/types/pb";
import type { PbDoc } from "./aw-types";
import type { EnrichedNativeTeam } from "$lib/types/aw_native_team.d";
import type {
  IngredientsRecord,
  CategoriesRecord,
} from "$lib/types/pb-generated";

// =============================================================================
// STATIC DATA TYPES (Hugo)
// =============================================================================

/** Key-value row for Hugo static data (ingredients, recipe-info). */
export interface RecipeDataRow {
  key: string;
  data: unknown;
}

/** Key-value row for Hugo reference catalog (ingredients, recipe-info, metadata). */
export interface CatalogRow {
  key: string;
  data: unknown;
}

/**
 * Calculated product needs scoped to an event.
 * Persisted from event.meals → recipes → ingredients aggregation.
 * NOT from Hugo SSG — the name is historical.
 */
export interface ProductNeedRow {
  /** Composite ID: {productNameSlug}_{eventIdShort} — same as EnrichedProduct.id */
  id: string;
  /** Event ID (for Dexie indexing/scoping) */
  mainId: string;
  /** Ingredient ref (from recipe ingredient) */
  ingredientRef: string;
  /** Product display name */
  productName: string;
  /** Product type (e.g. "cremerie", "boucherie") */
  productType: string;
  /** Needs refrigeration */
  pF: boolean;
  /** Needs freezing */
  pS: boolean;
  /** Quantities needed per date (JSON-serialized Record<string, ByDateEntry>) */
  byDate: string;
  /** Total needed across all dates (JSON-serialized NumericQuantity[]) */
  totalNeededArray: string;
  /** Number of recipes using this product */
  nbRecipes: number;
  /** Total portions/servings */
  totalAssiettes: number;
  /** Display info per date (JSON-serialized Record<string, DateDisplayInfo>) */
  dateDisplayInfo: string;
  /** Timestamp for bridge change detection */
  updated: string;
  /** Creation timestamp */
  created: string;
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
// JOIN LINKS CACHE
// =============================================================================

/** Cache des liens d'invitation déjà utilisés (linkId → eventId) */
export interface JoinLinkRow {
  linkId: string;
  eventId: string;
  joinedAt: string;
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

  // --- Calculated product needs (from event.meals → recipes → ingredients) ---
  productNeeds!: Table<ProductNeedRow, string>;

  // --- Hugo reference catalog (ingredients, recipe-info) ---
  catalog!: Table<CatalogRow, string>;

  // --- Sync metadata ---
  syncMeta!: Table<SyncMetaRow, string>;

  // --- Join links cache ---
  joinLinks!: Table<JoinLinkRow, string>;

  // --- Native teams cache (Appwrite Teams API, not Tables) ---
  nativeTeams!: Table<EnrichedNativeTeam, string>;

  // --- Ingredients & Categories (pb-sync, remplace Hugo JSON) ---
  ingredients!: Table<IngredientsRecord, string>;
  categories!: Table<CategoriesRecord, string>;

  constructor() {
    super("EnkaDB");

    // Dexie index syntax: "primaryKey, index1, index2, *multiEntryIndex"
    // id is the PocketBase primary key — used as Dexie outbound key.
    this.version(1).stores({
      events: "$id, status, createdBy, dateStart",
      products: "$id, mainId, productHugoUuid, store, status",
      purchases: "$id, mainId, *products, status, store",
      recipes: "$id, status, typeR, createdBy, lockedBy",
      materiels: "$id, type, status, owner, deleted",
      materielLoans: "$id, status, ownerId, eventId, startDate, endDate",
      eventMateriels: "$id, eventId, type, status, groupId",
      teamdocs: "$id, teamId, eventId, status",
      locks: "$id, userId, expiresAt",
      eventTodos: "$id, eventId, status, taskOn, priority",
      shareLinks: "$id, target_id, link_type, isActive",
      recipeData: "key",
      hugoProducts: "$id, mainId",
      syncMeta: "collectionId",
    });

    // v2: add catalog table for Hugo reference data
    this.version(2).stores({
      catalog: "key",
    });

    // v3: rename hugoProducts → productNeeds with richer schema
    this.version(3).stores({
      hugoProducts: null, // Drop old table
      productNeeds: "$id, mainId",
    });

    // v4: add joinLinks cache for share link optimization
    this.version(4).stores({
      joinLinks: "linkId",
    });

    // v5: add nativeTeams cache for Appwrite Teams API
    this.version(5).stores({
      nativeTeams: "$id",
    });

    // v6: rename PK from $id → id (PocketBase native field names)
    this.version(6).stores({
      events: "id, status, createdBy, dateStart",
      products: "id, mainId, productHugoUuid, store, status",
      purchases: "id, mainId, *products, status, store",
      recipes: "id, status, typeR, createdBy, lockedBy",
      materiels: "id, type, status, owner, deleted",
      materielLoans: "id, status, ownerId, eventId, startDate, endDate",
      eventMateriels: "id, eventId, type, status, groupId",
      teamdocs: "id, teamId, eventId, status",
      locks: "id, userId, expiresAt",
      eventTodos: "id, eventId, status, taskOn, priority",
      shareLinks: "id, target_id, link_type, isActive",
      recipeData: "key",
      productNeeds: "id, mainId",
      syncMeta: "collectionId",
      nativeTeams: "id",
      joinLinks: "linkId",
      catalog: "key",
    });

    // v7: add 'updated' index for delta sync + rename mainId → eventId (products/purchases)
    this.version(7).stores({
      events: "id, updated, status, createdBy, dateStart",
      products: "id, updated, eventId, productHugoUuid, store, status",
      purchases: "id, updated, eventId, *products, status, store",
      recipes: "id, updated, status, typeR, createdBy, lockedBy",
      materiels: "id, updated, type, status, owner, deleted",
      materielLoans: "id, updated, status, ownerId, eventId, startDate, endDate",
      eventMateriels: "id, updated, eventId, type, status, groupId",
      teamdocs: "id, updated, teamId, eventId, status",
      locks: "id, updated, userId, expiresAt",
      eventTodos: "id, updated, eventId, status, taskOn, priority",
      shareLinks: "id, updated, target_id, link_type, isActive",
      recipeData: "key",
      productNeeds: "id, updated, mainId",
      syncMeta: "collectionId",
      nativeTeams: "id, updated",
      joinLinks: "linkId",
      catalog: "key",
    });

    // v8: add ingredients + categories tables for pb-sync (remplace Hugo JSON)
    this.version(8).stores({
      events: "id, updated, status, createdBy, dateStart",
      products: "id, updated, eventId, productHugoUuid, store, status",
      purchases: "id, updated, eventId, *products, status, store",
      recipes: "id, updated, status, typeR, createdBy, lockedBy",
      materiels: "id, updated, type, status, owner, deleted",
      materielLoans: "id, updated, status, ownerId, eventId, startDate, endDate",
      eventMateriels: "id, updated, eventId, type, status, groupId",
      teamdocs: "id, updated, teamId, eventId, status",
      locks: "id, updated, userId, expiresAt",
      eventTodos: "id, updated, eventId, status, taskOn, priority",
      shareLinks: "id, updated, target_id, link_type, isActive",
      recipeData: "key",
      productNeeds: "id, updated, mainId",
      syncMeta: "collectionId",
      nativeTeams: "id, updated",
      joinLinks: "linkId",
      catalog: "key",
      ingredients: "id, updated, name, type",
      categories: "id, updated, name, type",
    });

    // v9: rename productHugoUuid → ingredientRef (field rename in PB schema)
    // Dexie will recreate the products index with the new name.
    this.version(9).stores({
      products: "id, updated, eventId, ingredientRef, store, status",
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
  "products-cache",
  "events-cache",
  "recipes-cache",
  "materiel-cache",
  "event-materiel-cache",
  "recipe-data-cache",
];

/**
 * Deletes legacy per-store IndexedDB databases on first launch with aw-sync.
 * Safe to call multiple times — no-op if old caches don't exist.
 */
export async function cleanupLegacyCaches(): Promise<void> {
  if (typeof indexedDB === "undefined" || !("databases" in indexedDB)) return;

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
