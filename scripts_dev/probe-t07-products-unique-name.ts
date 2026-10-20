/**
 * Probe — borne productName (60) + unicité (eventId, productName), at the HTTP seam.
 *
 * Proves against a live PB instance that:
 *   - POST products with a 61-char productName → 400 on productName (max 60 enforced)
 *   - POST products twice with the same (event, name) WITHOUT the unique
 *     index → 200 + 200 (no guard — justifies the DDL migration + cleanup prerequisite)
 *   - POST products twice with the same (event, name) WITH a unique index
 *     (temporary partial index `sonde-t07-%`, same wire shape as the real
 *     DDL — the 400 shape does not depend on the predicate) → 200 then 400
 *     `validation_not_unique`, and prints the EXACT error shape the client
 *     maps to DuplicateProductNameError.
 *
 * Records created by the probe are deleted again (admin) and leftovers from
 * a crashed run are purged before creating — re-runnable.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded); the
 * target follows the pipeline convention PB_URL_OVERRIDE > .env.local PB_URL.
 *
 * Usage:
 *   1. bun run scripts_dev/probe-t07-products-unique-name.ts      # verdicts A (max) + B (no guard)
 *   2. stop PB, CREATE UNIQUE INDEX ... WHERE productName LIKE 'sonde-t07-%', restart
 *   3. PROBE_UNIQUE=1 bun run scripts_dev/probe-t07-products-unique-name.ts  # verdict C (400 shape)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = import.meta.dir;
const ENV_FILE = join(SCRIPTS_DIR, ".env.local");
const TIMEOUT_MS = 8000;

/** 61 chars — one over the max-60 bound. */
const TOO_LONG_NAME = "x".repeat(61);
/** Prefix covered by the temporary partial unique index (verdict C). */
const DUP_NAME = `sonde-t07-doublon ${Date.now()}`;
const WITH_UNIQUE = process.env.PROBE_UNIQUE === "1";

interface Env {
  base: string;
  adminEmail: string;
  adminPassword: string;
  userEmail: string;
  userPassword: string;
}

function loadEnv(): Env {
  if (!existsSync(ENV_FILE)) {
    console.error(
      `Missing ${ENV_FILE} — add PB_URL / PB_ADMIN_* / PB_USER_* there.`,
    );
    process.exit(1);
  }
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  const missing = [
    "PB_URL",
    "PB_ADMIN_EMAIL",
    "PB_ADMIN_PASSWORD",
    "PB_USER_EMAIL",
    "PB_USER_PASSWORD",
  ].filter((k) => !env[k]);
  if (missing.length > 0) {
    console.error(`Missing env keys in ${ENV_FILE}: ${missing.join(", ")}`);
    process.exit(1);
  }
  return {
    base: (process.env.PB_URL_OVERRIDE ?? env.PB_URL).replace(/\/$/, ""),
    adminEmail: env.PB_ADMIN_EMAIL,
    adminPassword: env.PB_ADMIN_PASSWORD,
    userEmail: env.PB_USER_EMAIL,
    userPassword: env.PB_USER_PASSWORD,
  };
}

async function pbFetch(
  base: string,
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: init.token } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body — keep null
  }
  return { status: res.status, json };
}

function verdict(tag: string, detail: string): void {
  console.log(`VERDICT ${tag}: ${detail}`);
}

/** Exact payload shape of ProductsStore.createProduct. */
function productPayload(eventId: string, userId: string, productName: string) {
  return {
    ingredientRef: null,
    productName,
    productType: "Autre",
    store: null,
    who: [],
    eventId,
    status: "active",
    stockReel: null,
    updatedBy: userId,
    isSynced: true,
    isMerged: false,
    mergedFrom: null,
    mergeDate: null,
    mergeReason: null,
    mergedInto: null,
    totalNeededOverride: null,
    specs: JSON.stringify({ pF: false, pS: false }),
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(
    `# probe products unique-name (WITH_UNIQUE=${WITH_UNIQUE ? "1" : "0"}) against ${env.base}`,
  );

  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  const admin = await pbFetch(
    env.base,
    "/api/collections/_superusers/auth-with-password",
    {
      method: "POST",
      body: { identity: env.adminEmail, password: env.adminPassword },
    },
  );
  if (admin.status !== 200) {
    console.error(
      `Admin auth failed (${admin.status}) — check PB_ADMIN_* in .env.local`,
    );
    process.exit(1);
  }
  const adminToken = admin.json.token as string;

  const user = await pbFetch(
    env.base,
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      body: { identity: env.userEmail, password: env.userPassword },
    },
  );
  if (user.status !== 200) {
    console.error(
      `User auth failed (${user.status}) — check PB_USER_* in .env.local`,
    );
    process.exit(1);
  }
  const userToken = user.json.token as string;
  const userId = user.json.record.id as string;
  console.log(`user id: ${userId}`);

  const events = await pbFetch(
    env.base,
    "/api/collections/events/records?perPage=200&sort=-created",
    {
      token: userToken,
    },
  );
  const items: any[] = events.json?.items ?? [];
  if (items.length === 0) {
    console.log("no visible event — nothing to probe");
    process.exit(1);
  }
  let targetId = items[0].id as string;
  for (const ev of items) {
    if (ev.createdBy === userId) {
      targetId = ev.id;
      break;
    }
  }
  console.log(`target event: ${targetId}`);

  // Crash-safe re-runs: purge leftovers first.
  const staleFilter = encodeURIComponent(`productName ~ "sonde-t07-doublon %"`);
  const stale = await pbFetch(
    env.base,
    `/api/collections/products/records?filter=${staleFilter}&perPage=50`,
    { token: adminToken },
  );
  for (const rec of stale.json?.items ?? []) {
    const del = await pbFetch(
      env.base,
      `/api/collections/products/records/${rec.id}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(
      `purge stale product ${rec.id} (${rec.productName}): ${del.status}`,
    );
  }

  const createdIds: string[] = [];
  try {
    if (!WITH_UNIQUE) {
      // A. Over-long name: must be rejected on productName (max 60).
      const long = await pbFetch(
        env.base,
        "/api/collections/products/records",
        {
          method: "POST",
          token: userToken,
          body: productPayload(targetId, userId, TOO_LONG_NAME),
        },
      );
      console.log(
        `create product name=61chars: ${long.status} ${JSON.stringify(long.json)}`,
      );
      verdict(
        "productname-max60",
        long.status === 400 && long.json?.data?.productName
          ? `rejected on productName (${long.json.data.productName.code})`
          : `${long.status} → UNEXPECTED`,
      );

      // B. Duplicate (event, name) without the unique index: accepted twice —
      // no guard today, which is what the DDL migration fixes (after cleanup).
      const first = await pbFetch(
        env.base,
        "/api/collections/products/records",
        {
          method: "POST",
          token: userToken,
          body: productPayload(targetId, userId, DUP_NAME),
        },
      );
      console.log(`create product "${DUP_NAME}": ${first.status}`);
      if (first.status === 200) createdIds.push(first.json.id);
      const second = await pbFetch(
        env.base,
        "/api/collections/products/records",
        {
          method: "POST",
          token: userToken,
          body: productPayload(targetId, userId, DUP_NAME),
        },
      );
      console.log(`re-create same (event, name): ${second.status}`);
      if (second.status === 200) createdIds.push(second.json.id);
      verdict(
        "duplicate-without-index",
        first.status === 200 && second.status === 200
          ? "accepted twice — no guard without the index (cleanup + DDL required)"
          : `${first.status}/${second.status} → UNEXPECTED`,
      );
    } else {
      // C. Duplicate (event, name) WITH the unique index: 200 then 400 —
      // print the exact wire shape the client maps.
      const first = await pbFetch(
        env.base,
        "/api/collections/products/records",
        {
          method: "POST",
          token: userToken,
          body: productPayload(targetId, userId, DUP_NAME),
        },
      );
      console.log(`create product "${DUP_NAME}": ${first.status}`);
      if (first.status === 200) createdIds.push(first.json.id);
      const second = await pbFetch(
        env.base,
        "/api/collections/products/records",
        {
          method: "POST",
          token: userToken,
          body: productPayload(targetId, userId, DUP_NAME),
        },
      );
      const shape = JSON.stringify(second.json);
      console.log(`re-create same (event, name): ${second.status} ${shape}`);
      const fieldCodes = Object.entries(second.json?.data ?? {})
        .map(([f, e]: [string, any]) => `${f}:${e?.code}`)
        .join(",");
      verdict(
        "duplicate-with-index",
        second.status === 400 && fieldCodes.includes("validation_not_unique")
          ? `rejected 400 (${fieldCodes}) — full shape above`
          : `${second.status} → UNEXPECTED`,
      );
    }
  } finally {
    for (const id of createdIds) {
      const del = await pbFetch(
        env.base,
        `/api/collections/products/records/${id}`,
        {
          method: "DELETE",
          token: adminToken,
        },
      );
      console.log(`cleanup product ${id}: ${del.status}`);
    }
  }
}

await main();
