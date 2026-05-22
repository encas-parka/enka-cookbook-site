/**
 * recipe-reference.ts — Données de référence quasi-statiques pour les recettes
 *
 * Ces listes sont stables et rarement modifiées. Elles sont définies en
 * constantes TS plutôt qu'en collection PB pour éviter la complexité du
 * pb-sync (delta sync, SSE) pour des données qui changent une fois par an.
 *
 * Les ajouts utilisateur sont persistés dans db.catalog (local).
 *
 * @module data/recipe-reference
 */

// =============================================================================
// MATÉRIEL DE CUISINE (41 items — extrait des equipment_tag PB)
// =============================================================================

/**
 * Liste de référence des équipements de cuisine utilisables dans les recettes.
 * Source : PB collection `categories` avec `type = "equipment_tag"`.
 *
 * Les ajouts utilisateur sont stockés dans `db.catalog` (clé: "custom-materiel").
 */
export const DEFAULT_MATERIEL: readonly string[] = [
  "Bain Marie",
  "Bruleur",
  "Ficelle",
  "Four",
  "Frigo",
  "Friteuse",
  "Gastro 1/1 (10cm)",
  "Gastro 1/1 (15cm)",
  "Gastro 1/1 (20cm)",
  "Gastro 1/1 (5cm)",
  "Gastro 1/3",
  "Gastro 1/6",
  "Gastro Perforé 1/1 (10cm)",
  "Gastro Perforé 1/1 (25cm)",
  "Giraffe (Bras Mixeur)",
  "Grand Saladier",
  "Marmitte",
  "Moule a cake",
  "Moule à muffin",
  "Moule à tarte",
  "Pique à brochette",
  "Plat Paela",
  "Plateaux",
  "Poêle",
  "Presse-purée",
  "Ramequins",
  "Rice Cooker",
  "Robot Mixeur",
  "Robot-coupe",
  "Sauteuse",
  "anneaux en inox",
  "bassine de boulangerie",
  "batteur",
  "bol",
  "cuiseur vapeur",
  "film étirable",
  "lèche frite ou plaque de cuisson",
  "pinceau alimentaire",
  "plaque de cuisson",
  "pétrin",
  "rondo",
] as const;

// =============================================================================
// RÉGIMES ALIMENTAIRES (4 items)
// =============================================================================

/**
 * Liste de référence des régimes alimentaires.
 * Les ajouts utilisateur sont stockés dans `db.catalog` (clé: "custom-regimes").
 */
export const DEFAULT_REGIMES: readonly string[] = [
  "vegan",
  "vegetarien",
  "sans-gluten",
  "sans-lactose",
] as const;

// =============================================================================
// UTILITAIRES DE FUSION
// =============================================================================

/**
 * Fusionne la liste par défaut avec les ajouts utilisateur depuis db.catalog.
 */
export function mergeWithCustom(
  defaults: readonly string[],
  custom: string[] | undefined,
): string[] {
  if (!custom || custom.length === 0) {
    return [...defaults];
  }
  const seen = new Set(defaults);
  const result = [...defaults];
  for (const item of custom) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "fr"));
}
