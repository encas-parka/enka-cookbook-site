/**
 * Types pour la gestion du matériel (collection 'materiel' + 'materiel_loan')
 *
 * Deux collections PB :
 * - materiel : inventaire de matériel (propriété user ou team)
 * - materiel_loan : emprunts de matériel entre users/teams pour des événements
 */

import type { Materiel, MaterielLoan } from "./pb";
import type {
  MaterielTypeOptions,
  MaterielStatusOptions,
  MaterielLoanStatusOptions,
} from "./pb-generated";

// Re-export select types (single source of truth)
export type { MaterielLoanStatusOptions } from "./pb-generated";

// =============================================================================
// DEPRECATED ALIASES — kept for backward compatibility with consumers
// =============================================================================

/**
 * @deprecated Use MaterielLoanStatusOptions directly
 */
export type MaterielLoanStatusUnion = MaterielLoanStatusOptions;

/**
 * @deprecated Use Materiel directly (PocketBase format, no transformation needed)
 */
export type MaterielFromAppwrite = Materiel;

/**
 * @deprecated Use MaterielLoan directly
 */
export type MaterielLoanFromAppwrite = MaterielLoan;

// =============================================================================
// TYPES LOCAUX - Structures JSON dans les collections
// =============================================================================

/** Structure d'un item d'emprunt dans le JSON materiels de MaterielLoan */
export interface MaterielLoanItem {
  materielId: string;
  materielName: string; // Snapshot du nom au moment de l'emprunt
  quantity: number;
  lostQuantity?: number; // Nombre d'articles perdus (retour d'emprunt)
  brokenQuantity?: number; // Nombre d'articles cassés (retour d'emprunt)
}

/** Détail d'un emprunt côté client (calculé depuis MaterielLoan) */
export interface MaterielLoanDetail {
  loanId: string;
  responsibleName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  status: "asked" | "accepted" | "canceled";
}

/** Structure du propriétaire (après parsing du JSON depuis Materiel.owner) */
export interface MaterielOwner {
  userName?: string;
  userId?: string;
  teamName?: string;
  teamId?: string;
}

// =============================================================================
// TYPES ENRICHIS - Format calculé côté client
// =============================================================================

/**
 * Statut calculé côté client pour le matériel enrichi
 * - Les statuts PB bruts : ok, lost, torepair
 * - Les statuts calculés depuis les emprunts : loan (en cours), reserved (futur)
 */
export type EnrichedMaterielStatus = MaterielStatusOptions | "loan" | "reserved";

/**
 * Matériel enrichi avec données parsées et calculées
 *
 * - Conserve tous les champs PB bruts (pour référence)
 * - Ajoute les champs parsés (ownerData, loanDetails)
 * - Ajoute les champs calculés (availableQuantity, isAvailable, etc.)
 */
export interface EnrichedMateriel extends Omit<
  Materiel,
  "status"
> {
  // Statut enrichi (PB ou calculé depuis emprunts)
  status: EnrichedMaterielStatus;

  // Champs enrichis parsés
  ownerData: MaterielOwner;
  loanDetails: MaterielLoanDetail[];

  // Champs dérivés calculés
  availableQuantity: number;
  totalLoanedQuantity: number;
  isAvailable: boolean;
  isFullyLoaned: boolean;
}

// =============================================================================
// ENRICHED LOAN - Emprunt enrichi avec données parsées
// =============================================================================

/**
 * Emprunt enrichi avec les données parsées
 * - Conserve tous les champs PB bruts
 * - Ajoute le champ materielItems parsé depuis le JSON
 */
export interface EnrichedMaterielLoan extends Omit<
  MaterielLoan,
  "materiels"
> {
  // Champ brut PB (peut être string, string[] ou object[] selon la source)
  materiels: unknown | null;

  // Champ enrichi parsé (toujours MaterielLoanItem[])
  materielItems: MaterielLoanItem[];
}

// =============================================================================
// FILTRES UI
// =============================================================================

export interface MaterielFilters {
  type?: MaterielTypeOptions | null;
  status?: MaterielStatusOptions | null;
  location?: string | null;
  loan?: string | null;
  hasAvailable?: boolean;
  ownerType?: "me" | "myTeams" | "others";
  search?: string;
}
