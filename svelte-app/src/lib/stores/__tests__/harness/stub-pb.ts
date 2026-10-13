/**
 * Fake PocketBase SDK — transport-level stub for store/db-sync integration tests.
 *
 * Why mock the `pocketbase` module rather than `createSyncCollection`:
 * the tests then exercise the REAL pb-sync logic (delta fetch with the
 * `updated > {:since}` cursor, Dexie transactions, upsert, optimistic
 * writes, realtime handlers) — the same code path production uses, minus
 * the network. The fake keeps an in-memory record store per collection and
 * evaluates PB filter expressions against it, so delta-sync semantics are
 * faithful.
 *
 * Contract fidelity (PocketBase 0.37 / js-sdk 0.26):
 * - records are plain JSON objects: `PbDoc { id, created, updated }` + fields
 * - dates use the PB format `YYYY-MM-DD HH:mm:ss.SSSZ` (space, no `T` —
 *   never split on "T"); comparisons are LEXICAL (PB stores datetimes as
 *   TEXT in SQLite) — the fake evaluates `>`/`<` as string comparison,
 *   which is exactly what the real server does
 * - `pb.filter()` interpolates `{:var}` placeholders exactly like the real
 *   SDK: single-quoted strings (inner `'` escaped), bare numbers/booleans,
 *   `null` literal, Date → ISO-with-space inside single quotes
 * - `collection().subscribe()` resolves to an async unsubscribe; events are
 *   `{ action, record }` delivered to '*' and matching record-id topics
 * - relation fields declared via `defineRelations()` are validated on every
 *   write (single or batch): a non-empty value referencing no existing record
 *   of the target collection is rejected with 400 `validation_invalid_relation`,
 *   like the real server — undeclared collections accept any value; `seed()`
 *   and `putRecord()` stay raw (no validation, test-state manipulation)
 *
 * Usage in a test file:
 * ```ts
 * vi.mock("pocketbase", async () => {
 *   const { FakePocketBase } = await import("./harness/stub-pb");
 *   return { default: FakePocketBase };
 * });
 * import { currentFakePb } from "./harness/stub-pb";
 *
 * const fakePb = currentFakePb(); // instance created by $lib/db-sync/pb
 * fakePb.seed("products", [productRecord]);
 * fakePb.emit("products", "update", bumpedRecord);
 * ```
 *
 * Filter evaluator scope: parens, `&&`/`||`, `= != > >= < <= ~ !~` on a
 * single record. This covers every filter shape pb-sync emits
 * (`(eventId = '...') && updated > '...'`, raw `updated > '...'`).
 */

/** A record as PocketBase returns it: plain JSON with native system fields. */
export type PbRecord = Record<string, unknown> & {
  id: string;
  created: string;
  updated: string;
};

/** Format a Date (or date string) as a PocketBase datetime: `YYYY-MM-DD HH:mm:ss.SSSZ`. */
export function pbDate(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().replace("T", " ");
}

// =============================================================================
// FILTER INTERPOLATION — mirror of the js-sdk `pb.filter()`
// =============================================================================

function interpolateValue(value: unknown): string {
  switch (typeof value) {
    case "boolean":
    case "number":
      return String(value);
    case "string":
      return "'" + value.replace(/'/g, "\\'") + "'";
    default:
      if (value === null) return "null";
      if (value === undefined) return "null";
      if (value instanceof Date) {
        return "'" + value.toISOString().replace("T", " ") + "'";
      }
      return "'" + JSON.stringify(value).replace(/'/g, "\\'") + "'";
  }
}

function pbFilter(raw: string, vars?: Record<string, unknown>): string {
  if (!vars) return raw;
  let result = raw;
  for (const key of Object.keys(vars)) {
    result = result.replaceAll("{:" + key + "}", interpolateValue(vars[key]));
  }
  return result;
}

// =============================================================================
// FILTER EVALUATION — minimal PB expression engine over one record
// =============================================================================

type TokenType = "LPAREN" | "RPAREN" | "AND" | "OR" | "OP" | "IDENT" | "LITERAL";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ch });
      i++;
      continue;
    }
    if (input.startsWith("&&", i)) {
      tokens.push({ type: "AND", value: "&&" });
      i += 2;
      continue;
    }
    if (input.startsWith("||", i)) {
      tokens.push({ type: "OR", value: "||" });
      i += 2;
      continue;
    }
    const twoCharOp = input.slice(i, i + 2);
    if (twoCharOp === ">=" || twoCharOp === "<=" || twoCharOp === "!=" || twoCharOp === "!~") {
      tokens.push({ type: "OP", value: twoCharOp });
      i += 2;
      continue;
    }
    if (ch === "=" || ch === ">" || ch === "<" || ch === "~") {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }
    if (ch === "'") {
      // Single-quoted string with backslash escapes (SDK interpolation form).
      let value = "";
      i++;
      while (i < input.length && input[i] !== "'") {
        if (input[i] === "\\" && i + 1 < input.length) {
          value += input[i + 1];
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }
      i++; // closing quote
      tokens.push({ type: "LITERAL", value });
      continue;
    }
    if (/[0-9-]/.test(ch) && /[0-9]/.test(ch)) {
      // Bare number (identifiers can't start with a digit)
      let value = "";
      while (i < input.length && /[0-9.eE+-]/.test(input[i])) {
        value += input[i];
        i++;
      }
      tokens.push({ type: "LITERAL", value });
      continue;
    }
    if (/[a-zA-Z_$@]/.test(ch)) {
      let value = "";
      while (i < input.length && /[a-zA-Z0-9_$.@:\\-]/.test(input[i])) {
        value += input[i];
        i++;
      }
      // pb.filter() writes bare `null` / `true` / `false` for these values
      if (value === "null" || value === "true" || value === "false") {
        tokens.push({ type: "LITERAL", value });
      } else {
        tokens.push({ type: "IDENT", value });
      }
      continue;
    }
    throw new Error(`[stub-pb] Unexpected character in filter at ${i}: '${ch}' in "${input}"`);
  }
  return tokens;
}

/**
 * Resolve a field reference against a record. Dotted paths walk nested
 * objects; a missing path resolves to `undefined` (like a PB field that
 * isn't set).
 */
function resolveField(record: PbRecord, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asComparable(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function compareValues(left: unknown, op: string, right: unknown): boolean {
  const l = asComparable(left);
  const r = asComparable(right);
  const bothNumeric =
    (typeof l === "number" || (l !== null && l !== "" && !isNaN(Number(l)))) &&
    (typeof r === "number" || (r !== null && r !== "" && !isNaN(Number(r))));

  switch (op) {
    case "=":
      if (bothNumeric) return Number(l) === Number(r);
      return l === r || (l === null && r === "null") || (r === null && l === "null");
    case "!=":
      return !compareValues(left, "=", right);
    case ">":
    case ">=":
    case "<":
    case "<=":
      // PB stores datetimes as TEXT — ordering is lexical (SQLite collation).
      if (bothNumeric) {
        const ln = Number(l);
        const rn = Number(r);
        return op === ">" ? ln > rn : op === ">=" ? ln >= rn : op === "<" ? ln < rn : ln <= rn;
      }
      {
        const ls = l ?? "";
        const rs = r ?? "";
        return op === ">"
          ? ls > rs
          : op === ">="
            ? ls >= rs
            : op === "<"
              ? ls < rs
              : ls <= rs;
      }
    case "~":
    case "!~": {
      // PB `~` = case-insensitive LIKE (substring match)
      const ls = String(l ?? "");
      const rs = String(r ?? "");
      const contains = ls.toLowerCase().includes(rs.toLowerCase());
      return op === "~" ? contains : !contains;
    }
    default:
      throw new Error(`[stub-pb] Unknown operator: ${op}`);
  }
}

function evaluateFilter(filter: string, record: PbRecord): boolean {
  const tokens = tokenize(filter);
  let pos = 0;

  function parseOr(): boolean {
    let result = parseAnd();
    while (pos < tokens.length && tokens[pos].type === "OR") {
      pos++;
      result = parseAnd() || result;
    }
    return result;
  }

  function parseAnd(): boolean {
    let result = parseAtom();
    while (pos < tokens.length && tokens[pos].type === "AND") {
      pos++;
      result = parseAtom() && result;
    }
    return result;
  }

  function parseAtom(): boolean {
    if (tokens[pos].type === "LPAREN") {
      pos++;
      const result = parseOr();
      if (tokens[pos]?.type !== "RPAREN") {
        throw new Error(`[stub-pb] Missing ')' in filter: ${filter}`);
      }
      pos++;
      return result;
    }
    // comparison: operand op operand
    const leftTok = tokens[pos];
    const opTok = tokens[pos + 1];
    const rightTok = tokens[pos + 2];
    if (!leftTok || !opTok || opTok.type !== "OP" || !rightTok) {
      throw new Error(`[stub-pb] Malformed comparison in filter: ${filter}`);
    }
    pos += 3;
    const left = leftTok.type === "IDENT" ? resolveField(record, leftTok.value) : parseLiteral(leftTok);
    const right = rightTok.type === "IDENT" ? resolveField(record, rightTok.value) : parseLiteral(rightTok);
    return compareValues(left, opTok.value, right);
  }

  function parseLiteral(token: Token): unknown {
    if (token.value === "null") return null;
    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (!isNaN(Number(token.value)) && token.value.trim() !== "") return Number(token.value);
    return token.value;
  }

  const result = parseOr();
  if (pos !== tokens.length) {
    throw new Error(`[stub-pb] Trailing tokens in filter: ${filter}`);
  }
  return result;
}

function sortRecords(records: PbRecord[], sort: string): PbRecord[] {
  const fields = sort.split(",").map((f) => f.trim());
  return [...records].sort((a, b) => {
    for (const field of fields) {
      const desc = field.startsWith("-");
      const key = desc ? field.slice(1) : field;
      const av = asComparable(a[key]) ?? "";
      const bv = asComparable(b[key]) ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

// =============================================================================
// FAKE POCKETBASE CLIENT
// =============================================================================

interface FakeRequestError extends Error {
  status: number;
  response?: Record<string, unknown>;
}

function notFoundError(id: string): FakeRequestError {
  const err = new Error(`The requested resource wasn't found. id=${id}`) as FakeRequestError;
  err.status = 404;
  return err;
}

/** PB wire contract (measured, probe-t10): a create carrying an id that
 * already exists is rejected with 400 + a field error on `id` — this is what
 * makes a client-provided id usable as an idempotency key. */
function duplicateIdError(id: string): FakeRequestError {
  const err = new Error(`Failed to create record. id=${id}`) as FakeRequestError;
  err.status = 400;
  err.response = {
    code: 400,
    message: "Failed to create record.",
    data: { id: { code: "validation_not_unique", message: "Value must be unique." } },
  };
  return err;
}

// =============================================================================
// RECORD OPERATIONS — single semantic source for collection() and batch
// =============================================================================

/**
 * Résout le tableau de records d'une collection : le store vivant pour les
 * requêtes unitaires, l'ombre transactionnelle pour les ops d'un batch —
 * la validation relationnelle d'une op voit alors les ops antérieures du
 * même lot, comme chaque sous-requête du serveur voit l'état de sa
 * transaction.
 */
type RecordsView = (name: string) => PbRecord[];

interface WriteGuard {
  relations: Map<string, Map<string, string>>;
  view: RecordsView;
}

function opCreate(guard: WriteGuard, name: string, data: Record<string, unknown>): PbRecord {
  validateWriteRelations(guard.relations, guard.view, name, data, "create");
  const records = guard.view(name);
  if (data.id !== undefined && records.some((r) => r.id === data.id)) {
    throw duplicateIdError(data.id as string);
  }
  const now = pbDate();
  const record = {
    ...data,
    id: (data.id as string) ?? makeFakeId(),
    created: now,
    updated: now,
  } as PbRecord;
  records.push(record);
  return { ...record };
}

function opUpdate(guard: WriteGuard, name: string, id: string, data: Record<string, unknown>): PbRecord {
  validateWriteRelations(guard.relations, guard.view, name, data, "update");
  const records = guard.view(name);
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw notFoundError(id);
  const updated = {
    ...records[idx],
    ...data,
    id,
    updated: pbDate(),
  } as PbRecord;
  records[idx] = updated;
  return { ...updated };
}

function opDelete(records: PbRecord[], id: string): boolean {
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw notFoundError(id);
  records.splice(idx, 1);
  return true;
}

/** PB batch upsert (wire contract: `PUT /records`) — executed as an update
 * when the body carries an id that already exists, as a create otherwise
 * (a client-provided id is preserved on the create leg). */
function opUpsert(guard: WriteGuard, name: string, data: Record<string, unknown>): PbRecord {
  if (data.id !== undefined && guard.view(name).some((r) => r.id === data.id)) {
    return opUpdate(guard, name, data.id as string, data);
  }
  return opCreate(guard, name, data);
}

/**
 * Valide les champs relation déclarés pour la collection (defineRelations) :
 * une valeur non vide qui ne référence aucun record existant de la collection
 * cible est rejetée — un patch sans le champ, ou qui le pose à null/"",
 * reste valide (clear de relation).
 */
function validateWriteRelations(
  relations: Map<string, Map<string, string>>,
  view: RecordsView,
  name: string,
  data: Record<string, unknown>,
  verb: "create" | "update",
): void {
  const fields = relations.get(name);
  if (!fields) return;
  for (const [field, targetCollection] of fields) {
    const value = data[field];
    if (value === null || value === undefined || value === "") continue;
    const targets = view(targetCollection);
    const known = (candidate: unknown) =>
      typeof candidate === "string" && targets.some((r) => r.id === candidate);
    const dangling = Array.isArray(value)
      ? value.some((v) => !known(v))
      : !known(value);
    if (dangling) throw invalidRelationError(field, verb);
  }
}

/** PB relation validation — a write carrying a value that references no
 * existing record of the target collection is rejected (400), which is what
 * makes a relation field unusable as a free-form pointer. */
function invalidRelationError(field: string, verb: string): FakeRequestError {
  const err = new Error(`Failed to ${verb} record.`) as FakeRequestError;
  err.status = 400;
  err.response = {
    code: 400,
    message: `Failed to ${verb} record.`,
    data: {
      [field]: {
        code: "validation_invalid_relation",
        message: "Invalid or missing relation.",
      },
    },
  };
  return err;
}

/** Realtime payload, as delivered by the PB SSE channel. */
export interface FakeRealtimeEvent {
  action: "create" | "update" | "delete";
  record: PbRecord;
}

type SubscribeCallback = (data: FakeRealtimeEvent) => void | Promise<void>;

export class FakePocketBase {
  baseUrl: string;
  #store = new Map<string, PbRecord[]>();
  #subs = new Map<string, Set<{ topic: string; cb: SubscribeCallback }>>();
  /**
   * Fragment de schéma relationnel (defineRelations) : collection → champ →
   * collection cible. Survit à reset() — le schéma n'est pas des données.
   */
  relations = new Map<string, Map<string, string>>();

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? "http://localhost:8090";
    // The app ($lib/db-sync/pb) creates the client once at module load —
    // keep a handle so tests can reach the instance through currentFakePb().
    currentInstance = this;
  }

  /**
   * Déclare des champs relation : les écritures qui les portent valident la
   * cible comme le vrai serveur (400 `validation_invalid_relation` quand la
   * valeur ne référence aucun record existant de la collection cible). Une
   * collection sans déclaration accepte toute valeur ; idempotent.
   */
  defineRelations(spec: Record<string, Record<string, string>>): void {
    for (const [collectionName, fields] of Object.entries(spec)) {
      const map = this.relations.get(collectionName) ?? new Map<string, string>();
      for (const [field, target] of Object.entries(fields)) {
        map.set(field, target);
      }
      this.relations.set(collectionName, map);
    }
  }

  /** Garde d'écriture : validation + vue sur le store (ou l'ombre d'un batch). */
  #writeGuard(shadow?: Map<string, PbRecord[]>): WriteGuard {
    return {
      relations: this.relations,
      view: (name) => shadow?.get(name) ?? this.records(name),
    };
  }

  /** Mirrors the real SDK filter interpolation. */
  filter(raw: string, vars?: Record<string, unknown>): string {
    return pbFilter(raw, vars);
  }

  collection(name: string) {
    const store = this;
    return {
      async getFullList(options?: {
        filter?: string;
        sort?: string;
        fields?: string;
        expand?: string;
        query?: Record<string, string>;
      }): Promise<PbRecord[]> {
        let records = store.records(name);
        if (options?.filter) {
          records = records.filter((r) => evaluateFilter(options.filter!, r));
        }
        if (options?.sort) records = sortRecords(records, options.sort);
        // Return copies — like the JSON.parse of a real HTTP response.
        return records.map((r) => ({ ...r }));
      },

      async getOne(id: string): Promise<PbRecord> {
        const record = store.records(name).find((r) => r.id === id);
        if (!record) throw notFoundError(id);
        return { ...record };
      },

      async getList(
        page = 1,
        perPage = 30,
        options?: { filter?: string; sort?: string }
      ): Promise<{ page: number; perPage: number; totalItems: number; totalPages: number; items: PbRecord[] }> {
        let records = store.records(name);
        if (options?.filter) {
          records = records.filter((r) => evaluateFilter(options.filter!, r));
        }
        if (options?.sort) records = sortRecords(records, options.sort);
        const start = (page - 1) * perPage;
        const items = records.slice(start, start + perPage).map((r) => ({ ...r }));
        return {
          page,
          perPage,
          totalItems: records.length,
          totalPages: Math.max(1, Math.ceil(records.length / perPage)),
          items,
        };
      },

      async create(data: Record<string, unknown>): Promise<PbRecord> {
        return opCreate(store.#writeGuard(), name, data);
      },

      async update(id: string, data: Record<string, unknown>): Promise<PbRecord> {
        return opUpdate(store.#writeGuard(), name, id, data);
      },

      async delete(id: string): Promise<boolean> {
        return opDelete(store.records(name), id);
      },

      async subscribe(
        topic: string,
        cb: SubscribeCallback
      ): Promise<() => Promise<void>> {
        const entry = { topic, cb };
        if (!store.#subs.has(name)) store.#subs.set(name, new Set());
        store.#subs.get(name)!.add(entry);
        return async () => {
          store.#subs.get(name)?.delete(entry);
        };
      },
    };
  }

  /**
   * Batch request builder — mirrors the real SDK `pb.createBatch()`:
   * requests are queued per collection (SubBatchService shape) and executed
   * in ONE transaction on send(). A failing sub-request aborts the whole
   * batch with nothing applied (the server wraps batch execution in a
   * transaction); send() resolves with the per-request results
   * (`{ status, body }`) or throws the failing request's error.
   */
  createBatch() {
    const store = this;
    type BatchOp =
      | { kind: "create"; name: string; data: Record<string, unknown> }
      | { kind: "update"; name: string; id: string; data: Record<string, unknown> }
      | { kind: "upsert"; name: string; data: Record<string, unknown> }
      | { kind: "delete"; name: string; id: string };
    const requests: BatchOp[] = [];

    return {
      collection(name: string) {
        return {
          create(data: Record<string, unknown> = {}): void {
            requests.push({ kind: "create", name, data });
          },
          update(id: string, data: Record<string, unknown> = {}): void {
            requests.push({ kind: "update", name, id, data });
          },
          upsert(data: Record<string, unknown> = {}): void {
            requests.push({ kind: "upsert", name, data });
          },
          delete(id: string): void {
            requests.push({ kind: "delete", name, id });
          },
        };
      },

      async send(): Promise<Array<{ status: number; body: unknown }>> {
        if (requests.length === 0) return [];
        // Transactional semantics: execute on shadow copies of every touched
        // collection, commit only if ALL sub-requests succeeded.
        const names = new Set(requests.map((r) => r.name));
        const shadow = new Map<string, PbRecord[]>();
        for (const batchName of names) {
          shadow.set(
            batchName,
            store.records(batchName).map((r) => ({ ...r }))
          );
        }
        const results: Array<{ status: number; body: unknown }> = [];
        const guard = store.#writeGuard(shadow);
        for (const req of requests) {
          switch (req.kind) {
            case "create":
              results.push({ status: 200, body: opCreate(guard, req.name, req.data) });
              break;
            case "update":
              results.push({ status: 200, body: opUpdate(guard, req.name, req.id, req.data) });
              break;
            case "upsert":
              results.push({ status: 200, body: opUpsert(guard, req.name, req.data) });
              break;
            case "delete":
              opDelete(guard.view(req.name), req.id);
              // PB delete answers 204 No Content
              results.push({ status: 204, body: null });
              break;
          }
        }
        // Commit (seed() deep-copies — live arrays swap atomically per collection)
        for (const [batchName, arr] of shadow) store.seed(batchName, arr);
        return results;
      },
    };
  }

  // ===========================================================================
  // TEST-FACING API — server state manipulation
  // ===========================================================================

  /** Raw (mutable) in-memory records of a collection. Handle with care. */
  records(name: string): PbRecord[] {
    if (!this.#store.has(name)) this.#store.set(name, []);
    return this.#store.get(name)!;
  }

  /** Replace the server-side records of a collection (deep-copied in).
   * Accepts app-level record types (Products, Purchases…) — PB records are
   * plain JSON objects, the harness only guarantees the PbDoc system fields
   * on what it hands back (see records()/getFullList). */
  seed(name: string, records: object[]): void {
    this.#store.set(
      name,
      records.map((r) => structuredClone(r) as PbRecord)
    );
  }

  /** Upsert a single record server-side (tests can pass an explicit `updated`). */
  putRecord(name: string, record: object): PbRecord {
    const records = this.records(name);
    const copy = structuredClone(record) as PbRecord;
    const idx = records.findIndex((r) => r.id === copy.id);
    if (idx === -1) records.push(copy);
    else records[idx] = copy;
    return copy;
  }

  /** Deliver a realtime event, like the PB SSE channel would. */
  emit(name: string, action: FakeRealtimeEvent["action"], record: object): void {
    const pbRecord = record as PbRecord;
    const payload: FakeRealtimeEvent = { action, record: { ...pbRecord } };
    const subs = this.#subs.get(name);
    if (!subs) return;
    for (const entry of subs) {
      if (entry.topic === "*" || entry.topic === pbRecord.id) {
        void entry.cb(payload);
      }
    }
  }

  /** Wipe all server state and subscriptions. */
  reset(): void {
    this.#store.clear();
    this.#subs.clear();
  }
}

// PB random ids are 15 chars — same length keeps realistic cursors/sorting.
function makeFakeId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 15; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

let currentInstance: FakePocketBase | null = null;

/**
 * The FakePocketBase instance created by `$lib/db-sync/pb` (the app creates
 * it once at module load via `new PocketBase(PB_URL)`).
 */
export function currentFakePb(): FakePocketBase {
  if (!currentInstance) {
    throw new Error(
      "[stub-pb] No FakePocketBase instance yet — import the store under test (or `$lib/db-sync/pb`) before calling currentFakePb()."
    );
  }
  return currentInstance;
}
