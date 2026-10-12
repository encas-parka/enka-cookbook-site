/**
 * verdicts-file.ts — Shared writer for pb-import/expected-verdicts.json.
 *
 * The verdict file consumed by validate-migration.ts (schema version 1 —
 * see the validate header) is EMITTED by the pipeline, not hand-written:
 * each writer owns a scope and replaces what it previously emitted, so a
 * re-run on fresh sources converges the file to the current measurements.
 *
 * Ownership rules (the whole contract of a concurrent-writer-safe file):
 *   - a verdict carries the `emitter` that produced it;
 *   - emitting replaces every verdict with the same (type, collection|slug)
 *     key — including untagged hand-written entries — and drops the emitter's
 *     previous verdicts that it no longer produces;
 *   - verdicts outside every emitter's scope are never touched: a stale
 *     hand-written entry survives until validate flags it as unmatched.
 *
 * Deterministic output: canonical verdict order, 2-space JSON, no timestamps
 * — two runs on identical sources produce byte-identical files.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type ExpectedVerdict = {
  type: "count-delta" | "absent-recipe" | "recipe-convergence";
  collection?: string;
  delta?: number;
  slug?: string;
  fields?: string[];
  category?: string;
  reason?: string;
  emitter?: string;
};

const VERDICTS_FILE = join(import.meta.dir, "pb-import", "expected-verdicts.json");

const TYPE_RANK: Record<ExpectedVerdict["type"], number> = {
  "count-delta": 0,
  "absent-recipe": 1,
  "recipe-convergence": 2,
};

// Identity within the file: at most one verdict per (type, collection|slug).
function verdictKey(v: ExpectedVerdict): string {
  if (v.type === "count-delta") return `count-delta:${v.collection ?? ""}`;
  return `${v.type}:${v.slug ?? ""}`;
}

function compareVerdicts(a: ExpectedVerdict, b: ExpectedVerdict): number {
  const rankDiff = TYPE_RANK[a.type] - TYPE_RANK[b.type];
  if (rankDiff !== 0) return rankDiff;
  const ka = verdictKey(a);
  const kb = verdictKey(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return (a.delta ?? 0) - (b.delta ?? 0);
}

/**
 * Merge `verdicts` into the verdict file as `emitter`'s current scope and
 * rewrite the file. Safe to call with an empty list (cleans the emitter's
 * stale entries). Throws on a malformed existing file — never silently
 * rebuild over unreadable content.
 */
export function emitVerdicts(emitter: string, verdicts: ExpectedVerdict[]): void {
  let existing: ExpectedVerdict[] = [];
  if (existsSync(VERDICTS_FILE)) {
    const parsed = JSON.parse(readFileSync(VERDICTS_FILE, "utf-8"));
    if (!parsed || !Array.isArray(parsed.verdicts)) {
      throw new Error(`Malformed verdicts file (expected { version, verdicts[] }): ${VERDICTS_FILE}`);
    }
    existing = parsed.verdicts;
  }

  const mine = verdicts.map((v) => ({ ...v, emitter }));
  const replacedKeys = new Set(mine.map(verdictKey));
  const kept = existing.filter((v) => v.emitter !== emitter && !replacedKeys.has(verdictKey(v)));
  const merged = [...kept, ...mine].sort(compareVerdicts);

  writeFileSync(VERDICTS_FILE, JSON.stringify({ version: 1, verdicts: merged }, null, 2) + "\n");

  const breakdown = mine
    .map((v) => {
      const key = v.type === "count-delta" ? `${v.collection} ${v.delta}` : v.slug;
      return `${v.type} ${key}`;
    })
    .join(", ");
  console.log(`   📋 verdicts emitted (${mine.length})${breakdown ? `: ${breakdown}` : ""} → ${VERDICTS_FILE}`);
}

// Stable category labels for the verdicts the pipeline emits — one place so
// the report tables and the emitted file stay consistent.
export const VERDICT_CATEGORY = {
  orphanSourceRecord: "orphan-source-record",
  orphanTeamRecreated: "orphan-team-recreated",
  duplicateIngredientUuid: "duplicate-ingredient-uuid",
  recipeParseError: "recipe-parse-error",
  testRecipe: "test-recipe",
  renamedSlug: "renamed-slug",
  contentDriftSinceFreeze: "content-drift-since-freeze",
  importRejected: "import-rejected",
} as const;
