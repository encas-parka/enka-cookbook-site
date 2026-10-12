// T07 — mutate the title of the first two recipes in pb-import/recipes.json
// (simulates sources edited after the first import). The file is backed up
// and restored outside this probe. Prints old/new titles for the report.
import { readFileSync, writeFileSync } from "fs";

const FILE = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/scripts_dev/pb-import/recipes.json";
const records = JSON.parse(readFileSync(FILE, "utf-8"));

const edited = [];
for (let i = 0; i < 2; i++) {
  const r = records[i];
  const oldTitle = r.title;
  r.title = `${oldTitle} (upsert T07)`;
  edited.push({ slug: r.id, oldTitle, newTitle: r.title });
}

writeFileSync(FILE, JSON.stringify(records, null, 2) + "\n");
console.log(JSON.stringify(edited, null, 2));
