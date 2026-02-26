/**
 * Utilitaire centralisé pour le formatage des quantités
 * Règles d'arrondi unifiées pour toute l'application
 */

export interface NumericQuantity {
  q: number;
  u: string;
}

/**
 * Règles d'arrondi standardisées :
 * - kg et l. : 2 décimales
 * - gr. et ml : 0 décimale
 * - Autres unités : 1 décimale
 */
export function formatQuantity(qty: number, unit: string): string {
  const rounded = applyStandardRounding(qty, unit);
  return `${rounded} ${unit}`;
}

/**
 * Version numérique (pour les calculs qui ont besoin de la valeur arrondie)
 */
export function formatQuantityNumber(qty: number, unit: string): number {
  return applyStandardRounding(qty, unit);
}

/**
 * Applique les règles d'arrondi standardisées
 */
export function applyStandardRounding(qty: number, unit: string): number {
  switch (unit) {
    case "kg":
    case "l.": {
      const rounded = Math.round(qty * 100) / 100;
      return rounded;
    }
    case "gr.":
    case "ml": {
      return Math.round(qty);
    }
    default: {
      return Math.round(qty * 10) / 10;
    }
  }
}

/**
 * Formate un tableau de NumericQuantity pour l'affichage
 */
export function formatTotalQuantity(total: NumericQuantity[]): string {
  if (!total?.length) return "-";
  return total.map((p) => formatSingleQuantity(p.q, p.u)).join(" et ");
}

/**
 * Convertit et formate une quantité selon les règles standardisées
 * Retourne un objet avec la valeur formatée et l'unité convertie
 * @param value - La quantité à convertir (nombre ou chaîne)
 * @param unit - L'unité de la quantité
 * @returns Objet avec la valeur formatée et l'unité convertie
 */
export function convertAndFormatQuantity(
  value: string | number,
  unit: string,
): { value: number; unit: string } {
  // Convertir en nombre
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) {
    return { value: 0, unit };
  }

  // Conversion automatique pour les grandes quantités
  let finalUnit = unit;
  let finalNum = num;

  if ((unit === "gr." || unit === "ml") && num >= 1000) {
    finalNum = num / 1000;
    finalUnit = unit === "gr." ? "kg" : "l.";
  } else if ((unit === "kg" || unit === "l.") && num < 1 && num > 0) {
    finalNum = num * 1000;
    finalUnit = unit === "kg" ? "gr." : "ml";
  }

  // Appliquer les règles d'arrondi
  const rounded = applyStandardRounding(finalNum, finalUnit);

  // La valeur retournée est un nombre (arrondi selon les règles)
  return { value: rounded, unit: finalUnit };
}

/**
 * Formate une quantité individuelle selon les règles standardisées
 */
export function formatSingleQuantity(value: number, unit: string): string {
  const { value: numericValue, unit: convertedUnit } = convertAndFormatQuantity(
    value,
    unit,
  );

  // Formater la valeur pour l'affichage
  let formattedValue: string;
  if (convertedUnit === "kg" || convertedUnit === "l.") {
    // Garder jusqu'à 2 décimales mais retirer les zéros superflus
    formattedValue = numericValue.toFixed(2).replace(/\.?0+$/, "");
  } else {
    formattedValue = numericValue.toString();
  }

  return `${formattedValue} ${convertedUnit}`;
}

/**
 * Fonction utilitaire pour arrondir les valeurs brutes (pour compatibilité)
 */
export function roundAndTrim(value: number): string {
  return applyStandardRounding(value, "").toString();
}

/**
 * Scale une quantité (ingrédient) selon un ration (target/base)
 * Et applique une conversion d'unité intelligente (kg <-> gr)
 */
export function scaleAndFormatIngredient(
  quantity: number,
  unit: string,
  scaleFactor: number,
): {
  quantity: number;
  unit: string;
  formatted: string;
  formattedNumber: string;
} {
  // Cas spécial : "au goût" - ne pas scaler
  if (unit === "au goût") {
    return {
      quantity,
      unit,
      formatted: `${quantity} ${unit}`,
      formattedNumber: `${quantity}`,
    };
  }

  // 1. Scaler la valeur brute
  const scaledRaw = quantity * scaleFactor;

  // 2. Convertir intelligemment l'unité
  const { q: finalQty, u: finalUnit } = autoConvertUnit(scaledRaw, unit);

  // 3. Formater pour affichage
  const rounded = applyStandardRounding(finalQty, finalUnit);

  // Formatage textuel (gestion des décimales pour kg/l)
  let formattedNumber = `${rounded}`;
  if (finalUnit === "kg" || finalUnit === "l.") {
    // Garder jusqu'à 2 décimales mais retirer les zéros superflus (ex: 2.50 -> 2.5, 2.00 -> 2)
    formattedNumber = rounded.toFixed(2).replace(/\.?0+$/, "");
  }

  return {
    quantity: rounded,
    unit: finalUnit,
    formatted: `${formattedNumber} ${finalUnit}`,
    formattedNumber,
  };
}

/**
 * Convertit automatiquement les unités selon la grandeur
 * - kg/l -> gr/ml si < 1
 * - gr/ml -> kg/l si >= 1000
 */
export function autoConvertUnit(qty: number, unit: string): NumericQuantity {
  const u = unit.toLowerCase().trim();

  // Cas 1 : De GR/ML vers KG/L (si très grand)
  if ((u === "gr." || u === "ml") && qty >= 1000) {
    return {
      q: qty / 1000,
      u: u === "gr." ? "kg" : "l.",
    };
  }

  // Cas 2 : De KG/L vers GR/ML (si très petit)
  if ((u === "kg" || u === "l.") && qty < 1 && qty > 0) {
    return {
      q: qty * 1000,
      u: u === "kg" ? "gr." : "ml",
    };
  }

  // Pas de changement
  return { q: qty, u: unit };
}

/**
 * Agrège des quantités par unité SANS conversion ni arrondi
 * Utilisé pour les calculs intermédiaires où il faut préserver la précision
 * @param quantities - Tableau de NumericQuantity à agréger
 * @returns Tableau agrégé par unité
 */
export function aggregateByUnit(
  quantities: NumericQuantity[],
): NumericQuantity[] {
  if (!quantities?.length) return [];

  const unitMap = new Map<string, number>();

  quantities.forEach(({ q, u }) => {
    if (typeof q === "number" && !isNaN(q)) {
      const existing = unitMap.get(u) || 0;
      unitMap.set(u, existing + q);
    }
  });

  return Array.from(unitMap.entries()).map(([u, q]) => ({
    q,
    u,
  }));
}

/**
 * Soustrait deux tableaux de NumericQuantity et retourne les résultats bruts
 * @param resources - Quantités disponibles
 * @param needs - Quantités nécessaires
 * @returns NumericQuantity[] avec valeurs positives (surplus) et négatives (manquants)
 */
export function subtractQuantities(
  resources: NumericQuantity[],
  needs: NumericQuantity[],
): NumericQuantity[] {
  const resourceMap = new Map<string, number>();
  const needMap = new Map<string, number>();

  // Agréger les ressources par unité
  resources.forEach(({ q, u }) => {
    resourceMap.set(u, (resourceMap.get(u) || 0) + q);
  });

  // Agréger les besoins par unité
  needs.forEach(({ q, u }) => {
    needMap.set(u, (needMap.get(u) || 0) + q);
  });

  // Calculer la différence avec conservation du signe
  const result: NumericQuantity[] = [];
  const allUnits = new Set([...resourceMap.keys(), ...needMap.keys()]);

  for (const unit of allUnits) {
    const resourceQty = resourceMap.get(unit) || 0;
    const needQty = needMap.get(unit) || 0;
    const diff = resourceQty - needQty;

    // Garder les valeurs non nulles (positives ET négatives)
    if (Math.abs(diff) > 0.001) {
      // Éviter les problèmes de flottants
      result.push({ q: diff, u: unit });
    }
  }

  return result;
}
