/**
 * T10 probe — event creation idempotency semantics against a live PB dev instance.
 *
 * Measures the server-side contract the client-side double-create guard relies
 * on (ticket `10-event-double-create-hardening`): PocketBase create accepts a
 * client-provided record id and REJECTS a second create carrying the same id.
 * That rejection is what turns a client id into an idempotency key: after an
 * ambiguous network failure (request sent, response lost), resubmitting with
 * the same id can never duplicate — the client reconciles by reading the
 * record back under that id.
 *
 * Probe sequence (mirrors EventsStore.createEventWithTeams payload shape):
 *   1. POST events WITH client id          → 200 expected, id preserved
 *   2. POST events WITH the same id again  → 400 expected (duplicate rejected)
 *   3. GET events by that id               → 200 expected (reconciliation read)
 *   4. GET events by a never-created id    → 404 expected (reconciliation miss)
 *   5. DELETE the probe record (admin)     → 204, database unchanged
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t10-event-idempotency.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = import.meta.dir;
const ENV_FILE = join(SCRIPTS_DIR, ".env.local");
const TIMEOUT_MS = 8000;

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
    base: env.PB_URL.replace(/\/$/, ""),
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

/** PocketBase record ids: exactly 15 chars of [a-z0-9]. */
function makePbId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 15; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`# T10 probe against ${env.base}`);

  // 0. Health
  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  // 1. Admin auth (cleanup only)
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

  // 2. User auth (the SPA's identity — events createRule is auth-only)
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

  // 3. Create WITH a client-provided id (SPA payload shape, no meals → null dates)
  const clientId = makePbId();
  const payload = {
    name: "probe-t10-idempotency",
    description: "",
    status: "proposition",
    dateStart: null,
    dateEnd: null,
    date: [],
    meals: [],
    createdBy: userId,
    teams: [],
    contributors: [],
    todos: [],
  };
  const first = await pbFetch(env.base, "/api/collections/events/records", {
    method: "POST",
    token: userToken,
    body: { ...payload, id: clientId },
  });
  console.log(`create with client id ${clientId} → ${first.status}`);
  if (first.status !== 200) {
    console.log(`  response: ${JSON.stringify(first.json)}`);
    verdict(
      "ID_ACCEPTED",
      "FAILED — create with client id rejected, guard premise invalid",
    );
    process.exit(1);
  }
  const preserved = first.json.id === clientId;
  verdict(
    "ID_ACCEPTED",
    first.json.id === clientId
      ? `id preserved (server id = client id ${clientId})`
      : `id REGENERATED (server id ${first.json.id} ≠ client id) — guard premise invalid`,
  );
  if (!preserved) process.exit(1);

  // 4. Re-create with the SAME id (the resubmission after an ambiguous failure)
  const second = await pbFetch(env.base, "/api/collections/events/records", {
    method: "POST",
    token: userToken,
    body: { ...payload, id: clientId },
  });
  console.log(`re-create with same id → ${second.status}`);
  console.log(`  response: ${JSON.stringify(second.json)}`);
  verdict(
    "DUPLICATE_REJECTED",
    second.status === 400
      ? "400 on duplicate client id — id IS an idempotency key"
      : `unexpected status ${second.status} — inspect before relying on it`,
  );

  // 5. Reconciliation read: GET by the client id
  const read = await pbFetch(
    env.base,
    `/api/collections/events/records/${clientId}`,
    {
      token: userToken,
    },
  );
  verdict(
    "RECONCILIATION_READ",
    read.status === 200
      ? "record readable under its client id (reconciliation path works)"
      : `unexpected status ${read.status}`,
  );

  // 6. Reconciliation miss control: GET by a never-created id
  const miss = await pbFetch(
    env.base,
    `/api/collections/events/records/${makePbId()}`,
    {
      token: userToken,
    },
  );
  verdict(
    "RECONCILIATION_MISS",
    miss.status === 404
      ? "404 on unknown id — genuine failures stay distinguishable"
      : `unexpected status ${miss.status}`,
  );

  // 7. Cleanup — the probe leaves the database unchanged
  const del = await pbFetch(
    env.base,
    `/api/collections/events/records/${clientId}`,
    {
      method: "DELETE",
      token: adminToken,
    },
  );
  verdict(
    "CLEANUP",
    del.status === 204
      ? "probe record deleted (204)"
      : `unexpected status ${del.status}`,
  );

  process.exit(del.status === 204 ? 0 : 1);
}

main();
