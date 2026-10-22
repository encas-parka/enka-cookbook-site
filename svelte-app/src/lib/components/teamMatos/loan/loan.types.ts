/**
 * Types partagés par le formulaire d'emprunt (LoanForm) et son parcours
 * legacy (LoanLegacySelection).
 */

export type MaterielTypeLiteral =
  | "electronic"
  | "manual"
  | "other"
  | "tools"
  | "dish"
  | "cooking"
  | "gaz"
  | "hygiene"
  | "";

/** Matériel retenu dans l'emprunt, avec son plafond de quantité. */
export interface SelectedMateriel {
  materielId: string;
  materielName: string;
  quantity: number;
  type: MaterielTypeLiteral;
  maxQuantity: number;
  /** Matériel absent de l'inventaire : conservé par son snapshot. */
  isDeleted?: boolean;
}

/** Compteur de la sélection, affiché par les enveloppes (modal, page). */
export interface LoanSelectionSummary {
  itemCount: number;
  totalUnits: number;
}
