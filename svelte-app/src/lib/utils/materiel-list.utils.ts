/**
 * Logique pure de la liste plate de sélection de matériel pour les emprunts
 * (LoanMaterielList). Aucune dépendance Svelte : testable hors composant.
 */
import type { MaterielTypeOptions } from "$lib/types/pb-generated";
import type { EnrichedMateriel } from "$lib/types/materiel.types";

export type MaterielWithAvailability = EnrichedMateriel & {
  availableForPeriod?: number;
};

/** Segments cochables de la liste ; l'union des segments actifs filtre les items. */
export type LoanSegment = "selected" | "unselected" | "available";

/** Item d'un emprunt sans matériel vivant correspondant (supprimé du stock). */
export interface GhostLoanItem {
  materielId: string;
  materielName: string;
  quantity: number;
}

export interface MaterielGroup {
  type: MaterielTypeOptions;
  items: MaterielWithAvailability[];
}

/** Ordre canonique d'affichage des sections par type. */
const TYPE_ORDER: MaterielTypeOptions[] = [
  "cooking",
  "dish",
  "gaz",
  "hygiene",
  "electronic",
  "manual",
  "tools",
  "other",
];

/** Ordre canonique des types, exposé pour trier les facettes de la sidebar. */
export const LOAN_TYPE_ORDER: string[] = [...TYPE_ORDER];

function isAvailableForPeriod(m: MaterielWithAvailability): boolean {
  return (m.availableForPeriod ?? 0) > 0;
}

export function groupMaterielsByType(
  items: MaterielWithAvailability[],
): MaterielGroup[] {
  const byType = new Map<MaterielTypeOptions, MaterielWithAvailability[]>();
  for (const item of items) {
    const type = TYPE_ORDER.includes(item.type as MaterielTypeOptions)
      ? (item.type as MaterielTypeOptions)
      : "other";
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }
  return TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    items: byType.get(type)!,
  }));
}

interface FilterOptions {
  /** Segments actifs (union) ; vide = tous les items. */
  segments: LoanSegment[];
  /** Sélection courante (materielId → quantité). */
  quantities: Record<string, number>;
  /** Recherche insensible à la casse sur le nom. */
  search: string;
}

export function filterLoanMateriels(
  items: MaterielWithAvailability[],
  { segments, quantities, search }: FilterOptions,
): MaterielWithAvailability[] {
  const q = search.toLowerCase().trim();
  return items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (segments.length === 0) return true;
    const selected = (quantities[item.id] ?? 0) >= 1;
    // Union : un item passe s'il satisfait au moins un segment actif.
    return segments.some((segment) => {
      switch (segment) {
        case "selected":
          return selected;
        case "unselected":
          return !selected;
        case "available":
          return isAvailableForPeriod(item);
      }
    });
  });
}

export function summarizeSelection(quantities: Record<string, number>): {
  itemCount: number;
  totalUnits: number;
} {
  let itemCount = 0;
  let totalUnits = 0;
  for (const qty of Object.values(quantities)) {
    if (qty >= 1) {
      itemCount++;
      totalUnits += qty;
    }
  }
  return { itemCount, totalUnits };
}

export function clampQuantity(qty: number, max: number): number {
  if (Number.isNaN(qty) || qty < 0) return 0;
  return Math.min(qty, max);
}

export function countAvailable(items: MaterielWithAvailability[]): number {
  return items.filter(isAvailableForPeriod).length;
}

/** Libellés d'affichage des types dans le flux emprunt (groupes + facettes). */
const LOAN_TYPE_LABELS: Record<string, string> = {
  cooking: "Matériel de cuisine",
  dish: "Vaisselle",
  gaz: "Gaz",
  hygiene: "Hygiène",
  electronic: "Électronique",
  manual: "Ustensiles",
  tools: "Outils",
  other: "Autre",
};

export function loanTypeLabel(type: string): string {
  return LOAN_TYPE_LABELS[type] ?? type;
}
