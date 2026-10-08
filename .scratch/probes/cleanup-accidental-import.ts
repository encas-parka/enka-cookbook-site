/**
 * Cleanup doublons du run d'import accidentel du 08-10 ~18:57.
 * (artefact diagnostic transient — .scratch/probes/)
 *
 * Principe : l'id-map.json écrasé par le run accidentel contient refId →
 * id PB des DOUBLONS. Croisé avec migration-map.json (intact, 07-10) qui
 * liste les refIds par collection, on obtient la liste exacte des doublons.
 * categories (absente de migration-map) : 60 doublons = 60 rowids max,
 * validés par appariement de nom avec un original plus ancien.
 *
 * Validations bloquantes (abort sans suppression au moindre écart) :
 *   - chaque id existe dans sa table ;
 *   - created < 2026-07-01 (dates Appwrite — un record utilisateur récent
 *     ne peut pas être dans le set) ;
 *   - les doublons sont strictement les rowids max de leur table ;
 *   - les comptes supprimés = comptes attendus.
 * PB doit être ARRÊTÉ (vérifié avant lancement).
 */
import { Database } from "bun:sqlite";

const idMap = JSON.parse(await Bun.file("scripts_dev/pb-import/id-map.json").text());
const mMap = JSON.parse(await Bun.file("scripts_dev/migration-map.json").text());

// collection → nombre de doublons attendus (validé manuellement avant)
const EXPECTED = {
  teams: 8,
  materiel: 110,
  events: 39,
  products: 982,
  purchases: 955,
  materiel_loan: 2,
  event_materiel: 278,
  share_links: 6,
};

const db = new Database("pocketbase/pb_data/data.db");
db.exec("PRAGMA busy_timeout = 5000");

function abort(msg) {
  console.error(`ABORT: ${msg}`);
  db.close();
  process.exit(1);
}

// --- Construction des sets de doublons ---
const dupSets = {};
const coveredRefIds = new Set();
for (const col of Object.keys(EXPECTED)) {
  const entries = mMap[col] || {};
  const ids = [];
  for (const [awId, e] of Object.entries(entries)) {
    const refId = e.refId;
    coveredRefIds.add(refId);
    const pbId = idMap[refId];
    if (pbId) ids.push(pbId);
  }
  if (ids.length !== EXPECTED[col]) {
    abort(`${col}: ${ids.length} ids extraits, ${EXPECTED[col]} attendus`);
  }
  dupSets[col] = ids;
}

// Clés de l'id-map non couvertes (diagnostic)
const leftovers = Object.keys(idMap).filter((k) => !coveredRefIds.has(k));
console.log(`id-map: ${Object.keys(idMap).length} entrées, ${coveredRefIds.size} couvertes par migration-map, ${leftovers.length} hors couverture`);
console.log(`échantillon hors couverture: ${leftovers.slice(0, 5).join(", ")}`);
// les hors couverture correspondent-ils à des rows existants ? (catégories ? locks ? ...)
for (const k of leftovers.slice(0, 8)) {
  const id = idMap[k];
  const hit = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_%'").all()
    .map((t) => t.name)
    .map((t) => ({ t, n: db.query(`SELECT count(*) c FROM ${t} WHERE id = ?`).get(id).c }))
    .filter((r) => r.n > 0);
  console.log(`  ${k} -> ${id} : ${hit.map((h) => h.t).join(",") || "aucune table"}`);
}

// --- Validations ---
let totalDelete = 0;
for (const [col, ids] of Object.entries(dupSets)) {
  const placeholders = ids.map(() => "?").join(",");
  const missing = db
    .query(`SELECT count(*) c FROM ${col} WHERE id IN (${placeholders})`)
    .get(...ids).c;
  if (missing !== ids.length) abort(`${col}: ${ids.length - missing} ids absents de la DB`);

  const recent = db
    .query(`SELECT count(*) c FROM ${col} WHERE id IN (${placeholders}) AND created < '2026-10-08 16:50:00'`)
    .get(...ids).c;
  if (recent > 0) abort(`${col}: ${recent} ids avec created hors fenêtre accident (UTC < 16:50)`);

  // invariant : AUCUN record hors set ne doit être dans la fenêtre accident
  const inWindow = db
    .query(`SELECT count(*) c FROM ${col} WHERE created >= '2026-10-08 16:50:00' AND id NOT IN (${placeholders})`)
    .get(...ids).c;
  if (inWindow > 0) abort(`${col}: ${inWindow} rows hors set créés dans la fenêtre accident`);

  // les doublons doivent être strictement les rowids max de la table
  const maxDupRowid = db
    .query(`SELECT max(rowid) m FROM ${col} WHERE id IN (${placeholders})`)
    .get(...ids).m;
  const above = db
    .query(`SELECT count(*) c FROM ${col} WHERE rowid > ?`).get(maxDupRowid).c;
  const aboveNotDup = db
    .query(`SELECT count(*) c FROM ${col} WHERE rowid > ? AND id NOT IN (${placeholders})`)
    .get(maxDupRowid, ...ids).c;
  if (aboveNotDup > 0) {
    abort(`${col}: ${aboveNotDup} rows non-doublons AU-DESSUS du max rowid des doublons (activité interleavée ?)`);
  }
  totalDelete += ids.length;
  console.log(`${col}: ${ids.length} doublons identifiés (rowid max ${maxDupRowid}, ${above} rows au-dessus)`);
}

// --- categories : 60 doublons par fenêtre de rowid, validés par nom ---
const catCount = db.query("SELECT count(*) c FROM categories").get().c;
if (catCount !== 120) abort(`categories: ${catCount} rows, 120 attendus`);
const catDups = db
  .query("SELECT id, name, rowid FROM categories ORDER BY rowid DESC LIMIT 60")
  .all();
const catNames = catDups.map((r) => r.name);
const ph = catNames.map(() => "?").join(",");
const paired = db
  .query(`SELECT count(DISTINCT name) c FROM categories WHERE name IN (${ph}) AND id NOT IN (${catDups.map(() => "?").join(",")})`)
  .get(...catNames, ...catDups.map((r) => r.id)).c;
if (paired !== new Set(catNames).size) {
  abort(`categories: appariement par nom incomplet (${paired}/${new Set(catNames).size})`);
}
const catRecent = db
  .query(`SELECT count(*) c FROM categories WHERE id IN (${catDups.map(() => "?").join(",")}) AND created < '2026-10-08 16:50:00'`)
  .get(...catDups.map((r) => r.id)).c;
if (catRecent > 0) abort(`categories: ${catRecent} ids hors fenêtre accident dans la fenêtre rowid`);
dupSets.categories = catDups.map((r) => r.id);
totalDelete += catDups.length;
console.log(`categories: ${catDups.length} doublons identifiés par fenêtre rowid (appariement OK)`);

console.log(`TOTAL à supprimer: ${totalDelete}`);

// --- Suppression transactionnelle ---
db.exec("BEGIN");
try {
  for (const [col, ids] of Object.entries(dupSets)) {
    const placeholders = ids.map(() => "?").join(",");
    const res = db
      .query(`DELETE FROM ${col} WHERE id IN (${placeholders})`)
      .run(...ids);
    if (res.changes !== ids.length) throw new Error(`${col}: ${res.changes}/${ids.length} supprimés`);
    console.log(`DELETE ${col}: ${res.changes}`);
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  abort(`rollback: ${err.message}`);
}

// --- Recomptage final ---
const expectedFinal = {
  teams: 8, materiel: 110, events: 40, products: 982, purchases: 955,
  materiel_loan: 2, event_materiel: 308, teamdocs: 42, event_todos: 34,
  recipes: 456, ingredients: 845, categories: 60, share_links: 6,
  locks: 3, users: 59,
};
let ok = true;
for (const [t, exp] of Object.entries(expectedFinal)) {
  const c = db.query(`SELECT count(*) c FROM ${t}`).get().c;
  const mark = c === exp ? "OK" : "!! ECART";
  if (c !== exp) ok = false;
  console.log(`${t}: ${c} (attendu ${exp}) ${mark}`);
}
console.log(ok ? "\nOK Cleanup terminé, comptes conformes" : "\n!! ECARTS DETECTES — investiguer");
db.close();
