// T07 upsert verification probe — talks to the disposable 8094 instance.
// Never prints credentials. Subcommands:
//   counts            — per-collection record counts (14 collections)
//   recipe <slug>     — fetch one recipe by id (slug), print title only
//   probe-create      — create a source-foreign category record (purge probe)
//   probe-check       — check the purge-probe record still exists
//   noid-scan         — scan pb-import/*.json for records with neither id nor _refId
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ENV_FILE = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/scripts_dev/.env.local";
const IMPORT_DIR = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/scripts_dev/pb-import";
const BASE = "http://127.0.0.1:8094";
const PROBE_ID = "zupsertpurgepro"; // 15 chars — PB id max

const env: Record<string, string> = {};
for (const line of readFileSync(ENV_FILE, "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

let token = "";
async function auth() {
  const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  token = (await res.json()).token;
}

const COLLECTIONS = [
  "users", "teams", "materiel", "events", "products", "purchases", "materiel_loan",
  "event_materiel", "teamdocs", "event_todos", "share_links", "ingredients", "categories", "recipes",
];

const cmd = process.argv[2];

async function counts() {
  await auth();
  const out: Record<string, number> = {};
  for (const c of COLLECTIONS) {
    const res = await fetch(`${BASE}/api/collections/${c}/records?page=1&perPage=1`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error(`list ${c} failed: ${res.status}`);
    out[c] = (await res.json()).totalItems;
  }
  console.log(JSON.stringify(out, null, 2));
}

async function recipe(slug: string) {
  await auth();
  const res = await fetch(`${BASE}/api/collections/recipes/records/${slug}?fields=id,title,created,updated`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`recipe ${slug} not found: ${res.status}`);
  const r = await res.json();
  console.log(JSON.stringify(r, null, 2));
}

async function probeCreate() {
  await auth();
  const res = await fetch(`${BASE}/api/collections/categories/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ id: PROBE_ID, name: "z-upsert-purge-probe", type: "equipment_tag" }),
  });
  if (!res.ok) throw new Error(`probe create failed: ${res.status} ${await res.text()}`);
  console.log(`probe record created: ${PROBE_ID}`);
}

async function probeCheck() {
  await auth();
  const res = await fetch(`${BASE}/api/collections/categories/records/${PROBE_ID}`, {
    headers: { Authorization: token },
  });
  console.log(res.ok ? `probe record STILL PRESENT: ${PROBE_ID}` : `probe record GONE (${res.status}): ${PROBE_ID}`);
}

function noidScan() {
  let total = 0;
  for (const f of readdirSync(IMPORT_DIR)) {
    if (!f.endsWith(".json") || f === "id-map.json" || f === "expected-verdicts.json") continue;
    const records = JSON.parse(readFileSync(join(IMPORT_DIR, f), "utf-8"));
    const bad = records.filter((r: any) => !r.id && !r._refId);
    if (bad.length > 0) console.log(`${f}: ${bad.length} record(s) without id and without _refId`);
    total += bad.length;
  }
  console.log(`TOTAL records without deterministic id: ${total}`);
}

await auth().catch(() => {
  throw new Error("initial auth failed");
});
if (cmd === "counts") await counts();
else if (cmd === "recipe") await recipe(process.argv[3] ?? "");
else if (cmd === "probe-create") await probeCreate();
else if (cmd === "probe-check") await probeCheck();
else if (cmd === "noid-scan") noidScan();
else throw new Error(`unknown subcommand: ${cmd}`);
