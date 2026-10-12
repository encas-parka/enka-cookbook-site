/**
 * recipe-convergence.ts — Shared Appwrite-vs-PB recipe diff.
 *
 * Single source of truth for the recipe convergence comparison, consumed by
 * both sides of the contract:
 *   - validate-migration.ts (check): export vs live PB records
 *   - 2b-transform-recipes.ts (emission): export vs the records it emits from
 *     the Hugo content (identical values for the compared fields — recipes are
 *     imported from 2b's output, and the compared fields are invariant under
 *     the import-time refId remapping)
 *
 * The compared fields and their order (title, draft, ingredients, sumQty,
 * astuces, prepLen) are the contract consumed by expected-verdicts.json
 * ("fields" arrays) — change both sides together, never one.
 */

export function normDay(value: any): string {
  return value ? String(value).slice(0, 10) : "";
}

// Appwrite stores ingredient items as JSON-encoded strings (double-encoded
// pattern); PB (post 2b) has them native. Normalize both sides.
export function ingredientStats(raw: any): { n: number; sum: number } {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return { n: 0, sum: 0 };
  const objs = list.map((i: any) => (typeof i === "string" ? JSON.parse(i) : i));
  return {
    n: objs.length,
    sum: Math.round(objs.reduce((s: number, i: any) => s + (i.normalizedQuantity || 0), 0)),
  };
}

export function jsonLen(raw: any): number {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return 0;
    }
  }
  return Array.isArray(v) ? v.length : 0;
}

// Flat content diff between the Appwrite-native recipe (its $id IS the Hugo
// slug) and its PB-shaped copy. updatedAt day drift is reported separately:
// it is informative only (Hugo is the fresher source), never a verdict.
export function diffRecipeConvergence(
  aw: any,
  pbLike: any
): { divergentFields: string[]; hasDateDrift: boolean } {
  const divergentFields: string[] = [];
  const awIng = ingredientStats(aw.ingredients);
  const pbIng = ingredientStats(pbLike.ingredients);
  if ((aw.title || "") !== (pbLike.title || "")) divergentFields.push("title");
  if (!!aw.draft !== !!pbLike.draft) divergentFields.push("draft");
  if (awIng.n !== pbIng.n) divergentFields.push("ingredients");
  if (awIng.sum !== pbIng.sum) divergentFields.push("sumQty");
  if (jsonLen(aw.astuces) !== jsonLen(pbLike.astuces)) divergentFields.push("astuces");
  if ((aw.preparation || "").length !== (pbLike.preparation || "").length) divergentFields.push("prepLen");

  const dateDrift = normDay(aw["$updatedAt"]) !== normDay(pbLike.updated);
  return { divergentFields, hasDateDrift: dateDrift };
}
