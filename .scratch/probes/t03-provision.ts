// Throwaway provisioning helper (T03 harness) — reads scripts_dev/.env.local
// and upserts the superuser on the virgin 8093 pb_data. Never prints the
// password; output is reduced to the exit status.
import { readFileSync } from "fs";

const ENV_FILE = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/scripts_dev/.env.local";
const PB_BIN = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/pocketbase/pocketbase";

const env: Record<string, string> = {};
for (const line of readFileSync(ENV_FILE, "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const res = Bun.spawnSync(
  [
    PB_BIN,
    "superuser",
    "upsert",
    env.PB_ADMIN_EMAIL,
    env.PB_ADMIN_PASSWORD,
    "--dir=/tmp/orchestrate/t03-harness/pb_data",
    "--migrationsDir=/tmp/orchestrate/t03-harness/pb_migrations",
    "--hooksDir=/tmp/orchestrate/t03-harness/pb_hooks",
  ],
  { stdout: "pipe", stderr: "pipe" },
);
if (res.exitCode !== 0) {
  console.error("superuser upsert FAILED, stderr (password-masked):");
  console.error(res.stderr.toString().split(env.PB_ADMIN_PASSWORD).join("***"));
  process.exit(1);
}
console.log("superuser upserted on harness pb_data (email matches scripts_dev/.env.local PB_ADMIN_EMAIL)");
