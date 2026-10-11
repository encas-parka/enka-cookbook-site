/**
 * Diff de convergence des 92 recettes Appwrite vs leur copie PB (importée du
 * markdown Hugo). Lecture seule. (artefact diagnostic — .scratch/probes/)
 *
 * Identité : l'$id Appwrite d'une recette EST le slug Hugo (vérifié).
 * Compare les champs plats : draft, typeR, nb ingredients, somme
 * normalizedQuantity, nb astuces, longueur preparation, dates.
 */
import { Database } from "bun:sqlite";

const aw = JSON.parse(
  await Bun.file("scripts_dev/appwrite-export/recipes.json").text(),
);
const db = new Database("pocketbase/pb_data/data.db", { readonly: true });

function statsIng(ing) {
  // Appwrite stocke les items en STRINGS JSON (pattern double-encodé) ;
  // PB (post-2b) les a natifs. Normaliser les deux.
  let list = ing;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return { n: 0, sum: 0 };
  const objs = list.map((i) => (typeof i === "string" ? JSON.parse(i) : i));
  return {
    n: objs.length,
    sum: Math.round(objs.reduce((s, i) => s + (i.normalizedQuantity || 0), 0)),
  };
}
function normDate(d) {
  return d ? String(d).slice(0, 10) : "";
}

let ok = 0,
  divergent = 0,
  absentPB = 0;
const report = [];

for (const r of aw.rows) {
  const slug = r.$id;
  const pb = db.query("SELECT * FROM recipes WHERE id = ?").get(slug);
  if (!pb) {
    absentPB++;
    report.push({ slug, issue: "ABSENTE_EN_PB" });
    continue;
  }

  const awIng = statsIng(r.ingredients);
  const pbIng = statsIng(
    typeof pb.ingredients === "string"
      ? JSON.parse(pb.ingredients || "[]")
      : pb.ingredients,
  );
  const awAst = Array.isArray(r.astuces)
    ? r.astuces.length
    : typeof r.astuces === "string" && r.astuces
      ? JSON.parse(r.astuces).length
      : 0;
  const pbAst = pb.astuces ? JSON.parse(pb.astuces).length : 0;

  const diffs = [];
  if ((r.title || "") !== (pb.title || ""))
    diffs.push(`title: aw="${r.title}" pb="${pb.title}"`);
  if (!!r.draft !== !!pb.draft)
    diffs.push(`draft: aw=${r.draft} pb=${pb.draft}`);
  if (awIng.n !== pbIng.n)
    diffs.push(`ingredients: aw=${awIng.n} pb=${pbIng.n}`);
  if (awIng.sum !== pbIng.sum)
    diffs.push(`sumQty: aw=${awIng.sum} pb=${pbIng.sum}`);
  if (awAst !== pbAst) diffs.push(`astuces: aw=${awAst} pb=${pbAst}`);
  if ((r.preparation || "").length !== (pb.preparation || "").length)
    diffs.push(
      `prepLen: aw=${(r.preparation || "").length} pb=${(pb.preparation || "").length}`,
    );
  if (normDate(r.$updatedAt) !== normDate(pb.updated))
    diffs.push(
      `updatedAt: aw=${normDate(r.$updatedAt)} pb=${normDate(pb.updated)}`,
    );

  if (diffs.length === 0) ok++;
  else {
    divergent++;
    report.push({ slug, diffs });
  }
}

console.log(`\n=== Convergence recettes Appwrite(${aw.rows.length}) vs PB ===`);
console.log(
  `conformes: ${ok} | divergentes: ${divergent} | absentes PB: ${absentPB}`,
);
for (const r of report.slice(0, 20))
  console.log(`- ${r.slug}: ${(r.diffs || []).join(" | ") || r.issue}`);
await Bun.write(
  ".scratch/probes/recipes-convergence.json",
  JSON.stringify({ ok, divergent, absentPB, report }, null, 2),
);
console.log("\ndetail → .scratch/probes/recipes-convergence.json");
db.close();
