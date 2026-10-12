/**
 * T03 probe — loan ↔ event_materiel write paths against a live PB dev instance.
 *
 * Reproduces the click-through 400 (ticket `03-loan-event-materiel-sync`) at the
 * HTTP seam: authenticates a regular user, inspects the live rules of
 * event_materiel and materiel_loan, computes the user's rule coverage on a
 * target event (teams.members / guestUsers / createdBy), then replays the exact
 * writes the SPA performs in CreateLoanModal → MaterielStore.createLoan →
 * EventMaterielStore.syncFromLoan and classifies each failure:
 *   - 400 with empty `data`       → create-rule rejection (PB's vague response)
 *   - 400 with field errors       → payload/validation rejection
 *   - 404 on update/delete        → rule rejection (PB leak-protection semantics)
 *
 * Discriminating writes:
 *   - POST materiel_loan (responsibleId = auth)  → the SPA's first write
 *   - POST event_materiel header (full SPA payload) → the failing sync write
 *   - POST event_materiel allocation             → second sync write
 *   - PATCH event_materiel (admin-created control row) → updateRule check
 *   - DELETE event_materiel (control row)        → deleteRule check
 *
 * Records created by the probe are deleted again (admin) — the probe leaves the
 * database unchanged. Read-only elsewhere; safe to re-run.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t03-loan-eventmateriel.ts
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
  if (fieldErrors.length === 0) {
    if (status === 404) return "rule-rejection-or-missing (404 — PB leak-protection)";
    return "rule-rejection (data empty)";
  }
  return `validation-rejection (fields: ${fieldErrors.join(", ")})`;
}

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(`# T03 probe against ${env.base}`);

  // 0. Health
  const health = await pbFetch(env.base, "/api/health");
  if (health.status !== 200) {
    console.error(`PB not healthy on ${env.base} (${health.status})`);
    process.exit(1);
  }

  // 1. Admin auth (inspection + control-row creation + cleanup only)
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
  const userName = (user.json.record.name as string) || "probe";
  console.log(`user id: ${userId}`);

  // 3. Live rules (what the migrations actually produced)
  for (const collection of ["event_materiel", "materiel_loan"]) {
    const col = await pbFetch(env.base, `/api/collections/${collection}`, { token: adminToken });
    if (col.status !== 200) {
      console.log(`rules ${collection}: UNAVAILABLE (${col.status})`);
      continue;
    }
    console.log(`rules ${collection}.create = ${col.json.createRule}`);
    console.log(`rules ${collection}.update = ${col.json.updateRule}`);
    console.log(`rules ${collection}.delete = ${col.json.deleteRule}`);
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
    isCreator: boolean;
    inTeamMembers: boolean;
    inGuestUsers: boolean;
    dateStart: string | null;
    dateEnd: string | null;
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
      isCreator: full.json.createdBy === userId,
      inTeamMembers,
      inGuestUsers: (full.json.guestUsers ?? []).includes(userId),
      dateStart: full.json.dateStart ?? null,
      dateEnd: full.json.dateEnd ?? null,
    });
  }
  for (const t of targets) {
    console.log(
      `event ${t.id} "${t.name}" creator=${t.isCreator} teamMember=${t.inTeamMembers} guest=${t.inGuestUsers}`,
    );
  }

  // 6. Target = event where the user is creator but NOT covered by the other
  //    clauses (the click-through condition), else any creator event.
  const uncoveredCreator = targets.find(
    (t) => t.isCreator && !t.inTeamMembers && !t.inGuestUsers,
  );
  const anyCreator = targets.find((t) => t.isCreator);
  const target = uncoveredCreator ?? anyCreator ?? targets[0];
  if (!target) {
    console.log("no visible event — nothing to probe");
    process.exit(1);
  }
  console.log(
    `target event: ${target.id} "${target.name}" (creator=${target.isCreator} teamMember=${target.inTeamMembers} guest=${target.inGuestUsers})`,
  );
  verdict(
    "coverage",
    uncoveredCreator
      ? "creator NOT covered by teams.members/guestUsers on target event (click-through condition)"
      : `fallback target — user covered: creator=${target.isCreator} teamMember=${target.inTeamMembers} guest=${target.inGuestUsers}`,
  );

  // 7. Pick a materiel (admin read — the SPA picks one owned by a team)
  const materiels = await pbFetch(env.base, "/api/collections/materiel/records?perPage=1", {
    token: adminToken,
  });
  const materiel: any = materiels.json?.items?.[0];
  if (!materiel) {
    console.log("no materiel record in dev DB — cannot build a faithful loan payload");
    process.exit(1);
  }
  console.log(`materiel: ${materiel.id} "${materiel.name}" teamId=${materiel.teamId}`);

  const createdLoanIds: string[] = [];
  let createdEventMaterielIds: string[] = [];
  try {
    // 8. POST materiel_loan as the user (exact SPA payload — MaterielStore.createLoan)
    //    createRule expects @request.body.responsibleId = auth (hardening 1791278800).
    const loanPayload = {
      startDate: target.dateStart ? target.dateStart.slice(0, 10) : isoDay(7),
      endDate: target.dateEnd ? target.dateEnd.slice(0, 10) : isoDay(9),
      responsibleId: userId,
      responsibleName: userName,
      ownerId: materiel.teamId ?? null,
      ownerName: "probe-t03",
      materiels: [
        { materielId: materiel.id, materielName: materiel.name, quantity: 1 },
      ],
      notes: "probe-t03",
      status: "accepted",
      eventId: target.id,
      eventName: target.name,
      borrowerUser: userId,
      createdBy: userId,
    };
    const createLoan = await pbFetch(env.base, "/api/collections/materiel_loan/records", {
      method: "POST",
      token: userToken,
      body: loanPayload,
    });
    console.log(`create materiel_loan: ${createLoan.status} ${JSON.stringify(createLoan.json).slice(0, 300)}`);
    verdict("create-loan", `${createLoan.status} → ${classify(createLoan.status, createLoan.json)}`);
    if (createLoan.status === 200) createdLoanIds.push(createLoan.json.id as string);
    const loanId = createLoan.status === 200 ? (createLoan.json.id as string) : "probet03noloan";

    // 9. POST event_materiel header as the user (exact syncFromLoan →
    //    addHeaderWithAllocation payload)
    const headerPayload = {
      eventId: target.id,
      name: materiel.name,
      quantity: 1,
      type: materiel.type || "other",
      status: "to_find",
      groupId: null,
      who: null,
      where: null,
      fromTeamName: "probe-t03",
      sourceMaterielId: materiel.id,
      loanId,
      notes: null,
      createdBy: userId,
    };
    const createHeader = await pbFetch(env.base, "/api/collections/event_materiel/records", {
      method: "POST",
      token: userToken,
      body: headerPayload,
    });
    console.log(`create event_materiel header: ${createHeader.status} ${JSON.stringify(createHeader.json).slice(0, 300)}`);
    verdict(
      "create-event-materiel-header",
      `${createHeader.status} → ${classify(createHeader.status, createHeader.json)}`,
    );
    if (createHeader.status === 200) createdEventMaterielIds.push(createHeader.json.id as string);

    // 10. POST event_materiel allocation (second sync write — groupId → header)
    if (createHeader.status === 200) {
      const allocationPayload = {
        ...headerPayload,
        status: "confirmed",
        groupId: createHeader.json.id,
        who: userName,
      };
      const createAllocation = await pbFetch(
        env.base,
        "/api/collections/event_materiel/records",
        { method: "POST", token: userToken, body: allocationPayload },
      );
      console.log(`create event_materiel allocation: ${createAllocation.status} ${JSON.stringify(createAllocation.json).slice(0, 200)}`);
      verdict(
        "create-event-materiel-allocation",
        `${createAllocation.status} → ${classify(createAllocation.status, createAllocation.json)}`,
      );
      if (createAllocation.status === 200) {
        createdEventMaterielIds.push(createAllocation.json.id as string);
      }
    }

    // 11. Control row via ADMIN (bypasses createRule) → measure update/delete
    //     semantics for a rule-uncovered user (the T02 trap: update rejected → 404).
    const control = await pbFetch(env.base, "/api/collections/event_materiel/records", {
      method: "POST",
      token: adminToken,
      body: { ...headerPayload, name: `probe-t03-control-${Date.now()}`, loanId: null },
    });
    if (control.status === 200) {
      const controlId = control.json.id as string;
      createdEventMaterielIds.push(controlId);

      const patch = await pbFetch(
        env.base,
        `/api/collections/event_materiel/records/${controlId}`,
        { method: "PATCH", token: userToken, body: { quantity: 2 } },
      );
      console.log(`patch event_materiel (control, as user): ${patch.status} ${JSON.stringify(patch.json).slice(0, 200)}`);
      verdict("update-event-materiel", `${patch.status} → ${classify(patch.status, patch.json)}`);

      const del = await pbFetch(
        env.base,
        `/api/collections/event_materiel/records/${controlId}`,
        { method: "DELETE", token: userToken },
      );
      console.log(`delete event_materiel (control, as user): ${del.status}`);
      verdict("delete-event-materiel", `${del.status} → ${classify(del.status, del.json)}`);
      if (del.status < 300) {
        // deleted by the user — don't double-delete in cleanup
        createdEventMaterielIds = createdEventMaterielIds.filter((id) => id !== controlId);
      }
    } else {
      console.log(`control row creation (admin) failed: ${control.status}`);
    }
  } finally {
    // 12. Cleanup (admin) — event_materiel rows first (they reference the loan)
    for (const id of createdEventMaterielIds) {
      const del = await pbFetch(env.base, `/api/collections/event_materiel/records/${id}`, {
        method: "DELETE",
        token: adminToken,
      });
      console.log(`cleanup event_materiel ${id}: ${del.status}`);
    }
    for (const id of createdLoanIds) {
      const del = await pbFetch(env.base, `/api/collections/materiel_loan/records/${id}`, {
        method: "DELETE",
        token: adminToken,
      });
      console.log(`cleanup materiel_loan ${id}: ${del.status}`);
    }
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
