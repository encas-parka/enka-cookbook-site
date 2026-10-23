/**
 * Logique pure de la liste plate de sélection de matériel pour les emprunts
 * (LoanMaterielList). Aucune dépendance Svelte : testable hors composant.
 */
import type { MaterielTypeOptions } from "$lib/types/pb-generated";
import type { EnrichedMateriel } from "$lib/types/materiel.types";
import { MATERIEL_TYPE_ORDER } from "./materiel.utils";

export type MaterielWithAvailability = EnrichedMateriel & {
  availableForPeriod?: number;
};

/** Segment d'affichage exclusif de la liste ; "" = tous. */
export type LoanSegmentFilter = "" | "selected" | "unselected";

/**
 * Filtres de la liste d'emprunt : type exclusif ("" = tous), segment
 * d'affichage exclusif ("" = tous) et restriction « disponible sur la
 * période » qui se compose en ET avec le segment.
 */
export interface LoanListFilters {
  type: string;
  segment: LoanSegmentFilter;
  availableOnly: boolean;
}

export const EMPTY_LOAN_FILTERS: LoanListFilters = Object.freeze({
  type: "",
  segment: "",
  availableOnly: false,
});

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

function isAvailableForPeriod(m: MaterielWithAvailability): boolean {
  return (m.availableForPeriod ?? 0) > 0;
}

/**
 * Regroupe des items par type dans l'ordre canonique (MATERIEL_TYPE_ORDER) ;
 * les types inconnus partent dans « other », l'absence de type aussi.
 */
export function groupByTypeOrder<T>(
  items: T[],
  getType: (item: T) => string | null | undefined,
): { type: string; items: T[] }[] {
  const byType = new Map<string, T[]>();
  for (const item of items) {
    const raw = getType(item);
    const type = raw && MATERIEL_TYPE_ORDER.includes(raw) ? raw : "other";
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }
  return MATERIEL_TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    items: byType.get(type)!,
  }));
}

export function groupMaterielsByType(
  items: MaterielWithAvailability[],
): MaterielGroup[] {
  return groupByTypeOrder(items, (m) => m.type) as MaterielGroup[];
}

interface FilterOptions {
  segment: LoanSegmentFilter;
  /** Restreindre aux matériels disponibles sur la période (ET avec segment). */
  availableOnly: boolean;
  /** Sélection courante (materielId → quantité). */
  quantities: Record<string, number>;
  /** Recherche insensible à la casse sur le nom. */
  search: string;
}

export function filterLoanMateriels(
  items: MaterielWithAvailability[],
  { segment, availableOnly, quantities, search }: FilterOptions,
): MaterielWithAvailability[] {
  const q = search.toLowerCase().trim();
  return items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    const selected = (quantities[item.id] ?? 0) >= 1;
    if (segment === "selected" && !selected) return false;
    if (segment === "unselected" && selected) return false;
    if (availableOnly && !isAvailableForPeriod(item)) return false;
    return true;
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
