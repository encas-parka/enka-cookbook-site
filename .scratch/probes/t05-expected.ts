/**
 * Sonde de calibrage T05 (transient — .scratch/probes/).
 * Mesure, contre l'instance jetable 8091 (données t04-impl, dates fixées) :
 *   1. event_todos : embedded parsables vs malformed, standalone orphelins
 *   2. recettes Appwrite absentes de content/recipe (+ catégorie pressantie)
 *   3. convergence contenu Appwrite vs PB (API) — champs divergents par slug
 *   4. teamdocs : repro du rejet d'import (create → erreur → delete)
 * Aucune écriture repo. Instance jetable uniquement (jamais 8090).
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const BASE = "http://127.0.0.1:8091";

const env: Record<string, string> = {};
for (const line of readFileSync(join("scripts_dev", ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const auth = await fetch(BASE + "/api/collections/_superusers/auth-with-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD }),
});
const token = (await auth.json()).token;
const H = { Authorization: token };

function rows(name: string): any[] {
  const j = JSON.parse(readFileSync(join("scripts_dev", "appwrite-export", name + ".json"), "utf-8"));
  if (Array.isArray(j)) return j;
  for (const k of ["rows", "users", "teams"]) if (Array.isArray(j[k])) return j[k];
  return [];
}

// --- 1. event_todos ---
console.log("=== 1. event_todos ===");
const events = rows("events");
let embOk = 0;
const embBad: string[] = [];
for (const e of events) {
  for (const t of e.todos || []) {
    try { JSON.parse(t); embOk++; } catch { embBad.push(e.name + " :: " + String(t).slice(0, 80)); }
  }
}
console.log("embedded strings:", embOk + embBad.length, "| parsables:", embOk, "| malformed:", embBad.length);
for (const b of embBad) console.log("  MALFORMED:", b);
const evIds = new Set(events.map((e: any) => e["$id"]));
for (const t of rows("event_todos")) {
  const orphan = !evIds.has(t.eventId);
  console.log("  standalone:", JSON.stringify({ id: t["$id"], task: t.taskName, orphan }));
}

// --- 2. recettes absentes de content/recipe ---
console.log("\n=== 2. Recettes Appwrite absentes de content/recipe ===");
const hugoSlugs = new Set(
  readdirSync(join("content", "recipe"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name),
);
const awRecipes = rows("recipes");
const absent = awRecipes.filter((r: any) => !hugoSlugs.has(r["$id"]));
console.log("aw recipes:", awRecipes.length, "| absentes de Hugo:", absent.length);
for (const r of absent) console.log("  ABSENT:", JSON.stringify({ slug: r["$id"], title: r.title, draft: r.draft }));

// --- 3. convergence contenu ---
console.log("\n=== 3. Convergence Appwrite vs PB (contenu) ===");
function ingStats(raw: any): { n: number; sum: number } {
  let list = raw;
  if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = []; } }
  if (!Array.isArray(list)) return { n: 0, sum: 0 };
  const objs = list.map((i: any) => (typeof i === "string" ? JSON.parse(i) : i));
  return { n: objs.length, sum: Math.round(objs.reduce((s: number, i: any) => s + (i.normalizedQuantity || 0), 0)) };
}
function arrLen(raw: any): number {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return 0; } }
  return Array.isArray(v) ? v.length : 0;
}
const pbRecipes: any[] = [];
let page = 1;
while (true) {
  const res = await fetch(BASE + "/api/collections/recipes/records?page=" + page + "&perPage=500", { headers: H });
  const data = await res.json();
  pbRecipes.push(...(data.items || []));
  if (pbRecipes.length >= (data.totalItems || 0) || (data.items || []).length < 500) break;
  page++;
}
const pbBySlug = new Map(pbRecipes.map((r) => [r.id, r]));
let conv = 0, divergent = 0, dateDrift = 0;
for (const aw of awRecipes) {
  const pb = pbBySlug.get(aw["$id"]);
  if (!pb) continue;
  const aIng = ingStats(aw.ingredients), pIng = ingStats(pb.ingredients);
  const diffs: string[] = [];
  if ((aw.title || "") !== (pb.title || "")) diffs.push("title: aw=" + JSON.stringify(aw.title) + " pb=" + JSON.stringify(pb.title));
  if (!!aw.draft !== !!pb.draft) diffs.push("draft: aw=" + aw.draft + " pb=" + pb.draft);
  if (aIng.n !== pIng.n) diffs.push("ingredients: aw=" + aIng.n + " pb=" + pIng.n);
  if (aIng.sum !== pIng.sum) diffs.push("sumQty: aw=" + aIng.sum + " pb=" + pIng.sum);
  if (arrLen(aw.astuces) !== arrLen(pb.astuces)) diffs.push("astuces: aw=" + arrLen(aw.astuces) + " pb=" + arrLen(pb.astuces));
  if ((aw.preparation || "").length !== (pb.preparation || "").length) diffs.push("prepLen: aw=" + (aw.preparation || "").length + " pb=" + (pb.preparation || "").length);
  const dd = String(aw["$updatedAt"] || "").slice(0, 10) !== String(pb.updated || "").slice(0, 10);
  if (dd) dateDrift++;
  if (diffs.length === 0) conv++;
  else { divergent++; console.log("  DIVERGENT " + aw["$id"] + " [" + diffs.join(" | ") + "]" + (dd ? " +updatedAt-day" : "")); }
}
console.log("convergence: ok=" + conv, "divergentes=" + divergent, "dateDrift(jour)=" + dateDrift, "sur", awRecipes.length);

// --- 4. teamdocs repro ---
console.log("\n=== 4. teamdocs repro (create sur jetable, puis delete) ===");
const tdRows = rows("teamdocs");
const big = tdRows.find((d: any) => (d.content || "").length > 5000);
if (!big) {
  console.log("aucun teamdocs avec content > 5000 dans la source !");
} else {
  console.log("cible:", JSON.stringify({ id: big["$id"], title: big.title, len: (big.content || "").length }));
  const imp = JSON.parse(readFileSync(join("scripts_dev", "pb-import", "teamdocs.json"), "utf-8"));
  const rec = (Array.isArray(imp) ? imp : imp.rows || []).find((d: any) => d._appwriteId === big["$id"] || d._refId === "aw_" + big["$id"]);
  console.log("pb-import record:", rec ? JSON.stringify({ id: rec.id, refId: rec._refId, teamId: rec.teamId, eventId: rec.eventId, len: (rec.content || "").length }) : "ABSENT de pb-import");
  if (rec) {
    const payload = { ...rec };
    delete payload._refId; delete payload._appwriteId; delete payload._source;
    const created = await fetch(BASE + "/api/collections/teamdocs/records", {
      method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await created.json();
    console.log("CREATE status:", created.status, "→", JSON.stringify(body).slice(0, 300));
    if (created.ok) {
      const del = await fetch(BASE + "/api/collections/teamdocs/records/" + body.id, { method: "DELETE", headers: H });
      console.log("DELETE du repro:", del.status);
    }
  }
}
console.log("\n(sonde terminée)");
