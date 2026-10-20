/**
 * T05 probe — teamdocs realtime (SSE) cross-user delivery against a live PB dev
 * instance.
 *
 * Ticket `05-teamdocs-realtime-content`: the page-level fix (propagate remote
 * updates into the edit form) rests on the server actually DELIVERING update
 * events cross-user. T04's probe measured REST visibility (list/GET per
 * viewRule) but never an actual SSE subscription — the delivery claim was
 * inferred from "SSE follows viewRule". This probe measures it.
 *
 * Setup mirrors the click-through condition (two-user, self-cleaning):
 *   - event created by admin, `createdBy` = ghald (PB_USER_*), probe user = guest
 *   - ghald creates a teamdoc (exact SPA payload of createEventDocument)
 *   - probe user opens a REALTIME SSE connection and subscribes
 *     COLLECTION-WIDE (`teamdocs/*`) — exactly what the SPA store does
 *     (`createSyncCollection(...).subscribe()`), not a per-record subscription
 *   - ghald PATCHes the doc (the app's save path = update)
 *
 * Checks:
 *   1. sse-connect  — PB_CONNECT received (clientId handed out)
 *   2. sse-subscribe — POST /api/realtime subscription accepted (204)
 *   3. sse-delivery — `teamdocs/<docId>` event received with action=update and
 *      the NEW content in `record` (the payload the page consumes via Dexie)
 *
 * All records created here (doc, event, probe user) are deleted again (admin)
 * — the probe leaves the database unchanged. Safe to re-run.
 *
 * Credentials come from `scripts_dev/.env.local` (never hardcoded):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, PB_USER_EMAIL, PB_USER_PASSWORD.
 *
 * Usage: bun run scripts_dev/probe-t05-teamdocs-sse.ts
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
  console.log(`# T05 SSE probe against ${env.base}`);

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

  // 2. ghald auth (userA — creator, does the save)
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

  // 3. Probe user (admin-created, transitory — userB, the SSE watcher)
  const stamp = Date.now();
  const probeEmail = `probe-t05-${stamp}@enka-dev.local`;
  const probePassword = `probe-t05-${stamp}-Pw`;
  const probeUser = await pbFetch(env.base, "/api/collections/users/records", {
    method: "POST",
    token: adminToken,
    body: {
      email: probeEmail,
      password: probePassword,
      passwordConfirm: probePassword,
      name: "probe-t05",
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

  // 4. Probe event (admin-created): ghald = creator, probe user = guest.
  const event = await pbFetch(env.base, "/api/collections/events/records", {
    method: "POST",
    token: adminToken,
    body: {
      name: `probe-t05-${stamp}`,
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

  const sse = new RealtimeClient();
  let docId: string | null = null;
  try {
    // 5. ghald creates the teamdoc (exact SPA payload of createEventDocument)
    const create = await pbFetch(
      env.base,
      "/api/collections/teamdocs/records",
      {
        method: "POST",
        token: userToken,
        body: {
          title: "probe-t05 doc",
          content: "version 1",
          tags: ["materiel"],
          eventId,
          status: "doc",
        },
      },
    );
    if (create.status !== 200) {
      console.log(
        `ghald doc create failed: ${create.status} ${JSON.stringify(create.json).slice(0, 300)}`,
      );
      process.exit(1);
    }
    docId = create.json.id as string;
    console.log(`probe teamdoc (by ghald): ${docId}`);

    // 6. userB opens the SSE connection — collection-wide, like the SPA store
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
    verdict("sse-connect", `PB_CONNECT received (clientId ${clientId})`);

    const sub = await pbFetch(env.base, "/api/realtime", {
      method: "POST",
      token: probeToken,
      body: { clientId, subscriptions: ["teamdocs/*"] },
    });
    verdict(
      "sse-subscribe",
      `teamdocs/* ${sub.status === 204 ? "accepted (204)" : `rejected (${sub.status})`}`,
    );
    if (sub.status !== 204) return;

    // Let the subscription register server-side before the write
    await sleep(300);

    // 7. ghald saves — the app's update path (PATCH)
    const patch = await pbFetch(
      env.base,
      `/api/collections/teamdocs/records/${docId}`,
      {
        method: "PATCH",
        token: userToken,
        body: {
          title: "probe-t05 doc",
          content: "version 2 — saved by userA",
          tags: ["materiel", "tache"],
        },
      },
    );
    console.log(`update teamdocs (by ghald): ${patch.status}`);
    if (patch.status !== 200) {
      verdict(
        "sse-delivery",
        `update itself failed (${patch.status}) — probe setup broken`,
      );
      return;
    }

    // 8. userB expects the update under the SUBSCRIBED topic name — measured
    //    on PB 0.37.5: the SSE event is named after the subscription pattern
    //    ("teamdocs/*"), not the concrete per-record topic.
    const received = await sse.waitFor(
      (e) => e.event === "teamdocs/*" && e.data.includes(`"id":"${docId}"`),
      TIMEOUT_MS,
    );
    if (!received) {
      verdict(
        "sse-delivery",
        "NOT delivered within timeout (no teamdocs/* event carrying the doc for the guest)",
      );
      console.log(
        `events received: ${JSON.stringify(sse.snapshot().map((e) => ({ event: e.event, data: e.data.slice(0, 120) })))}`,
      );
      return;
    }
    const payload = JSON.parse(received.data) as {
      action?: string;
      record: { id: string; title?: string; content?: string; tags?: string[] };
    };
    const contentOk = payload.record?.content === "version 2 — saved by userA";
    const tagsOk =
      Array.isArray(payload.record?.tags) && payload.record.tags.length === 2;
    verdict(
      "sse-delivery",
      `DELIVERED cross-user (event=${received.event}, action=${payload.action ?? "n/a"}, content matches: ${contentOk}, tags match: ${tagsOk}) — the payload the page consumes via Dexie`,
    );
  } finally {
    sse.close();
    // 9. Cleanup (admin) — doc, event, probe user
    if (docId) {
      const delDoc = await pbFetch(
        env.base,
        `/api/collections/teamdocs/records/${docId}`,
        {
          method: "DELETE",
          token: adminToken,
        },
      );
      console.log(`cleanup teamdocs ${docId}: ${delDoc.status}`);
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
