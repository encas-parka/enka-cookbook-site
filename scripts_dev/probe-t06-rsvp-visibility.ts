/**
 * T06 probe — RSVP invitation visibility for a KNOWN invitee, against a live
 * PB dev instance (ticket `06-rsvp-invitee-visibility`).
 *
 * Reproduces the click-through failure at the HTTP seam with a controlled
 * two-user setup built and torn down by the probe itself:
 *   - probe user (transitory) = ORGANIZER: creates an event with no teams and
 *     no guests, then invites ghald (PB_USER_*, a known account) by email —
 *     the exact write path of EventsStore.inviteParticipants
 *     (PATCH events/<id> with contributors + guestEmails + teams);
 *   - ghald = INVITEE: subscribed collection-wide to `events/*` (the exact
 *     store subscription), then lists / GETs / accepts.
 *
 * The invitation payload is mode-switched:
 *   default      — the CURRENT SPA payload (contributors json + guestEmails,
 *                  NO guestUsers) — pre-fix state;
 *   --fixed      — the payload of the fixed inviteParticipants (adds
 *                  guestUsers: [resolved ids]) — post-fix state.
 *
 * Checks (expected pre-fix → post-fix):
 *   1. rules-events   — live events rules read-back (guestUsers clause)
 *   2. invite-patch   — organizer PATCH accepted (200 / 200)
 *   3. record-state   — contributors carry ghald "invited"; guestUsers EMPTY
 *                       (smoking gun) / guestUsers = [ghald]
 *   4. sse-delivery   — ghald receives the invitation update on events/*
 *                       (NOT delivered / DELIVERED)
 *   5. list-to-invitee— ghald list contains the event (ABSENT — listRule
 *                       filters / PRESENT)
 *   6. get-by-invitee — ghald GET event (404 leak-protection / 200)
 *   7. accept-by-invitee — ghald PATCH contributors (updateContributorStatus
 *                       path: 404 rule-rejection / 200)
 *   8. list-after-accept — ghald list still (not) delivering the event
 *
 * All records created here (event, probe user) are deleted again (admin) —
 * the probe leaves the database unchanged. Safe to re-run in either mode.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t06-rsvp-visibility.ts [--fixed]
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS_DIR = import.meta.dir;
const ENV_FILE = join(SCRIPTS_DIR, ".env.local");
const TIMEOUT_MS = 8000;
const SSE_WAIT_MS = 5000;
const FIXED_MODE = process.argv.includes("--fixed");

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SseEvent {
  event: string;
  data: string;
}

/** Minimal SSE client for the PB realtime endpoint (bun fetch streaming). */
class RealtimeClient {
  #controller = new AbortController();
  #events: SseEvent[] = [];

  async connect(base: string): Promise<void> {
    const res = await fetch(`${base}/api/realtime`, {
      headers: { Accept: "text/event-stream" },
      signal: this.#controller.signal,
    });
    if (res.status !== 200 || !res.body) {
      throw new Error(`realtime connect failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Pump in the background; abort() ends it (reader.read() rejects — swallowed).
    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = RealtimeClient.#parseEvent(raw);
            if (parsed) this.#events.push(parsed);
          }
        }
      } catch {
        // aborted — expected during cleanup
      }
    })();
  }

  static #parseEvent(raw: string): SseEvent | null {
    let event = "";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!event && !data) return null;
    return { event, data };
  }

  async waitFor(
    pred: (e: SseEvent) => boolean,
    ms: number,
  ): Promise<SseEvent | null> {
    const deadline = Date.now() + ms;
    let start = 0;
    for (;;) {
      // only scan new events — polling, no re-scan churn
      for (; start < this.#events.length; start++) {
        if (pred(this.#events[start])) return this.#events[start];
      }
      if (Date.now() > deadline) return null;
      await sleep(50);
    }
  }

  close(): void {
    this.#controller.abort();
  }

  snapshot(): SseEvent[] {
    return [...this.#events];
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log(
    `# T06 probe against ${env.base} (mode: ${FIXED_MODE ? "FIXED payload (guestUsers written)" : "LEGACY payload (current SPA — no guestUsers)"})`,
  );

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

  // 2. ghald auth (PB_USER_* — the invitee, a KNOWN account, as in the click-through)
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
  const ghaldToken = user.json.token as string;
  const ghaldId = user.json.record.id as string;
  const ghaldEmail = user.json.record.email as string;
  const ghaldName = (user.json.record.name as string) || "ghald";
  console.log(`invitee (ghald): ${ghaldId} <${ghaldEmail}>`);

  // 3. Probe user (admin-created, transitory — the ORGANIZER)
  const stamp = Date.now();
  const probeEmail = `probe-t06-${stamp}@enka-dev.local`;
  const probePassword = `probe-t06-${stamp}-Pw`;
  const probeUser = await pbFetch(env.base, "/api/collections/users/records", {
    method: "POST",
    token: adminToken,
    body: {
      email: probeEmail,
      password: probePassword,
      passwordConfirm: probePassword,
      name: "probe-t06",
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
  const organizerId = probeUser.json.id as string;
  console.log(`organizer (transitory): ${organizerId} (${probeEmail})`);

  const organizerAuth = await pbFetch(
    env.base,
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      body: { identity: probeEmail, password: probePassword },
    },
  );
  if (organizerAuth.status !== 200) {
    console.log(`probe user auth failed: ${organizerAuth.status}`);
    process.exit(1);
  }
  const organizerToken = organizerAuth.json.token as string;

  // 4. Live events rules (what the migrations actually produced)
  const col = await pbFetch(env.base, "/api/collections/events", {
    token: adminToken,
  });
  if (col.status !== 200) {
    console.log(`rules events: UNAVAILABLE (${col.status})`);
    process.exit(1);
  }
  console.log(`rules events.list  = ${col.json.listRule}`);
  console.log(`rules events.view  = ${col.json.viewRule}`);
  console.log(`rules events.update= ${col.json.updateRule}`);
  verdict(
    "rules-events",
    String(col.json.listRule ?? "").includes("guestUsers")
      ? "list/view/update filter on guestUsers (+teams.members +createdBy) — contributors (json) is in NO rule"
      : "UNEXPECTED rule shape — investigate before reading further verdicts",
  );

  // 5. Event created by the ORGANIZER (their own token — real flow): no teams,
  //    no guests → ghald is covered by NO clause (not creator, 0 team, not guest).
  const event = await pbFetch(env.base, "/api/collections/events/records", {
    method: "POST",
    token: organizerToken,
    body: {
      name: `probe-t06-${stamp}`,
      createdBy: organizerId,
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
  const evGuests: string[] = evFull.json?.guestUsers ?? [];
  const evTeams: string[] = evFull.json?.teams ?? [];
  verdict(
    "coverage",
    `organizer creator=${evFull.json?.createdBy === organizerId} | ghald creator=${evFull.json?.createdBy === ghaldId} guest=${evGuests.includes(ghaldId)} teams=${evTeams.length} — ghald must be rule-uncovered`,
  );

  const sse = new RealtimeClient();
  try {
    // 6. ghald opens the SSE connection — collection-wide, like the SPA store
    await sse.connect(env.base);
    const connectEvent = await sse.waitFor(
      (e) => e.event === "PB_CONNECT",
      TIMEOUT_MS,
    );
    if (!connectEvent) {
      verdict("sse-connect", "PB_CONNECT NOT received within timeout");
      return;
    }
    const clientId = (JSON.parse(connectEvent.data) as { clientId: string })
      .clientId;
    const sub = await pbFetch(env.base, "/api/realtime", {
      method: "POST",
      token: ghaldToken,
      body: { clientId, subscriptions: ["events/*"] },
    });
    console.log(
      `sse-subscribe events/*: ${sub.status === 204 ? "accepted (204)" : `rejected (${sub.status})`}`,
    );
    if (sub.status !== 204) return;
    // Let the subscription register server-side before the write
    await sleep(300);

    // 7. Invitation PATCH by the ORGANIZER — exact SPA payload of
    //    inviteParticipants (contributors entry carries ghald's REAL id, as
    //    lookupUsersByEmails resolves known accounts; teams stays []).
    const contributorEntry = {
      id: ghaldId,
      email: ghaldEmail,
      name: ghaldName,
      status: "invited",
      invitedAt: new Date().toISOString(),
    };
    const inviteBody: Record<string, unknown> = {
      contributors: [contributorEntry],
      guestEmails: [ghaldEmail],
      teams: [],
    };
    if (FIXED_MODE) {
      inviteBody.guestUsers = [ghaldId];
    }
    const invite = await pbFetch(
      env.base,
      `/api/collections/events/records/${eventId}`,
      {
        method: "PATCH",
        token: organizerToken,
        body: inviteBody,
      },
    );
    console.log(
      `invite patch: ${invite.status} ${JSON.stringify(invite.json).slice(0, 200)}`,
    );
    verdict(
      "invite-patch",
      `${invite.status} → ${classify(invite.status, invite.json)}`,
    );
    if (invite.status !== 200) return;

    // 8. Read-back (admin) — what the invitation ACTUALLY landed in
    const after = await pbFetch(
      env.base,
      `/api/collections/events/records/${eventId}`,
      {
        token: adminToken,
      },
    );
    const contributors: any[] = after.json?.contributors ?? [];
    const guests: string[] = after.json?.guestUsers ?? [];
    const ghaldEntry = contributors.find((c) => c.id === ghaldId);
    verdict(
      "record-state",
      `contributors: ${ghaldEntry ? `ghald present, status=${ghaldEntry.status}` : "ghald MISSING"} | guestUsers: [${guests.join(", ")}] ${guests.includes(ghaldId) ? "— the filtered field IS written" : "— the filtered field is NOT written (smoking gun)"}`,
    );

    // 9. SSE delivery of the invitation update to ghald (events/* — measured on
    //    PB 0.37.5: the event is named after the SUBSCRIBED pattern)
    const received = await sse.waitFor(
      (e) => e.event === "events/*" && e.data.includes(`"id":"${eventId}"`),
      SSE_WAIT_MS,
    );
    if (!received) {
      verdict(
        "sse-delivery",
        "NOT delivered within timeout (ghald's subscription received no events/* update for the event)",
      );
      console.log(
        `events received: ${JSON.stringify(sse.snapshot().map((e) => ({ event: e.event, data: e.data.slice(0, 120) })))}`,
      );
    } else {
      const payload = JSON.parse(received.data) as {
        action?: string;
        record?: { id?: string; guestUsers?: string[] };
      };
      const payloadCovers = Array.isArray(payload.record?.guestUsers)
        ? payload.record!.guestUsers!.includes(ghaldId)
        : false;
      verdict(
        "sse-delivery",
        `DELIVERED cross-user (action=${payload.action ?? "n/a"}, record.guestUsers covers ghald: ${payloadCovers}) — the payload pb-sync puts in the invitee's Dexie`,
      );
    }

    // 10. list events (ghald) — the refetch-initial path (initialFetch is
    //     unfiltered; the listRule decides delivery)
    const list = await pbFetch(
      env.base,
      `/api/collections/events/records?perPage=200&filter=${encodeURIComponent(`id="${eventId}"`)}`,
      { token: ghaldToken },
    );
    const listed: boolean = (list.json?.items ?? []).some(
      (e: any) => e.id === eventId,
    );
    console.log(
      `list events (invitee): ${list.status}, ${list.json?.totalItems ?? "?"} item(s) for the exact filter`,
    );
    verdict(
      "list-to-invitee",
      listed
        ? "event DELIVERED to the invitee's list (listRule covers him — reload path works)"
        : "event ABSENT from the invitee's list (listRule filters it — the dashboard can never show it, even after Ctrl-R)",
    );

    // 11. direct GET (ghald) — strictest proof (viewRule; also what an event
    //     page deep-link needs)
    const view = await pbFetch(
      env.base,
      `/api/collections/events/records/${eventId}`,
      {
        token: ghaldToken,
      },
    );
    verdict(
      "get-by-invitee",
      `${view.status} → ${classify(view.status, view.json)}`,
    );

    // 12. Accept PATCH (ghald) — the updateContributorStatus path (contributors
    //     json only). Also the RSVP banner's action.
    const acceptEntry = {
      ...contributorEntry,
      status: "accepted",
      respondedAt: new Date().toISOString(),
    };
    const accept = await pbFetch(
      env.base,
      `/api/collections/events/records/${eventId}`,
      {
        method: "PATCH",
        token: ghaldToken,
        body: { contributors: [acceptEntry] },
      },
    );
    console.log(
      `accept patch (invitee): ${accept.status} ${JSON.stringify(accept.json).slice(0, 200)}`,
    );
    verdict(
      "accept-by-invitee",
      `${accept.status} → ${accept.status === 200 ? "accepted — the RSVP lands (updateRule covers the guest)" : classify(accept.status, accept.json)}`,
    );

    // 13. Final list — after accept, the dashboard source must carry the event
    const list2 = await pbFetch(
      env.base,
      `/api/collections/events/records?perPage=200&filter=${encodeURIComponent(`id="${eventId}"`)}`,
      { token: ghaldToken },
    );
    const listed2: boolean = (list2.json?.items ?? []).some(
      (e: any) => e.id === eventId,
    );
    verdict(
      "list-after-accept",
      listed2
        ? "event delivered after acceptance — the invitee's dashboard source is complete"
        : "event STILL absent after acceptance — 'appears after RSVP' cannot hold at the client",
    );
  } finally {
    sse.close();
    // Cleanup (admin) — event, probe user
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
      `/api/collections/users/records/${organizerId}`,
      {
        method: "DELETE",
        token: adminToken,
      },
    );
    console.log(`cleanup user ${organizerId}: ${delUser.status}`);
  }
}

main().catch((err) => {
  console.error(`probe failed: ${err}`);
  process.exit(1);
});
