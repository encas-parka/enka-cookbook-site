/**
 * Test d'inversion T05 (transient) — fabrique puis restaure une divergence
 * de contenu sur l'instance JETABLE 8091. Jamais sur le dev 8090.
 *
 *   bun run .scratch/probes/t05-invert.ts patch    → titre := "T05 INVERSION <original>"
 *   bun run .scratch/probes/t05-invert.ts restore  → titre := original
 */
import { readFileSync } from "fs";
import { join } from "path";

const BASE = "http://127.0.0.1:8091";
const SLUG = "kalb-el-louz-gateau-de_hn7u4fndnq39";
const MARKER_FILE = ".scratch/probes/t05-invert-original.txt";

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
const H = { Authorization: (await auth.json()).token, "Content-Type": "application/json" };

const mode = process.argv[2];
const current = await (await fetch(BASE + "/api/collections/recipes/records/" + SLUG, { headers: H })).json();

if (mode === "patch") {
  await Bun.write(MARKER_FILE, current.title);
  const title = "T05 INVERSION " + current.title;
  const res = await fetch(BASE + "/api/collections/recipes/records/" + SLUG, {
    method: "PATCH", headers: H, body: JSON.stringify({ title }),
  });
  console.log("PATCH title →", res.status, JSON.stringify(title));
} else if (mode === "restore") {
  const original = await Bun.file(MARKER_FILE).text();
  const res = await fetch(BASE + "/api/collections/recipes/records/" + SLUG, {
    method: "PATCH", headers: H, body: JSON.stringify({ title: original }),
  });
  console.log("RESTORE title →", res.status, JSON.stringify(original));
} else {
  console.log("titre courant:", JSON.stringify(current.title));
}
