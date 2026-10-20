/**
 * Probe — products id admissibility + productName required, at the HTTP seam.
 *
 * Proves against a live PB instance that the schema admits stable semantic
 * product ids (lowercase + underscore, 11..40 chars — e.g. `sel_qq9ziy9kpw`,
 * the shape the SPA derives from name+event) and enforces the required
 * productName:
 *   - POST products with an explicit semantic id and a name  → accepted
 *   - POST products with a 10-char id (below the min)        → validation 400
 *   - POST products without productName                      → validation 400
 *   - POST purchases referencing the semantic id             → accepted
 *
 * A positive result means a product can be created once under its final id
 * and purchases can point at it — no rename/reattach dance needed.
 *
 * Records created by the probe are deleted again (admin, purchases first) and
 * leftovers from a crashed run are purged before creating — re-runnable.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded); the
 * target follows the pipeline convention PB_URL_OVERRIDE > .env.local PB_URL,
 * so the probe can run against a disposable instance instead of the dev one.
 *
 * Usage: bun run scripts_dev/probe-t11-products-semantic-id.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = import.meta.dir;
const ENV_FILE = join(SCRIPTS_DIR, ".env.local");
const TIMEOUT_MS = 8000;

/** The semantic id the probe creates — lowercase + underscore, 13 chars. */
const SEMANTIC_ID = "sel_qq9ziy9kpw";
/** Below the id min (11) — must be rejected on the id field alone. */
const TOO_SHORT_ID = "sel_short1";

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

function classify(status: number, json: any): string {
  if (status < 400) return "accepted";
  const data = json?.data ?? {};
  const fieldErrors = Object.keys(data).filter((k) => data[k]);
  if (fieldErrors.length === 0) return "rule-rejection (data empty)";
  return `validation-rejection (fields: ${fieldErrors.join(", ")})`;
}

/** Exact payload shape of ProductsStore.createProduct, plus an optional id. */
function productPayload(
  eventId: string,
  userId: string,
  productName: string,
  id?: string,
) {
  return {
    ...(id ? { id } : {}),
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
  console.log(`# probe products semantic-id against ${env.base}`);

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

  // Target event: one the user can write on (creator, else first visible) —
  // the same coverage the SPA's products create rule requires.
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

  // Crash-safe re-runs: purge leftovers first (purchases referencing the id,
  // then the product itself).
  const stale = await pbFetch(
    env.base,
    `/api/collections/purchases/records?filter=${encodeURIComponent(`products="${SEMANTIC_ID}"`)}`,
    { token: adminToken },
  );
  for (const rec of stale.json?.items ?? []) {
    const del = await pbFetch(
      env.base,
      `/api/collections/purchases/records/${rec.id}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(`purge stale purchase ${rec.id}: ${del.status}`);
  }
  const staleProduct = await pbFetch(
    env.base,
    `/api/collections/products/records/${SEMANTIC_ID}`,
    {
      token: adminToken,
    },
  );
  if (staleProduct.status === 200) {
    const del = await pbFetch(
      env.base,
      `/api/collections/products/records/${SEMANTIC_ID}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(`purge stale product ${SEMANTIC_ID}: ${del.status}`);
  }

  const createdPurchaseIds: string[] = [];
  let semanticProductCreated = false;
  try {
    // 1. Positive: create under the final semantic id (explicit id + name).
    const create = await pbFetch(
      env.base,
      "/api/collections/products/records",
      {
        method: "POST",
        token: userToken,
        body: productPayload(
          targetId,
          userId,
          `probe ${SEMANTIC_ID}`,
          SEMANTIC_ID,
        ),
      },
    );
    console.log(
      `create product id=${SEMANTIC_ID}: ${create.status} ${JSON.stringify(create.json)}`,
    );
    verdict(
      "semantic-id-create",
      create.status === 200
        ? "accepted — semantic id stored verbatim"
        : `${create.status} → ${classify(create.status, create.json)}`,
    );
    semanticProductCreated = create.status === 200;

    // 2. Below-min id: must be rejected on the id field (min 11).
    const short = await pbFetch(env.base, "/api/collections/products/records", {
      method: "POST",
      token: userToken,
      body: productPayload(
        targetId,
        userId,
        `probe ${TOO_SHORT_ID}`,
        TOO_SHORT_ID,
      ),
    });
    console.log(
      `create product id=${TOO_SHORT_ID} (10 chars): ${short.status} ${JSON.stringify(short.json)}`,
    );
    verdict(
      "too-short-id",
      short.status === 400 && short.json?.data?.id
        ? "rejected on id (min length enforced)"
        : `${short.status} → ${classify(short.status, short.json)}`,
    );

    // 3. Missing name: must be rejected on productName (required).
    const noName = await pbFetch(
      env.base,
      "/api/collections/products/records",
      {
        method: "POST",
        token: userToken,
        body: productPayload(targetId, userId, ""),
      },
    );
    console.log(
      `create product without productName: ${noName.status} ${JSON.stringify(noName.json)}`,
    );
    verdict(
      "productname-required",
      noName.status === 400 && noName.json?.data?.productName
        ? "rejected on productName (required enforced)"
        : `${noName.status} → ${classify(noName.status, noName.json)}`,
    );

    // 4. Purchase referencing the semantic product id.
    if (semanticProductCreated) {
      const purchase = await pbFetch(
        env.base,
        "/api/collections/purchases/records",
        {
          method: "POST",
          token: userToken,
          body: {
            products: [SEMANTIC_ID],
            eventId: targetId,
            quantity: 100,
            unit: "gr.",
            status: "delivered",
            notes: "probe semantic id",
            store: null,
            who: "probe",
            price: null,
            orderDate: null,
            deliveryDate: null,
            createdBy: userId,
            invoiceId: "PROBE_SEMANTIC_ID",
            invoiceTotal: null,
          },
        },
      );
      console.log(
        `create purchase on ${SEMANTIC_ID}: ${purchase.status} ${JSON.stringify(purchase.json)}`,
      );
      verdict(
        "purchase-on-semantic-id",
        purchase.status === 200
          ? "accepted — relation points at the semantic id"
          : `${purchase.status} → ${classify(purchase.status, purchase.json)}`,
      );
      if (purchase.status === 200)
        createdPurchaseIds.push(purchase.json.id as string);
    }
  } finally {
    for (const id of createdPurchaseIds) {
      const del = await pbFetch(
        env.base,
        `/api/collections/purchases/records/${id}`,
        {
          method: "DELETE",
          token: adminToken,
        },
      );
      console.log(`cleanup purchase ${id}: ${del.status}`);
    }
    if (semanticProductCreated) {
      const del = await pbFetch(
        env.base,
        `/api/collections/products/records/${SEMANTIC_ID}`,
        {
          method: "DELETE",
          token: adminToken,
        },
      );
      console.log(`cleanup product ${SEMANTIC_ID}: ${del.status}`);
    }
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
