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
 *   Appwrite format (`id`/`created`/`updated`) — no normalization needed.
 *   This means the entire rest of the codebase (types, bridge, stores, components) is untouched.
 * - **Delta sync**: Uses `updated >= {:since}` filter on the `updated` field (auto-managed by PB).
 *   The cursor is persisted per scope in the `syncMeta` table (key
 *   `${collection}:${scopeKey}` — see `scopeKey` in `PbFetchOptions`) and
 *   written atomically with the upserts in a single Dexie transaction:
 *   a failed upsert never advances the cursor.
 * - **Realtime**: PocketBase SSE replaces Appwrite WebSocket. No central registry needed —
 *   each collection subscribes directly via `pb.collection().subscribe()`.
 * - **Pagination**: Uses `getFullList()` for initial sync (auto-paginates internally).
 * - **Batch**: Uses PocketBase native `pb.createBatch()` for bulk operations,
 *   including the native upsert (update when the body carries an existing id,
 *   create otherwise).
 *
 * Architecture:
 * ```
 * PocketBase (REST + SSE Realtime)
 *   ↕ delta sync + optimistic writes
 * Dexie (IndexedDB) — records use id as PK
 *   ↕ liveQuery
 * SvelteMap / Components — reads id, updated (unchanged)
 * ```
 *
 * @module db-sync/pb-collection
 */

import type { Table, UpdateSpec } from "dexie";
import type PocketBase from "pocketbase";
import { db, type SyncMetaRow } from "./aw-db";
import type {
  PbFetchOptions,
  PbSubscribeOptions,
  PbListOptions,
  PbBulkOptions,
  PbSyncOptions,
  PbSubscriptionRef,
  PbCollectionName,
} from "./pb-types";
import type { PbDoc } from "./aw-types";

// =============================================================================
// SYSTEM FIELD HELPERS
// =============================================================================

const SYSTEM_FIELDS = new Set(["id", "created", "updated"]);
const SYSTEM_FIELDS_KEEP_ID = new Set(["created", "updated"]);

function stripSystemFields<T extends Record<string, unknown>>(
  data: Partial<T>,
  keepId = false,
): Record<string, unknown> {
  const strip = keepId ? SYSTEM_FIELDS_KEEP_ID : SYSTEM_FIELDS;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!strip.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Deep plain copy of a value tree — dereferences Svelte 5 `$state` proxies
 * (and any other Proxy) by copying own enumerable properties.
 *
 * IndexedDB storage (`table.put`/`table.update`) uses structured clone, which
 * cannot clone proxies: a reactive payload written optimistically throws
 * `DataCloneError: Proxy object could not be cloned`. Callers pass reactive
 * state (e.g. EventEditPage's shadow draft) — normalizing here, at the
 * pb-sync write boundary, protects every write path at once.
 */
function toPlain<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(toPlain) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "function") continue;
    result[key] = toPlain(v);
  }
  return result as unknown as T;
}

/**
 * Lexical max of the `updated` field across records — PB datetime strings
 * (`YYYY-MM-DD HH:mm:ss.SSSZ`) sort lexically, the same contract as the
 * delta filter. Returns '' when no record carries a usable value, in which
 * case the cursor keeps its previous position (never skips unfetched data).
 */
function maxUpdated(records: PbDoc[]): string {
  let max = "";
  for (const record of records) {
    const u = record.updated || "";
    if (u > max) max = u;
  }
  return max;
}

/**
 * Format a Date in PocketBase's canonical datetime format
 * (`YYYY-MM-DD HH:mm:ss.SSSZ` — space separator, UTC): the shared lexical
 * contract of delta cursors and datetime filters.
 */
export function pbDate(date: Date = new Date()): string {
  return date.toISOString().replace("T", " ");
}

/**
 * Marge retirée à l'horloge client avant de plafonner le curseur — absorbe
 * une petite avance de l'horloge client sans re-fetch superflu.
 */
const CURSOR_CLOCK_MARGIN_MS = 5 * 60 * 1000;

/**
 * Horloge client au format PB (`YYYY-MM-DD HH:mm:ss.SSSZ`, UTC) — le même
 * gabarit lexical que `maxUpdated` et le filtre delta. NB : `toISOString()`
 * produit un séparateur `T`, qui trierait lexiquement AU-DESSUS de tout
 * timestamp PB du même jour (espace < T) et rendrait le plafond inopérant
 * pour les dérives intra-journal — d'où `pbDate()`.
 */
function clientClockCap(now: number = Date.now()): string {
  return pbDate(new Date(now - CURSOR_CLOCK_MARGIN_MS));
}

/**
 * Garde « anti-curseur empoisonné » : plafonne le curseur delta à l'horloge
 * client (moins marge). Un `updated` futur (dérive d'horloge serveur) ne
 * doit jamais hisser le curseur au-dessus du présent — une fois l'horloge
 * corrigée, tout record écrit après correction passerait sous le curseur :
 * trou permanent. `min()` ne peut qu'abaisser le curseur — au pire (horloge
 * client fausse) le delta re-fetch des records connus (upserts idempotents),
 * il ne saute jamais de données.
 */
function capToClientClock(cursor: string): string {
  if (!cursor) return cursor;
  const cap = clientClockCap();
  return cursor > cap ? cap : cursor;
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
    for (const item of remote ?? [])
      map.set((item as Record<string, unknown>)[key], item);
    for (const item of local ?? [])
      map.set((item as Record<string, unknown>)[key], item);
    return Array.from(map.values());
  };
}

/** Apply merge strategies to a payload, using the server record as base. */
function applyMergeStrategies<T extends PbDoc>(
  payload: Partial<T>,
  serverRecord: T,
  strategies: PbSyncOptions<T>["mergeStrategies"],
): Partial<T> {
  if (!strategies) return payload;
  const merged = { ...payload };
  for (const field of Object.keys(strategies) as (keyof T)[]) {
    if (field in payload && strategies[field]) {
      (merged as Record<string, unknown>)[field as string] = strategies[field]!(
        payload[field] as NonNullable<T[keyof T]>,
        serverRecord[field] as NonNullable<T[keyof T]>,
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
  params?: PbFetchOptions,
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
    this.name = "RecordDeletedError";
    this.recordId = recordId;
    this.collectionId = collectionId;
  }
}

/**
 * Thrown by `update` when the record is neither in the local cache nor on the
 * server (verified live). The caller may upsert — e.g. materialize a virtual
 * record — or surface the error; an unknown id is still a legitimate failure.
 */
export class RecordNotFoundError extends Error {
  readonly recordId: string;
  readonly collectionId: string;

  constructor(recordId: string, collectionId: string) {
    super(`Record "${recordId}" not found on "${collectionId}" (server 404)`);
    this.name = "RecordNotFoundError";
    this.recordId = recordId;
    this.collectionId = collectionId;
  }
}

// =============================================================================
// BATCH TYPES (module scope — referenced by the public return type)
// =============================================================================

export interface BatchResult<T extends PbDoc> {
  records: T[];
}

export interface CollectionBatch<T extends PbDoc> {
  create(
    data: Omit<T, "id" | "created" | "updated"> & { id?: string },
  ): CollectionBatch<T>;
  /**
   * Create-or-update decided server-side: PocketBase executes the request
   * as an update when the body carries an id that already exists, as a
   * create otherwise (`PUT /records`). For callers that cannot know
   * whether the record is already on the server — the primitive tranches
   * both ways. A client id is preserved (same keepId seam as `create`).
   */
  upsert(
    data: Omit<T, "id" | "created" | "updated"> & { id?: string },
  ): CollectionBatch<T>;
  update(id: string, data: Partial<T>): CollectionBatch<T>;
  delete(id: string): CollectionBatch<T>;
  send(): Promise<BatchResult<T>>;
}

/**
 * Sub-requests per batch chunk — mirrors the server `batch.maxRequests`
 * setting (default 100). The server rejects a batch carrying more than
 * that; keep the two in sync at deployment time (checklist S2).
 */
export const PB_BATCH_MAX_REQUESTS = 100;

/**
 * Splits items into batch-sized chunks, clamped to PB_BATCH_MAX_REQUESTS.
 */
function* batchChunks<X>(items: X[], size?: number): Generator<X[]> {
  const step = Math.max(
    1,
    Math.min(size ?? PB_BATCH_MAX_REQUESTS, PB_BATCH_MAX_REQUESTS),
  );
  for (let i = 0; i < items.length; i += step) yield items.slice(i, i + step);
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
 * @param table - Dexie table (uses `id` as primary key)
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
export function createSyncCollection<T extends PbDoc>(
  pb: PocketBase,
  table: Table<T>,
  collectionName: PbCollectionName,
  options?: PbSyncOptions<T>,
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
   * Clé du curseur delta de cette collection dans `syncMeta` — scoped
   * (`${collectionName}:${scopeKey}`) ou non. Une seule définition du
   * format : initialFetch, resetCursor et clearLocal la partagent.
   */
  function syncMetaKey(scopeKey?: string): string {
    return scopeKey ? `${collectionName}:${scopeKey}` : collectionName;
  }

  /**
   * Incremental sync: fetches records updated since the persisted cursor of
   * this collection (scoped by `scopeKey` when provided, key
   * `${collectionName}:${scopeKey}` in the `syncMeta` table).
   *
   * The cursor is written in the SAME Dexie transaction as the upserts —
   * if any upsert fails, both roll back, so the cursor never skips
   * unfetched data (the old table-derived cursor made older scopes
   * unfetchable after a newer scope had been synced).
   *
   * Uses `getFullList()` with auto-pagination (PocketBase SDK handles this).
   *
   * @param fetchOptions - Optional PocketBase filter/scope for the fetch
   */
  async function initialFetch(fetchOptions?: PbFetchOptions): Promise<void> {
    // 1. Read the persisted delta cursor (scoped when scopeKey is provided)
    const syncKey = syncMetaKey(fetchOptions?.scopeKey);
    const meta = await db.syncMeta.get(syncKey);
    const since = meta?.lastSync ?? "2000-01-01 00:00:00.000Z";
    const localCount = await table.count();

    // 2. Build the delta filter — `>=` replays boundary records (the upsert
    //    is idempotent by id) so same-timestamp mutations are never dropped.
    //    The epochFilter only applies when the cursor is ABSENT (session
    //    full fetch): it bounds the unbounded fetch and must NEVER apply to
    //    incremental fetches — mutations of out-of-window records stay live.
    const userFilter = resolveFilter(pb, fetchOptions);
    const epochFilter =
      meta?.lastSync && fetchOptions?.epochFilter
        ? undefined
        : resolveFilter(pb, { filter: fetchOptions?.epochFilter });
    const scopeFilter =
      [userFilter, epochFilter].filter(Boolean).join(" && ") || undefined;
    const combinedVars = {
      ...(Array.isArray(fetchOptions?.filter) ? fetchOptions!.filter[1] : {}),
      ...(Array.isArray(fetchOptions?.epochFilter)
        ? fetchOptions!.epochFilter[1]
        : {}),
      since,
    };

    const deltaFilter = scopeFilter
      ? pb.filter(`(${scopeFilter}) && updated >= {:since}`, combinedVars)
      : pb.filter("updated >= {:since}", { since });

    console.log(
      `[pb-sync] ${collectionName}${fetchOptions?.scopeKey ? `:${fetchOptions.scopeKey}` : ""}: fetching with filter="${deltaFilter}" (localCount=${localCount})`,
    );

    // 3. Fetch all updated records from PocketBase (with delta filter)
    const queryOpts = {
      sort: "updated",
      ...(fetchOptions?.fields ? { fields: fetchOptions.fields } : {}),
      ...(fetchOptions?.expand ? { expand: fetchOptions.expand } : {}),
      ...(fetchOptions?.query ? { query: fetchOptions.query } : {}),
    };

    let freshRecords = await pb.collection(collectionName).getFullList({
      filter: deltaFilter,
      ...queryOpts,
    });

    // 3b. Fallback: if delta filter returned 0 but local DB is empty,
    //     retry WITHOUT the updated filter (full fetch).
    //     This handles the case where `updated` column was added after
    //     the initial data import and existing records have null/empty values.
    if (freshRecords.length === 0 && localCount === 0) {
      // Keeps the epochFilter (a scope bound, not a delta-time filter);
      // only the `updated >=` replay condition is dropped.
      const fullFilter = scopeFilter;
      console.warn(
        `[pb-sync] ${collectionName}: delta filter returned 0, local DB empty — retrying without updated filter`,
      );
      freshRecords = await pb.collection(collectionName).getFullList({
        ...(fullFilter ? { filter: fullFilter } : {}),
        ...queryOpts,
      });
    }

    // 4. Upsert into Dexie + advance the cursor in ONE transaction — if any
    //    upsert fails, Dexie rolls back both ("rows written but cursor moved"
    //    desync is impossible). The upsert is unconditional (no updated-only
    //    skip): the `>=` boundary replay exists for same-timestamp mutations,
    //    which an updated-only guard would silently drop.
    const records = freshRecords as unknown as T[];
    const newCursor = capToClientClock(maxUpdated(records));

    if (records.length > 0) {
      await db.transaction("rw", [table, db.syncMeta], async () => {
        for (const record of records) {
          const existing = await table.get(record.id);
          if (existing) {
            await table.update(record.id, record as unknown as UpdateSpec<T>);
          } else {
            await table.put(record);
          }
        }
        // A usable cursor only exists after records were observed — no
        // write when nothing (or only `updated`-less rows) came back
        if (newCursor) {
          await db.syncMeta.put({
            collectionId: syncKey,
            lastSync: newCursor,
          } satisfies SyncMetaRow);
        }
      });
    }

    console.log(
      `[pb-sync] ${collectionName}: ${freshRecords.length} records synced (since: ${since.slice(0, 19)})`,
    );
  }

  /**
   * Invalide le curseur delta de cette collection SANS toucher aux données
   * locales : le prochain `initialFetch` repart de l'époque et rejoue un
   * fetch complet en upserts idempotents (pas de fenêtre d'état vide).
   *
   * À appeler quand le périmètre autorisé côté serveur s'élargit (join
   * d'event par share link, invitation team…) : les records nouvellement
   * autorisés portent un `updated` antérieur au curseur local, qu'aucun
   * delta ne ramènera jamais.
   *
   * @param scopeKey - n'invalide que le curseur de ce scope ; sans argument,
   *   c'est le curseur non-scopé de la collection qui est invalidé.
   */
  async function resetCursor(scopeKey?: string): Promise<void> {
    await db.syncMeta.delete(syncMetaKey(scopeKey));
    console.log(`[pb-sync] resetCursor ${syncMetaKey(scopeKey)}`);
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
  function subscribeToCollection(
    subOptions?: PbSubscribeOptions,
  ): PbSubscriptionRef {
    const subId = `${collectionName}_${++subCounter}`;
    const resolvedFilter = resolveFilter(pb, subOptions);
    const topic = subOptions?.record ?? "*";

    const ref: PbSubscriptionRef = {
      id: subId,
      collection: collectionName,
      filter: resolvedFilter,
    };

    // Handler: applies realtime events to Dexie (with normalization)
    const subscribePromise = pb.collection(collectionName).subscribe(
      topic,
      async (event) => {
        const record = event.record as unknown as T;

        if (event.action === "delete") {
          if (softDelete) {
            const existing = await table.get(record.id);
            if (existing) {
              await table.put({ ...existing, deleted: true } as unknown as T);
            }
          } else {
            await table.delete(record.id);
          }
          console.log(
            `[pb-sync] realtime DELETE ${collectionName}/${record.id}`,
          );
        } else {
          const existing = await table.get(record.id);
          if (existing) {
            await table.update(record.id, record as unknown as UpdateSpec<T>);
          } else {
            await table.put(record);
          }
          console.log(
            `[pb-sync] realtime ${event.action.toUpperCase()} ${collectionName}/${record.id}`,
          );
        }
      },
      {
        ...(resolvedFilter ? { filter: resolvedFilter } : {}),
        ...(subOptions?.query ? { query: subOptions.query } : {}),
      },
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
  async function unsubscribe(
    subRefOrId: PbSubscriptionRef | string,
  ): Promise<void> {
    const subId = typeof subRefOrId === "string" ? subRefOrId : subRefOrId.id;
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
   * @param data - Record data (id is optional and passed through to PocketBase)
   * @returns The confirmed record
   */
  async function create(
    data: Omit<T, "id" | "created" | "updated"> & { id?: string },
  ): Promise<T> {
    const pbData = stripSystemFields(toPlain(data) as Partial<T>, true);

    const pbResult = await pb.collection(collectionName).create(pbData);

    const confirmed = pbResult as unknown as T;
    await table.put(confirmed);
    console.log(`[pb-sync] create ${collectionName}/${confirmed.id}`);
    return confirmed;
  }

  // =====================================================================
  // CRUD — UPDATE (OPTIMISTIC WITH ROLLBACK)
  // =====================================================================

  /**
   * Optimistic update: writes to Dexie immediately, pushes to PocketBase,
   * rolls back on failure. Applies merge strategies for array fields if configured.
   *
   * @param id - Record id
   * @param data - Partial update data
   * @returns The confirmed record (normalized to Appwrite format)
   */
  async function update(id: string, data: Partial<T>): Promise<T> {
    // 0. Normalize the payload: dereference $state proxies BEFORE the
    //    optimistic Dexie write (structured clone cannot clone proxies)
    data = toPlain(data);

    // 1. Snapshot current state (for rollback). Offline-first attach: the
    //    record may exist server-side while still missing from the local
    //    cache (delta sync behind) — mirror it instead of failing. A server
    //    404 throws typed: the caller decides whether to upsert (e.g. a
    //    virtual record) or surface the error.
    let current = await table.get(id);
    if (!current) {
      let serverRaw;
      try {
        serverRaw = await pb.collection(collectionName).getOne(id, {
          requestKey: null,
        });
      } catch (err: any) {
        if (err?.status === 404) {
          throw new RecordNotFoundError(id, collectionName);
        }
        throw err;
      }
      current = serverRaw as unknown as T;
      await table.put(current);
    }

    // 2. Optimistic write to Dexie
    await table.update(id, data as unknown as UpdateSpec<T>);

    try {
      // 3. Apply merge strategies if needed
      let payload = stripSystemFields(data);
      if (mergeStrategies) {
        const fieldsToMerge = Object.keys(mergeStrategies) as (keyof T)[];
        const hasConflictableField = fieldsToMerge.some((f) => f in data);
        if (hasConflictableField) {
          const serverRaw = await pb.collection(collectionName).getOne(id, {
            requestKey: null,
          });
          const serverRecord = serverRaw as unknown as T;
          const merged = applyMergeStrategies(
            data,
            serverRecord,
            mergeStrategies,
          );
          payload = stripSystemFields(merged);
        }
      }

      // 4. Push to PocketBase
      const pbResult = await pb.collection(collectionName).update(id, payload);

      // 5. Confirm with server state
      const confirmed = pbResult as unknown as T;
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
        err.message,
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
   * @param id - Record id
   */
  async function remove(id: string): Promise<void> {
    const snapshot = await table.get(id);
    if (!snapshot) {
      throw new Error(
        `[pb-sync] Record ${id} not found in Dexie (${collectionName})`,
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
        err.message,
      );
      throw err;
    }
  }

  // =====================================================================
  // BATCH OPERATIONS
  // =====================================================================

  interface PendingOp {
    type: "create" | "update" | "upsert" | "delete";
    id?: string;
    data?: Record<string, unknown>;
  }

  /**
   * Creates a batch builder for atomic multi-operation requests.
   * Uses PocketBase native `pb.createBatch()`.
   */
  function createBatch(): CollectionBatch<T> {
    const ops: PendingOp[] = [];

    const builder: CollectionBatch<T> = {
      create(data) {
        ops.push({
          type: "create",
          data: stripSystemFields(toPlain(data) as Partial<T>, true),
        });
        return builder;
      },
      upsert(data) {
        const stripped = stripSystemFields(toPlain(data) as Partial<T>, true);
        ops.push({
          type: "upsert",
          id: stripped.id as string | undefined,
          data: stripped,
        });
        return builder;
      },
      update(id, data) {
        ops.push({
          type: "update",
          id,
          data: stripSystemFields(toPlain(data)),
        });
        return builder;
      },
      delete(id) {
        ops.push({ type: "delete", id });
        return builder;
      },

      async send(): Promise<BatchResult<T>> {
        if (ops.length === 0) return { records: [] };

        // Snapshot for rollback — update/delete target an existing row;
        // an upsert carrying an id may too (its pre-batch state, or the
        // absence of a snapshot, drives the rollback below)
        const snapshotIds = ops
          .filter(
            (op) =>
              op.type === "update" ||
              op.type === "delete" ||
              (op.type === "upsert" && op.id !== undefined),
          )
          .map((op) => op.id!);
        const snapshots =
          snapshotIds.length > 0 ? await table.bulkGet(snapshotIds) : [];

        // Optimistic local writes
        for (const op of ops) {
          switch (op.type) {
            case "update": {
              const current = await table.get(op.id!);
              if (current) {
                await table.put({ ...current, ...op.data } as unknown as T);
              }
              break;
            }
            case "upsert": {
              // Patch semantics on an existing row, plain put otherwise.
              // Without an id there is nothing sensible to write yet —
              // the server generates it and the confirmed bulkPut below
              // mirrors the created row.
              if (op.id !== undefined) {
                const current = await table.get(op.id);
                await table.put({
                  ...(current ?? {}),
                  ...op.data,
                } as unknown as T);
              }
              break;
            }
            case "delete":
              await table.delete(op.id!);
              break;
          }
        }

        try {
          // PocketBase batch
          const batch = pb.createBatch();

          for (const op of ops) {
            switch (op.type) {
              case "create":
                batch.collection(collectionName).create(op.data);
                break;
              case "upsert":
                batch.collection(collectionName).upsert(op.data);
                break;
              case "update":
                batch.collection(collectionName).update(op.id!, op.data);
                break;
              case "delete":
                batch.collection(collectionName).delete(op.id!);
                break;
            }
          }

          const results = await batch.send();

          // Confirm
          const confirmed = results
            .map((r) => r.body)
            .filter(Boolean)
            .map((body) => body as unknown as T);

          if (confirmed.length > 0) {
            await table.bulkPut(confirmed);
          }

          return { records: confirmed };
        } catch (err) {
          // Rollback: restore snapshots, then drop the rows the optimistic
          // upserts CREATED locally (no pre-batch snapshot → the record did
          // not exist; a failed batch leaves no orphan line behind). Creates
          // are never written locally before send — nothing to undo there.
          const valid = snapshots.filter(Boolean) as T[];
          if (valid.length > 0) await table.bulkPut(valid);

          for (const op of ops) {
            if (op.type === "upsert" && op.id !== undefined) {
              const wasExisting = snapshots.some(
                (s) => s && (s as T).id === op.id,
              );
              if (!wasExisting) await table.delete(op.id);
            }
          }

          throw err;
        }
      },
    };

    return builder;
  }

  /**
   * Bulk create multiple records in batched requests. Chunks automatically
   * at `options.batchSize` (default `PB_BATCH_MAX_REQUESTS`). Rollback is
   * per chunk — chunks already sent before a failing one stay committed.
   */
  async function bulkCreate(
    items: Omit<T, "id" | "created" | "updated">[],
    options?: PbBulkOptions,
  ): Promise<T[]> {
    const out: T[] = [];
    for (const chunk of batchChunks(items, options?.batchSize)) {
      const b = createBatch();
      for (const item of chunk) b.create(item);
      const { records } = await b.send();
      out.push(...records);
    }
    return out;
  }

  /**
   * Bulk update multiple records in batched requests. Same chunking and
   * per-chunk rollback semantics as `bulkCreate`.
   */
  async function bulkUpdate(
    items: { id: string; data: Partial<T> }[],
    options?: PbBulkOptions,
  ): Promise<T[]> {
    const out: T[] = [];
    for (const chunk of batchChunks(items, options?.batchSize)) {
      const b = createBatch();
      for (const item of chunk) b.update(item.id, item.data);
      const { records } = await b.send();
      out.push(...records);
    }
    return out;
  }

  /**
   * Upserts a single record — sugar for a one-operation batch (the SDK has
   * no single-record upsert on RecordService, everything goes through
   * `pb.createBatch()`). The server updates when the body's id exists,
   * creates otherwise.
   */
  async function upsert(
    data: Omit<T, "id" | "created" | "updated"> & { id?: string },
  ): Promise<T> {
    const b = createBatch();
    b.upsert(data);
    const { records } = await b.send();
    return records[0];
  }

  /**
   * Bulk upsert multiple records in batched requests. Same chunking and
   * per-chunk rollback semantics as `bulkCreate`.
   */
  async function bulkUpsert(
    items: (Omit<T, "id" | "created" | "updated"> & { id?: string })[],
    options?: PbBulkOptions,
  ): Promise<T[]> {
    const out: T[] = [];
    for (const chunk of batchChunks(items, options?.batchSize)) {
      const b = createBatch();
      for (const item of chunk) b.upsert(item);
      const { records } = await b.send();
      out.push(...records);
    }
    return out;
  }

  /**
   * Bulk delete multiple records in batched requests. Same chunking and
   * per-chunk rollback semantics as `bulkCreate`.
   */
  async function bulkDelete(
    ids: string[],
    options?: PbBulkOptions,
  ): Promise<void> {
    for (const chunk of batchChunks(ids, options?.batchSize)) {
      const b = createBatch();
      for (const id of chunk) b.delete(id);
      await b.send();
    }
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
    return pb
      .collection(collectionName)
      .getList(params?.page ?? 1, params?.perPage ?? 30, {
        ...(resolvedFilter ? { filter: resolvedFilter } : {}),
        ...(params?.sort ? { sort: params.sort } : {}),
        ...(params?.fields ? { fields: params.fields } : {}),
        ...(params?.expand ? { expand: params.expand } : {}),
        ...(params?.query ? { query: params.query } : {}),
      });
  }

  /**
   * Fetch a single record by ID from PocketBase (bypasses Dexie).
   */
  async function view(id: string, params?: PbFetchOptions): Promise<T> {
    const raw = await pb.collection(collectionName).getOne(id, {
      ...(params?.fields ? { fields: params.fields } : {}),
      ...(params?.expand ? { expand: params.expand } : {}),
      ...(params?.query ? { query: params.query } : {}),
    });
    return raw as unknown as T;
  }

  // =====================================================================
  // UTILITY
  // =====================================================================

  /** Returns the underlying Dexie table for direct queries / liveQuery. */
  function getTable(): Table<T> {
    return table;
  }

  /**
   * Clears the Dexie table for this collection plus its delta cursors in
   * `syncMeta`: scoped keys (`${name}:${scope}`) by prefix, the unscoped
   * key explicitly. The `:` suffix keeps `materiel` from matching
   * `materiel_loan:*` keys.
   *
   * Used on logout / force reload to prevent stale data from leaking
   * across users or events — the next sync performs a full fetch.
   */
  async function clearLocal(): Promise<void> {
    await db.transaction("rw", [table, db.syncMeta], async () => {
      await table.clear();
      await db.syncMeta
        .where("collectionId")
        .startsWith(`${collectionName}:`)
        .delete();
      await db.syncMeta.delete(syncMetaKey());
    });
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
    bulkUpsert,
    bulkDelete,
    upsert,

    // Convenience queries
    list,
    view,

    // Utility
    getTable,
    get collectionName() {
      return collectionName;
    },
    clearLocal,
    resetCursor,
  };
}
