/**
 * T01 probe — products/purchases write paths against a live PB dev instance.
 *
 * Reproduces the click-through 400s at the HTTP seam (ticket
 * `01-fix-product-purchase-create`): authenticates a regular user, inspects the
 * live create rules, computes the user's rule coverage on a target event
 * (teams.members / guestUsers / createdBy), then attempts the exact writes the
 * SPA performs and classifies each failure:
 *   - 400 with empty `data`  → create-rule rejection (PB's vague response)
 *   - 400 with field errors  → payload/validation rejection
 *
 * Discriminating writes:
 *   - POST products (full SPA payload)            → rule vs validation
 *   - POST purchases with `products: []`          → isolates the rule
 *   - POST purchases with a non-existent ref      → isolates relation validation
 *
 * Records created by the probe are deleted again (admin) — the probe leaves the
 * database unchanged. Read-only elsewhere; safe to re-run.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t01-products.ts
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
    console.error(`Missing ${ENV_FILE} — add PB_URL / PB_ADMIN_* / PB_USER_* there.`);
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
  const missing = ["PB_URL", "PB_ADMIN_EMAIL", "PB_ADMIN_PASSWORD", "PB_USER_EMAIL", "PB_USER_PASSWORD"]
    .filter((k) => !env[k]);
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

/** Classifies a failed write per the run's discrimination protocol. */
function classify(status: number, json: any): string {
  if (status < 400) return "accepted";
  const data = json?.data ?? {};
  const fieldErrors = Object.keys(data).filter((k) => data[k]);
  if (fieldErrors.length === 0) return "rule-rejection (data empty)";
  return `validation-rejection (fields: ${fieldErrors.join(", ")})`;
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`# T01 probe against ${env.base}`);

  // 0. Health
  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  // 1. Admin auth (inspection + cleanup only)
  const admin = await pbFetch(env.base, "/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: { identity: env.adminEmail, password: env.adminPassword },
  });
  if (admin.status !== 200) {
    console.error(`Admin auth failed (${admin.status}) — check PB_ADMIN_* in .env.local`);
    process.exit(1);
  }
  const adminToken = admin.json.token as string;

  // 2. User auth (the SPA's identity)
  const user = await pbFetch(env.base, "/api/collections/users/auth-with-password", {
    method: "POST",
    body: { identity: env.userEmail, password: env.userPassword },
  });
  if (user.status !== 200) {
    console.error(`User auth failed (${user.status}) — check PB_USER_* in .env.local`);
    process.exit(1);
  }
  const userToken = user.json.token as string;
  const userId = user.json.record.id as string;
  console.log(`user id: ${userId}`);

  // 3. Live rules (what the migrations actually produced)
  for (const collection of ["products", "purchases"]) {
    const col = await pbFetch(env.base, `/api/collections/${collection}`, { token: adminToken });
    if (col.status !== 200) {
      console.log(`rules ${collection}: UNAVAILABLE (${col.status})`);
      continue;
    }
    console.log(`rules ${collection}.create = ${col.json.createRule}`);
    console.log(`rules ${collection}.list  = ${col.json.listRule}`);
  }

  // 4. Events visible to the user (listRule delivery — what lands in Dexie)
  const events = await pbFetch(
    env.base,
    "/api/collections/events/records?perPage=200&sort=-created",
    { token: userToken },
  );
  if (events.status !== 200) {
    console.log(`events list via user: ${events.status}`);
    process.exit(1);
  }
  const items: any[] = events.json.items ?? [];
  console.log(`events visible to user: ${items.length}/${events.json.totalItems}`);

  // 5. Coverage per event (full fields read via admin)
  interface Target {
    id: string;
    name: string;
    createdBy: string | null;
    isCreator: boolean;
    inTeamMembers: boolean;
    inGuestUsers: boolean;
    teamIds: string[];
  }
  const targets: Target[] = [];
  for (const ev of items) {
    const full = await pbFetch(env.base, `/api/collections/events/records/${ev.id}`, {
      token: adminToken,
    });
    if (full.status !== 200) continue;
    const teamIds: string[] = full.json.teams ?? [];
    let inTeamMembers = false;
    for (const teamId of teamIds) {
      const team = await pbFetch(env.base, `/api/collections/teams/records/${teamId}`, {
        token: adminToken,
      });
      if (team.status === 200 && (team.json.members ?? []).includes(userId)) {
        inTeamMembers = true;
      }
    }
    targets.push({
      id: ev.id,
      name: ev.name ?? "(no name)",
      createdBy: full.json.createdBy ?? null,
      isCreator: full.json.createdBy === userId,
      inTeamMembers,
      inGuestUsers: (full.json.guestUsers ?? []).includes(userId),
      teamIds,
    });
  }
  for (const t of targets) {
    console.log(
      `event ${t.id} "${t.name}" creator=${t.isCreator} teamMember=${t.inTeamMembers} guest=${t.inGuestUsers} teams=${t.teamIds.length}`,
    );
  }

  // 6. Target = event where the user is creator (user story 1), else first visible
  const target = targets.find((t) => t.isCreator) ?? targets[0];
  if (!target) {
    console.log("no visible event — nothing to probe");
    process.exit(1);
  }
  console.log(
    `target event: ${target.id} (creator=${target.isCreator} teamMember=${target.inTeamMembers} guest=${target.inGuestUsers})`,
  );
  verdict(
    "coverage",
    target.isCreator || target.inTeamMembers || target.inGuestUsers
      ? `covered by rule clauses (creator=${target.isCreator} teamMember=${target.inTeamMembers} guest=${target.inGuestUsers})`
      : "NOT covered by any create-rule clause (creator, teams.members, guestUsers)",
  );

  const createdProductIds: string[] = [];
  const createdPurchaseIds: string[] = [];
  try {
    // 7. List products via user (page load path — feeds Dexie)
    const listProducts = await pbFetch(
      env.base,
      `/api/collections/products/records?filter=${encodeURIComponent(`eventId="${target.id}"`)}&perPage=5`,
      { token: userToken },
    );
    console.log(
      `list products via user: ${listProducts.status} totalItems=${listProducts.json?.totalItems}`,
    );
    verdict("list-products", `${listProducts.status} (${classify(listProducts.status, listProducts.json)})`);

    // 8. Create product (exact SPA payload shape — ProductsStore.createProduct)
    const productPayload = {
      ingredientRef: null,
      productName: `probe-t01-${Date.now()}`,
      productType: "Autre",
      store: null,
      who: [],
      eventId: target.id,
      status: "active",
      stockReel: null,
      updatedBy: userId,
      isMerged: false,
      mergedFrom: null,
      mergeDate: null,
      mergeReason: null,
      mergedInto: null,
      totalNeededOverride: null,
      specs: JSON.stringify({ pF: false, pS: false }),
    };
    const createProduct = await pbFetch(env.base, "/api/collections/products/records", {
      method: "POST",
      token: userToken,
      body: productPayload,
    });
    console.log(`create product: ${createProduct.status} ${JSON.stringify(createProduct.json)}`);
    verdict("create-product", `${createProduct.status} → ${classify(createProduct.status, createProduct.json)}`);
    if (createProduct.status === 200) createdProductIds.push(createProduct.json.id as string);

    // 9a. Create purchase WITHOUT products relation — isolates the create rule
    const purchasePayload = {
      products: [],
      eventId: target.id,
      quantity: 100,
      unit: "gr.",
      status: "delivered",
      notes: "probe-t01",
      store: null,
      who: "probe",
      price: null,
      orderDate: null,
      deliveryDate: new Date().toISOString().replace("T", " ").replace("Z", "Z"),
      createdBy: userId,
      invoiceId: "PROBE_T01",
      invoiceTotal: null,
    };
    const createPurchaseNoRel = await pbFetch(env.base, "/api/collections/purchases/records", {
      method: "POST",
      token: userToken,
      body: purchasePayload,
    });
    console.log(`create purchase (no relation): ${createPurchaseNoRel.status} ${JSON.stringify(createPurchaseNoRel.json)}`);
    verdict(
      "create-purchase-no-relation",
      `${createPurchaseNoRel.status} → ${classify(createPurchaseNoRel.status, createPurchaseNoRel.json)}`,
    );
    if (createPurchaseNoRel.status === 200) createdPurchaseIds.push(createPurchaseNoRel.json.id as string);

    // 9b. Same purchase with a well-formed but NON-EXISTENT product ref —
    //     isolates relation validation (why an implicit product must exist first)
    const createPurchaseBadRel = await pbFetch(env.base, "/api/collections/purchases/records", {
      method: "POST",
      token: userToken,
      body: { ...purchasePayload, products: ["probet01missing"] },
    });
    console.log(`create purchase (missing ref): ${createPurchaseBadRel.status} ${JSON.stringify(createPurchaseBadRel.json)}`);
    verdict(
      "create-purchase-missing-ref",
      `${createPurchaseBadRel.status} → ${classify(createPurchaseBadRel.status, createPurchaseBadRel.json)}`,
    );

    // 9c. Purchase referencing a real product the user just created (post-fix path)
    if (createdProductIds.length > 0) {
      const createPurchaseReal = await pbFetch(env.base, "/api/collections/purchases/records", {
        method: "POST",
        token: userToken,
        body: { ...purchasePayload, products: createdProductIds },
      });
      console.log(`create purchase (real ref): ${createPurchaseReal.status} ${JSON.stringify(createPurchaseReal.json)}`);
      verdict(
        "create-purchase-real-ref",
        `${createPurchaseReal.status} → ${classify(createPurchaseReal.status, createPurchaseReal.json)}`,
      );
      if (createPurchaseReal.status === 200) createdPurchaseIds.push(createPurchaseReal.json.id as string);
    }
  } finally {
    // 10. Cleanup (admin) — purchases first (they reference the product)
    for (const id of createdPurchaseIds) {
      const del = await pbFetch(env.base, `/api/collections/purchases/records/${id}`, {
        method: "DELETE",
        token: adminToken,
      });
      console.log(`cleanup purchase ${id}: ${del.status}`);
    }
    for (const id of createdProductIds) {
      const del = await pbFetch(env.base, `/api/collections/products/records/${id}`, {
        method: "DELETE",
        token: adminToken,
      });
      console.log(`cleanup product ${id}: ${del.status}`);
    }
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
