/**
 * T04 probe — teamdocs write + cross-user visibility against a live PB dev instance.
 *
 * Reproduces the click-through failures (ticket `04-event-docs-create-visibility`)
 * at the HTTP seam, with a controlled two-user setup built and torn down by the
 * probe itself (no shared dev data touched):
 *   - event created by admin, `createdBy` = regular user (ghald), `guestUsers`
 *     = probe user → ghald is creator-NOT-covered (click-through condition),
 *       probe user is covered via the guestUsers clause;
 *   - writes replay the exact SPA payload of
 *     EventDocumentCreatePage → TeamdocsStore.createEventDocument:
 *     `{title, content, tags, eventId, status: "doc"}` (no teamId, no createdBy —
 *     teamdocs has no createdBy field).
 *
 * Checks, before the fix (expected) / after (expected):
 *   1. rules read-back (live state of the 5 teamdocs rules)
 *   2. ghald creates event doc        → 400 rule-rejection / 200
 *   3. probe user (guest) creates doc → 200 / 200
 *   4. ghald lists teamdocs           → probe user's doc ABSENT (listRule
 *      filters — 200 without it) / present
 *   5. ghald GETs probe user's doc    → 404 (viewRule, leak-protection) / 200
 *   6. probe user GETs ghald's doc    → 200 once ghald creation passes
 *   7. admin lists teamdocs of the event → doc present regardless of user rules
 *      (discriminator: the record EXISTS server-side; combined with the code
 *      fact that the teamdocs sync carries NO client filter
 *      (`createSyncCollection(pb, db.teamdocs, "teamdocs")`, bridge over
 *      `db.teamdocs.toArray()`), absence at the user seam = listRule, not sync)
 *
 * All records created here (docs, event, probe user) are deleted again (admin)
 * — the probe leaves the database unchanged. Read-only elsewhere; safe to
 * re-run before and after the rules migration.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t04-teamdocs.ts
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

/** Classifies a failed write per the run's discrimination protocol. */
function classify(status: number, json: any): string {
  if (status < 400) return "accepted";
  const data = json?.data ?? {};
  const fieldErrors = Object.keys(data).filter((k) => data[k]);
  if (fieldErrors.length === 0) {
    if (status === 404)
      return "rule-rejection-or-missing (404 — PB leak-protection)";
    return "rule-rejection (data empty)";
  }
  return `validation-rejection (fields: ${fieldErrors.join(", ")})`;
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`# T04 probe against ${env.base}`);

  // 0. Health
  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  // 1. Admin auth (setup + inspection + cleanup only)
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

  // 2. Regular user auth (ghald — the SPA's identity in the click-through)
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

  // 3. Live rules (what the migrations actually produced)
  const col = await pbFetch(env.base, "/api/collections/teamdocs", {
    token: adminToken,
  });
  if (col.status !== 200) {
    console.log(`rules teamdocs: UNAVAILABLE (${col.status})`);
    process.exit(1);
  }
  console.log(`rules teamdocs.create = ${col.json.createRule}`);
  console.log(`rules teamdocs.list   = ${col.json.listRule}`);
  console.log(`rules teamdocs.view   = ${col.json.viewRule}`);
  console.log(`rules teamdocs.update = ${col.json.updateRule}`);
  console.log(`rules teamdocs.delete = ${col.json.deleteRule}`);
  const rulesHaveCreator =
    String(col.json.createRule ?? "").includes("eventId.createdBy") &&
    String(col.json.listRule ?? "").includes("eventId.createdBy");
  verdict(
    "rules",
    rulesHaveCreator
      ? "creator clause (eventId.createdBy) PRESENT on create+list — post-fix state"
      : "creator clause (eventId.createdBy) ABSENT from create+list — pre-fix state",
  );

  // 4. Probe user (admin-created, transitory — the second account)
  const stamp = Date.now();
  const probeEmail = `probe-t04-${stamp}@enka-dev.local`;
  const probePassword = `probe-t04-${stamp}-Pw`;
  const probeUser = await pbFetch(env.base, "/api/collections/users/records", {
    method: "POST",
    token: adminToken,
    body: {
      email: probeEmail,
      password: probePassword,
      passwordConfirm: probePassword,
      name: "probe-t04",
      verified: true,
      emailVisibility: true,
    },
  });
  if (probeUser.status !== 200) {
    console.log(
      `probe user creation failed: ${probeUser.status} ${JSON.stringify(probeUser.json).slice(0, 300)}`,
    );
    process.exit(1);
  }
  const probeUserId = probeUser.json.id as string;
  console.log(`probe user: ${probeUserId} (${probeEmail})`);

  // Probe-user auth (needed to act as the participant)
  const probeAuth = await pbFetch(
    env.base,
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      body: { identity: probeEmail, password: probePassword },
    },
  );
  if (probeAuth.status !== 200) {
    console.log(`probe user auth failed: ${probeAuth.status}`);
    process.exit(1);
  }
  const probeToken = probeAuth.json.token as string;

  // 5. Probe event (admin-created): ghald = creator only, probe user = guest only.
  //    Mirrors the click-through condition: organizer not covered by
  //    teams.members/guestUsers; the participant covered via guestUsers.
  const event = await pbFetch(env.base, "/api/collections/events/records", {
    method: "POST",
    token: adminToken,
    body: {
      name: `probe-t04-${stamp}`,
      createdBy: userId,
      guestUsers: [probeUserId],
      status: "confirmed",
    },
  });
  if (event.status !== 200) {
    console.log(
      `probe event creation failed: ${event.status} ${JSON.stringify(event.json).slice(0, 300)}`,
    );
    process.exit(1);
  }
  const eventId = event.json.id as string;
  console.log(`probe event: ${eventId}`);

  // Coverage read-back (admin) — proves the setup means what the rules evaluate
  const evFull = await pbFetch(
    env.base,
    `/api/collections/events/records/${eventId}`,
    {
      token: adminToken,
    },
  );
  const evCreatedBy = evFull.json?.createdBy;
  const evGuests: string[] = evFull.json?.guestUsers ?? [];
  const evTeams: string[] = evFull.json?.teams ?? [];
  verdict(
    "coverage",
    `ghald creator=${evCreatedBy === userId} teamMember=false (no teams) guest=${evGuests.includes(userId)} | probeUser guest=${evGuests.includes(probeUserId)} teams=${evTeams.length}`,
  );

  const createdDocIds: string[] = [];
  try {
    // 6. ghald creates an event doc — exact SPA payload (createEventDocument)
    const ghaldPayload = {
      title: "probe-t04 ghald doc",
      content: "probe-t04",
      tags: ["materiel"],
      eventId,
      status: "doc",
    };
    const ghaldCreate = await pbFetch(
      env.base,
      "/api/collections/teamdocs/records",
      {
        method: "POST",
        token: userToken,
        body: ghaldPayload,
      },
    );
    console.log(
      `create teamdocs (creator, no teamId): ${ghaldCreate.status} ${JSON.stringify(ghaldCreate.json).slice(0, 300)}`,
    );
    verdict(
      "create-by-creator",
      `${ghaldCreate.status} → ${classify(ghaldCreate.status, ghaldCreate.json)}`,
    );
    if (ghaldCreate.status === 200)
      createdDocIds.push(ghaldCreate.json.id as string);
    const ghaldDocId =
      ghaldCreate.status === 200 ? (ghaldCreate.json.id as string) : null;

    // 7. probe user (guest) creates an event doc — simulates "userA created a doc"
    const guestPayload = {
      title: "probe-t04 guest doc",
      content: "probe-t04",
      tags: ["produit"],
      eventId,
      status: "doc",
    };
    const guestCreate = await pbFetch(
      env.base,
      "/api/collections/teamdocs/records",
      {
        method: "POST",
        token: probeToken,
        body: guestPayload,
      },
    );
    console.log(
      `create teamdocs (guest): ${guestCreate.status} ${JSON.stringify(guestCreate.json).slice(0, 300)}`,
    );
    verdict(
      "create-by-guest",
      `${guestCreate.status} → ${classify(guestCreate.status, guestCreate.json)}`,
    );
    let guestDocId: string | null = null;
    if (guestCreate.status === 200) {
      guestDocId = guestCreate.json.id as string;
      createdDocIds.push(guestDocId);
    }

    // 8. Visibility — ghald lists teamdocs: is the guest's doc delivered?
    if (guestDocId) {
      const list = await pbFetch(
        env.base,
        "/api/collections/teamdocs/records?perPage=200&sort=-created",
        { token: userToken },
      );
      const items: any[] = list.json?.items ?? [];
      const guestDocVisible = items.some((d) => d.id === guestDocId);
      console.log(
        `list teamdocs (creator): ${list.status}, ${items.length}/${list.json?.totalItems} items, guest doc in list: ${guestDocVisible}`,
      );
      verdict(
        "list-to-creator",
        guestDocVisible
          ? "guest's doc DELIVERED to the event creator by the listRule"
          : "guest's doc ABSENT from the creator's list (listRule filters it — 200 without the record)",
      );

      // 9. Visibility — direct GET by the creator (strictest proof: viewRule)
      const view = await pbFetch(
        env.base,
        `/api/collections/teamdocs/records/${guestDocId}`,
        {
          token: userToken,
        },
      );
      console.log(`view guest doc (creator): ${view.status}`);
      verdict(
        "view-by-creator",
        `${view.status} → ${classify(view.status, view.json)}`,
      );
    }

    // 10. Visibility — probe user sees the creator's doc (participant direction)
    if (ghaldDocId) {
      const viewByGuest = await pbFetch(
        env.base,
        `/api/collections/teamdocs/records/${ghaldDocId}`,
        {
          token: probeToken,
        },
      );
      console.log(`view creator doc (guest): ${viewByGuest.status}`);
      verdict(
        "view-by-guest",
        `${viewByGuest.status} → ${classify(viewByGuest.status, viewByGuest.json)}`,
      );
    }

    // 11. Server-side presence (admin, rule-free) — discriminator: record EXISTS,
    //     so absence at the user seam is the rule, not a lost write.
    if (guestDocId || ghaldDocId) {
      const adminList = await pbFetch(
        env.base,
        `/api/collections/teamdocs/records?perPage=200&filter=${encodeURIComponent(`eventId="${eventId}"`)}`,
        { token: adminToken },
      );
      const adminIds: string[] = (adminList.json?.items ?? []).map(
        (d: any) => d.id,
      );
      console.log(
        `admin list (eventId=${eventId}): ${adminList.status}, ${adminIds.length}/${adminList.json?.totalItems} items`,
      );
      if (ghaldDocId)
        console.log(`admin sees ghald doc: ${adminIds.includes(ghaldDocId)}`);
      if (guestDocId)
        console.log(`admin sees guest doc: ${adminIds.includes(guestDocId)}`);
    }
  } finally {
    // 12. Cleanup (admin) — docs, event, probe user
    for (const id of createdDocIds) {
      const del = await pbFetch(
        env.base,
        `/api/collections/teamdocs/records/${id}`,
        {
          method: "DELETE",
          token: adminToken,
        },
      );
      console.log(`cleanup teamdocs ${id}: ${del.status}`);
    }
    const delEvent = await pbFetch(
      env.base,
      `/api/collections/events/records/${eventId}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(`cleanup event ${eventId}: ${delEvent.status}`);
    const delUser = await pbFetch(
      env.base,
      `/api/collections/users/records/${probeUserId}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(`cleanup user ${probeUserId}: ${delUser.status}`);
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
