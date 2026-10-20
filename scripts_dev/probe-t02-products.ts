/**
 * T02 probe — products update path against a live PB dev instance.
 *
 * Confirms (ticket `02-product-update-upsert`) that the update rule covers the
 * event creator — T01's migration `1791700000` already extended all 5 rules of
 * products/purchases, so NO new migration is expected; this probe pins the
 * verdict at the HTTP seam before/after the client fix:
 *   - PATCH a creator-owned product (the modal's edit path)       → 200
 *   - PATCH with the native json `store` field (storeInfo object) → 200, round-trips
 *   - PATCH a product of an event the user cannot access          → 404 (rule semantics)
 *
 * Records created by the probe are deleted again (admin) — the probe leaves
 * the database unchanged. Read-only elsewhere; safe to re-run.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t02-products.ts
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

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`# T02 probe against ${env.base}`);

  // 0. Health
  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  // 1. Admin auth (inspection + cleanup only)
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

  // 2. User auth (the SPA's identity)
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

  // 3. Live update rule (should already carry the creator clause — T01)
  const col = await pbFetch(env.base, "/api/collections/products", {
    token: adminToken,
  });
  console.log(`rules products.update = ${col.json?.updateRule}`);
  verdict(
    "update-rule",
    col.json?.updateRule?.includes("eventId.createdBy = @request.auth.id")
      ? "creator clause present (migration 1791700000)"
      : "creator clause MISSING — new migration needed",
  );

  // 4. Target event: creator, no team, no guest (the click-through profile)
  const events = await pbFetch(
    env.base,
    "/api/collections/events/records?perPage=200&sort=-created",
    { token: userToken },
  );
  const items: any[] = events.json?.items ?? [];
  let target: any = null;
  for (const ev of items) {
    const full = await pbFetch(
      env.base,
      `/api/collections/events/records/${ev.id}`,
      {
        token: adminToken,
      },
    );
    if (full.status !== 200) continue;
    const isCreator = full.json.createdBy === userId;
    const inTeams = (full.json.teams ?? []).length > 0;
    const inGuests = (full.json.guestUsers ?? []).includes(userId);
    if (isCreator && !inTeams && !inGuests) {
      target = ev;
      break;
    }
  }
  if (!target) {
    console.log(
      "no creator-only event found — cannot probe the rule gap profile",
    );
    process.exit(1);
  }
  console.log(
    `target event: ${target.id} "${target.name}" (creator, 0 team, not guest)`,
  );

  let createdProductId: string | null = null;
  try {
    // 5. Create product (SPA payload — same as T01 probe)
    const create = await pbFetch(
      env.base,
      "/api/collections/products/records",
      {
        method: "POST",
        token: userToken,
        body: {
          ingredientRef: null,
          productName: `probe-t02-${Date.now()}`,
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
        },
      },
    );
    console.log(`create product: ${create.status}`);
    if (create.status !== 200) {
      verdict(
        "create-product",
        `${create.status} — cannot pursue update probe`,
      );
      process.exit(1);
    }
    createdProductId = create.json.id as string;

    // 6. PATCH the creator-owned product (modal edit path: who + totalNeededOverride)
    const patch = await pbFetch(
      env.base,
      `/api/collections/products/records/${createdProductId}`,
      {
        method: "PATCH",
        token: userToken,
        body: { who: ["probe-t02"] },
      },
    );
    console.log(`patch product (who): ${patch.status}`);
    verdict(
      "patch-owned",
      patch.status === 200 ? "200 accepted" : `${patch.status} REJECTED`,
    );

    // 7. PATCH with native json store field (the storeInfo conversion)
    const patchStore = await pbFetch(
      env.base,
      `/api/collections/products/records/${createdProductId}`,
      {
        method: "PATCH",
        token: userToken,
        body: { store: { storeName: "Épicerie du coin" } },
      },
    );
    const storeRoundTrips =
      patchStore.status === 200 &&
      patchStore.json?.store &&
      typeof patchStore.json.store === "object" &&
      patchStore.json.store.storeName === "Épicerie du coin";
    console.log(
      `patch product (store json natif): ${patchStore.status} store=${JSON.stringify(patchStore.json?.store)}`,
    );
    verdict(
      "patch-store-native-json",
      storeRoundTrips
        ? "200, json object round-trips"
        : `${patchStore.status} — inspect`,
    );

    // 8. Control: PATCH a product whose event does NOT cover the user →
    //    rule semantics (404, PB hides the record). On this dev dataset the
    //    user is creator/guest on nearly every event, so resolve coverage
    //    first and only verdict when genuinely uncovered.
    const all = await pbFetch(
      env.base,
      `/api/collections/products/records?perPage=200&filter=${encodeURIComponent(`eventId!="${target.id}"`)}`,
      { token: adminToken },
    );
    let controlDone = false;
    for (const foreign of all.json?.items ?? []) {
      const ev = await pbFetch(
        env.base,
        `/api/collections/events/records/${foreign.eventId}`,
        { token: adminToken },
      );
      if (ev.status !== 200) continue;
      const isCreator = ev.json.createdBy === userId;
      const inGuests = (ev.json.guestUsers ?? []).includes(userId);
      let inTeams = false;
      for (const teamId of ev.json.teams ?? []) {
        const team = await pbFetch(
          env.base,
          `/api/collections/teams/records/${teamId}`,
          {
            token: adminToken,
          },
        );
        if (team.status === 200 && (team.json.members ?? []).includes(userId))
          inTeams = true;
      }
      if (isCreator || inGuests || inTeams) continue; // covered — not a control

      const patchForeign = await pbFetch(
        env.base,
        `/api/collections/products/records/${foreign.id}`,
        { method: "PATCH", token: userToken, body: { who: ["intruder"] } },
      );
      console.log(
        `patch uncovered product (${foreign.id}, event ${foreign.eventId}): ${patchForeign.status}`,
      );
      verdict(
        "patch-uncovered-control",
        patchForeign.status === 404
          ? "404 — rule hides the record (expected PB semantics)"
          : `${patchForeign.status} — inspect`,
      );
      controlDone = true;
      break;
    }
    if (!controlDone) {
      console.log(
        "control skipped: user is covered on every event owning products (dataset) — 404 control not buildable",
      );
    }
  } finally {
    // 9. Cleanup (admin)
    if (createdProductId) {
      const del = await pbFetch(
        env.base,
        `/api/collections/products/records/${createdProductId}`,
        { method: "DELETE", token: adminToken },
      );
      console.log(`cleanup product ${createdProductId}: ${del.status}`);
    }
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
