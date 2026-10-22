#!/usr/bin/env bun
// Sonde HTTP du flux join-by-link + email groupé BCC (lot participation RSVP).
//
// Contre un PocketBase de dev (comptes dev, base jetable) :
//   1. join par lien → entrée au registre en statut "invited" + accès guestUsers
//   2. useCount incrémenté au premier join uniquement
//   3. re-join idempotent : pas de doublon, statut préservé
//   4. send-emails à N destinataires → une seule expédition SMTP, tous en BCC
//      (nécessite le récepteur : bun scripts_dev/smtp-sink.mjs)
//
// Prérequis : PB dev sur :8090 (bun run dev:pb) — le serveur doit être lancé
// SANS --dev pour éviter les rechargements à chaud pendant la sonde... ou avec,
// les deux conviennent tant que les hooks sont chargés.
// La config SMTP de PB est posée vers le sink pour la durée de la sonde puis
// restaurée à l'identique.
//
// Usage : bun scripts_dev/probe-rsvp-join.mjs
// Sortie : PASS/FAIL par check, code de sortie = nombre d'échecs.

const BASE = process.env.PB_URL || "http://localhost:8090";
const PASSWORD = "enkadevdev";
const SUPERUSER = "qaldek@gmx.com";
const ORGANIZER = "ghald@riseup.net";
const JOINER = "marionael@protonmail.com";
const SINK_LOG = "/tmp/opencode/smtp-sink.jsonl";

let failures = 0;
function check(label, ok, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* réponse non JSON (HTML d'erreur…) */
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

async function auth(collection, identity) {
  const r = await api(`/api/collections/${collection}/auth-with-password`, {
    method: "POST",
    body: { identity, password: PASSWORD },
  });
  return { token: r.token, id: r.record.id, email: r.record.email };
}

// --- Setup -----------------------------------------------------------------

const sinkStartBytes = (await Bun.file(SINK_LOG).exists())
  ? (await Bun.file(SINK_LOG).text()).length
  : 0;

const su = await auth("_superusers", SUPERUSER);
const organizer = await auth("users", ORGANIZER);
const joiner = await auth("users", JOINER);

// Config SMTP → sink (l'ancienne config est restaurée en fin de run)
const initialSettings = await api("/api/settings", { token: su.token });
const needsSmtp = !initialSettings.smtp?.enabled;
await api("/api/settings", {
  method: "PATCH",
  token: su.token,
  body: {
    smtp: {
      ...initialSettings.smtp,
      enabled: true,
      host: "127.0.0.1",
      port: 2525,
    },
    meta: { ...initialSettings.meta, senderAddress: "probe@enka.local" },
  },
});

let eventId, linkId;
try {
  // Event + lien de partage (posés par l'organisateur)
  const eventsCol = await api("/api/collections/events", { token: su.token });
  console.log(
    "champs requis events:",
    (eventsCol.fields || [])
      .filter((f) => f.required)
      .map((f) => `${f.name}(${f.type})`)
      .join(", "),
  );
  for (const f of eventsCol.fields || []) {
    console.log(
      `  - ${f.name} type=${f.type} req=${f.required} pattern=${f.pattern ?? ""} values=${JSON.stringify(f.values ?? [])} max=${f.max ?? ""}`,
    );
  }
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const event = await api("/api/collections/events/records", {
    method: "POST",
    token: organizer.token,
    body: {
      name: `Probe RSVP T03 ${stamp}`,
      description: "Sonde join-by-link + email groupé",
      status: "proposition",
      dateStart: "2026-11-15 10:00:00.000Z",
      dateEnd: "2026-11-15 18:00:00.000Z",
      minContrib: 1,
      createdBy: organizer.id, // createRule : body.createdBy = auth
    },
  });
  eventId = event.id;

  const link = await api("/api/collections/share_links/records", {
    method: "POST",
    token: organizer.token,
    body: {
      target_id: eventId,
      link_type: "event",
      isActive: true,
      token: "",
      createdBy: organizer.id,
    },
  });
  linkId = link.id;

  // --- 1. Join → invitation (statut invité) + accès -----------------------
  const join = await api("/api/enka/join-event", {
    method: "POST",
    token: joiner.token,
    body: { linkId },
  });
  check("join répond 200 avec l'eventId", join.eventId === eventId);

  const eventAfterJoin = await api(
    `/api/collections/events/records/${eventId}`,
    { token: joiner.token },
  );
  const entries = (eventAfterJoin.contributors || []).filter(
    (c) => (c.email || "").toLowerCase() === JOINER,
  );
  check(
    "le registre porte UNE entrée pour le joiner",
    entries.length === 1,
    `${entries.length} entrée(s)`,
  );
  check(
    "l'entrée est en statut invité (pas confirmée)",
    entries[0]?.status === "invited",
    `status=${entries[0]?.status}`,
  );
  check(
    "l'entrée porte le vrai userId",
    entries[0]?.id === joiner.id,
    `id=${entries[0]?.id}`,
  );
  check(
    "le joiner a l'accès (guestUsers)",
    (eventAfterJoin.guestUsers || []).includes(joiner.id),
  );

  const linkAfterJoin = await api(
    `/api/collections/share_links/records/${linkId}`,
    { token: organizer.token },
  );
  check(
    "useCount = 1 après le premier join",
    linkAfterJoin.useCount === 1,
    `useCount=${linkAfterJoin.useCount}`,
  );

  // --- 2. Re-join idempotent ----------------------------------------------
  await api("/api/enka/join-event", {
    method: "POST",
    token: joiner.token,
    body: { linkId },
  });
  const eventAfterRejoin = await api(
    `/api/collections/events/records/${eventId}`,
    { token: joiner.token },
  );
  const entriesAfterRejoin = (eventAfterRejoin.contributors || []).filter(
    (c) => (c.email || "").toLowerCase() === JOINER,
  );
  check(
    "re-join : toujours UNE entrée (pas de doublon)",
    entriesAfterRejoin.length === 1,
    `${entriesAfterRejoin.length} entrée(s)`,
  );
  check(
    "re-join : statut préservé",
    entriesAfterRejoin[0]?.status === "invited",
    `status=${entriesAfterRejoin[0]?.status}`,
  );
  const linkAfterRejoin = await api(
    `/api/collections/share_links/records/${linkId}`,
    { token: organizer.token },
  );
  check(
    "re-join : useCount inchangé",
    linkAfterRejoin.useCount === 1,
    `useCount=${linkAfterRejoin.useCount}`,
  );

  // --- 3. Email groupé, une seule expédition, BCC ---------------------------
  const recipients = [
    "probe-a@example.com",
    "probe-b@example.com",
    "probe-c@example.com",
  ];
  const send = await api("/api/enka/send-emails", {
    method: "POST",
    token: organizer.token,
    body: {
      template: "invitation_to_event",
      recipients: recipients.map((email) => ({ email, shareLinkId: linkId })),
    },
  });
  const okResults = (send.results || []).filter((r) => r.ok);
  check(
    "send-emails : 3/3 résultats ok par destinataire",
    okResults.length === 3,
    `ok=${okResults.length}/3`,
  );

  await new Promise((r) => setTimeout(r, 1500));
  const sinkText =
    sinkStartBytes > 0
      ? (await Bun.file(SINK_LOG).text()).slice(sinkStartBytes)
      : await Bun.file(SINK_LOG).text();
  const messages = sinkText
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.ts > Date.now() - 60_000);
  check(
    "UNE seule expédition SMTP pour 3 destinataires",
    messages.length === 1,
    `${messages.length} expédition(s) reçue(s) par le sink`,
  );
  const bccCount = messages[0]?.rcptTo.length - 1; // -1 : le To reprend l'expéditeur
  check(
    "les 3 destinataires partent en copie cachée",
    bccCount === 3,
    `rcptTo=[${messages[0]?.rcptTo.join(", ")}]`,
  );
  const msgHeaders = messages[0]?.headers ?? {};
  const toHeader = (msgHeaders.to ?? "").toLowerCase();
  check(
    "l'en-tête To n'expose aucun destinataire",
    toHeader.includes("probe@enka.local") &&
      recipients.every((r) => !toHeader.includes(r)),
    `To=${msgHeaders.to}`,
  );
  check(
    "aucun en-tête Cc/Bcc dans le message",
    msgHeaders.cc === null && msgHeaders.bcc === null,
    `cc=${msgHeaders.cc} bcc=${msgHeaders.bcc}`,
  );
} finally {
  // --- Cleanup ---------------------------------------------------------------
  if (linkId) {
    await api(`/api/collections/share_links/records/${linkId}`, {
      method: "DELETE",
      token: organizer.token,
    }).catch(() => {});
  }
  if (eventId) {
    await api(`/api/collections/events/records/${eventId}`, {
      method: "DELETE",
      token: organizer.token,
    }).catch(() => {});
  }
  await api("/api/settings", {
    method: "PATCH",
    token: su.token,
    body: needsSmtp
      ? { smtp: { ...initialSettings.smtp, enabled: false } }
      : { smtp: initialSettings.smtp },
  }).catch(() => {});
  console.log(
    needsSmtp
      ? "SMTP désactivé après la sonde (config initiale vide)"
      : "SMTP restauré à la config initiale",
  );
}

console.log(
  failures === 0 ? "\nSONDE VERTE" : `\nSONDE ROUGE (${failures} échec(s))`,
);
process.exit(failures);
