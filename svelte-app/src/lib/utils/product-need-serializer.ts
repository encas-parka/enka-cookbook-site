import type {
  ByDateEntry,
  DateDisplayInfo,
  EnrichedProduct,
  NumericQuantity,
} from "../types/store.types";
import type { ProductNeedRow } from "../db-sync/pb-sync";

export interface ParsedNeed {
  id: string;
  mainId: string;
  ingredientRef: string;
  productName: string;
  productType: string;
  pF: boolean;
  pS: boolean;
  byDate: Record<string, ByDateEntry>;
  totalNeededArray: NumericQuantity[];
  nbRecipes: number;
  totalAssiettes: number;
  dateDisplayInfo: Record<string, DateDisplayInfo>;
  created: string;
  updated: string;
}

export function parseNeedRow(row: ProductNeedRow): ParsedNeed {
  return {
    id: row.id,
    mainId: row.mainId,
    ingredientRef: row.ingredientRef,
    productName: row.productName,
    productType: row.productType,
    pF: row.pF,
    pS: row.pS,
    byDate: JSON.parse(row.byDate),
    totalNeededArray: JSON.parse(row.totalNeededArray),
    nbRecipes: row.nbRecipes,
    totalAssiettes: row.totalAssiettes,
    dateDisplayInfo: JSON.parse(row.dateDisplayInfo),
    created: row.created,
    updated: row.updated,
  };
}

export function toNeedRow(
  enriched: EnrichedProduct,
  mainId: string,
): ProductNeedRow {
  const now = new Date().toISOString();
  return {
    id: enriched.id,
    mainId,
    ingredientRef: enriched.ingredientRef || "",
    productName: enriched.productName,
    productType: enriched.productType,
    pF: enriched.pF,
    pS: enriched.pS,
    byDate: JSON.stringify(enriched.byDate),
    totalNeededArray: JSON.stringify(enriched.totalNeededArray),
    nbRecipes: enriched.nbRecipes,
    totalAssiettes: enriched.totalAssiettes,
    dateDisplayInfo: JSON.stringify(enriched.dateDisplayInfo),
    created: enriched.created || now,
    updated: now,
  };
}
