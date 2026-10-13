import { describe, it, expect } from "vitest";

import { filterRecipesForViewer, parseRecipeToIndexEntry } from "../recipeUtils";

/**
 * Entrée d'index construite par le builder réel du store — il normalise
 * `draft` en booléen (`recipe.draft || false`), contrat que le filtre consomme.
 */
const entry = (fields: { id: string; title: string; draft?: boolean }) =>
  parseRecipeToIndexEntry({
    id: fields.id,
    title: fields.title,
    draft: fields.draft,
    createdBy: "user-1",
  });

describe("filterRecipesForViewer — brouillons invisibles pour un visiteur", () => {
  const recipes = [
    entry({ id: "draft-1", title: "Brouillon", draft: true }),
    entry({ id: "public-1", title: "Publiée", draft: false }),
  ];

  it("un visiteur ne voit pas les brouillons dans la liste", () => {
    const visible = filterRecipesForViewer(recipes, false);
    expect(visible.map((r) => r.id)).toEqual(["public-1"]);
  });

  it("un utilisateur authentifié voit la liste inchangée (brouillons compris)", () => {
    const visible = filterRecipesForViewer(recipes, true);
    expect(visible.map((r) => r.id)).toEqual(["draft-1", "public-1"]);
  });

  it("une recette sans marqueur draft (import legacy) reste visible pour un visiteur", () => {
    const legacy = entry({ id: "legacy-1", title: "Importée" });
    expect(legacy.draft).toBe(false);
    expect(filterRecipesForViewer([legacy], false).map((r) => r.id)).toEqual([
      "legacy-1",
    ]);
  });

  it("une liste entièrement en brouillon rend vide pour un visiteur", () => {
    expect(filterRecipesForViewer([recipes[0]], false)).toEqual([]);
  });
});
