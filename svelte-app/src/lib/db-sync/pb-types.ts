/**
 * pb-sync — Types for PocketBase synchronization
 *
 * Mirrors the contract of `aw-types.ts` but adapted for PocketBase's API.
 * The key difference: PocketBase uses `id`/`created`/`updated` instead of
 * `id`/`created`/`updated`. No normalization needed.
 *
 * The internal types (AwDoc, bridgeToMap, etc.) remain unchanged — pb-collection
 * converts between formats transparently.
 *
 * @module db-sync/pb-types
 */

// =============================================================================
// DOCUMENT CONSTRAINT — PbDoc is now the canonical shape
// =============================================================================

import type { PbDoc } from "./aw-types";

export type { PbDoc } from "./aw-types";

// =============================================================================
// QUERY OPTIONS
// =============================================================================

/**
 * Options for `initialFetch()`.
 * Uses PocketBase filter syntax instead of Appwrite Query helpers.
 */
export interface PbFetchOptions {
  /**
   * PocketBase filter. Two forms:
   * - Raw string: `'active = true'` (use only for static values)
   * - Parameterized tuple: `['field = {:var}', { var: value }]` (recommended)
   */
  filter?: string | [template: string, vars: Record<string, unknown>];
  /**
   * Filter applied ONLY when the delta cursor is absent (first sync, or the
   * post-reset session full fetch): bounds the otherwise-unbounded fetch
   * (ex. `dateEnd >= {:floor}` on events). Deliberately ignored on every
   * incremental fetch — a bound must never exclude *mutations* of records
   * outside the window, only their initial population.
   */
  epochFilter?: string | [template: string, vars: Record<string, unknown>];
  /**
   * Scopes the delta-sync cursor in `syncMeta` (key `${collection}:${scopeKey}`).
   * Required whenever `filter` scopes the fetch (ex. `eventId`) — without it,
   * switching scope silently misses records whose `updated` predates the
   * newest record of another scope.
   */
  scopeKey?: string;
  /** Fields to include in the response (projection) */
  fields?: string;
  /** Relations to expand (e.g. `'author,team'`) */
  expand?: string;
  /** Raw HTTP query params (escape hatch) */
  query?: Record<string, string>;
}

/**
 * Options for `subscribe()`.
 * Extends PbFetchOptions with realtime-specific options.
 */
export interface PbSubscribeOptions extends PbFetchOptions {
  /** Watch a specific record instead of the whole collection */
  record?: string;
}

/**
 * Options for `list()` — paginated listing.
 */
export interface PbListOptions extends PbFetchOptions {
  /** Sort expression (e.g. `'-created'` for descending) */
  sort?: string;
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  perPage?: number;
}

/**
 * Options shared by the bulk write operations.
 */
export interface PbBulkOptions {
  /**
   * Sub-requests per batch chunk. Defaults to `PB_BATCH_MAX_REQUESTS`
   * (mirrors the server `batch.maxRequests` setting); clamped to it —
   * a larger value would make the server reject the batch.
   */
  batchSize?: number;
}

// =============================================================================
// MERGE STRATEGIES
// =============================================================================

/**
 * Per-field merge function: (localValue, serverValue) => mergedValue.
 * Used for array fields that may be concurrently modified.
 * Same signature as aw-sync.
 */
export type MergeStrategy<T> = (local: T, remote: T) => T;

// =============================================================================
// SYNC COLLECTION OPTIONS
// =============================================================================

/**
 * Configuration for a PocketBase sync collection.
 * Mirrors `AwSyncOptions` with PocketBase-specific additions.
 */
export interface PbSyncOptions<T extends PbDoc> {
  /** Per-field merge strategies for concurrent array resolution */
  mergeStrategies?: {
    [K in keyof T]?: MergeStrategy<NonNullable<T[K]>>;
  };
  /** Mark deleted instead of hard-deleting from Dexie (default: false) */
  softDelete?: boolean;
  /** Called when realtime subscription becomes active / inactive */
  onSubscriptionChange?: (active: boolean) => void;
  /**
   * Session-cursor policy (ADR 0001): the cursor does not survive across
   * sessions. `initialFetch` ignores the persisted cursor and always runs
   * the full session fetch (mutations AND grant widenings caught);
   * `revalidate` stays a pure delta with a TTL fallback (`forceFull`
   * asserts a session start). `true` = shared default TTL
   * (`SESSION_FULL_SYNC_TTL_MS`); `{ ttlMs }` tunes it per collection.
   */
  sessionCursor?: true | { ttlMs?: number };
}

// =============================================================================
// SUBSCRIPTION REF
// =============================================================================

/** Opaque handle returned by `subscribe()`. */
export interface PbSubscriptionRef {
  readonly id: string;
  readonly collection: string;
  readonly filter?: string;
}

// =============================================================================
// COLLECTION NAME TYPE
// =============================================================================

/**
 * Valid PocketBase collection names.
 * Must match the collections defined in `pocketbase/pb_migrations/`.
 */
export type PbCollectionName =
  | "teams"
  | "events"
  | "products"
  | "purchases"
  | "recipes"
  | "event_materiel"
  | "event_todos"
  | "materiel"
  | "materiel_loan"
  | "teamdocs"
  | "locks"
  | "notifications"
  | "share_links"
  | "ingredients"
  | "categories";
