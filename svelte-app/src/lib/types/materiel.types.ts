/**
 * Types pour la gestion du matériel (collection 'materiel' + 'materiel_loan')
 *
 * Deux collections PB :
 * - materiel : inventaire de matériel (propriété user ou team)
 * - materiel_loan : emprunts de matériel entre users/teams pour des événements
 */

import type { Materiel, MaterielLoan } from "./pb";
import type { MaterielLoanStatusOptions } from "./pb-generated";

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

// =============================================================================
// TYPES ENRICHIS - Format calculé côté client
// =============================================================================

/**
 * État d'affichage dérivé du stock et de l'activité — jamais persisté
 * (ADR 0003) :
 * - état de stock : complete (stock entier disponible), partial (N exemplaires
 *   en réparation, les sains disponibles), repair (stock en réparation, plus
 *   rien de disponible), depleted (stock épuisé ou quantité inconnue)
 * - activité d'emprunt : loan (emprunt actif), reserved (emprunt planifié) —
 *   prioritaire sur l'état de stock.
 */
export type MaterielDisplayState =
  "complete" | "partial" | "repair" | "depleted" | "loan" | "reserved";

/**
 * Matériel enrichi avec données calculées
 *
 * - Conserve tous les champs PB bruts (dont teamId, ownerUser)
 * - Ajoute les champs calculés (loanDetails, availableQuantity, etc.)
 */
export interface EnrichedMateriel extends Materiel {
  // État d'affichage dérivé (stock × activité) — jamais écrit en base
  displayState: MaterielDisplayState;

  // Champs enrichis
  loanDetails: MaterielLoanDetail[];

  // Champs dérivés calculés
  /** quantity − enEmprunt − repairQuantity (stock inconnu = 0, conservateur). */
  availableQuantity: number;
  totalLoanedQuantity: number;
  isAvailable: boolean;
  /** Plus aucune unité disponible : empruntée, en réparation ou épuisée. */
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
export interface EnrichedMaterielLoan extends Omit<MaterielLoan, "materiels"> {
  // Champ brut PB (peut être string, string[] ou object[] selon la source)
  materiels: unknown | null;

  // Champ enrichi parsé (toujours MaterielLoanItem[])
  materielItems: MaterielLoanItem[];
}

// =============================================================================
// FILTRES UI
// =============================================================================

// L'interface MaterielFilters (type, status, location…) est supprimée : morte
// depuis la migration PB — MaterielFilters.svelte définit son propre
// MaterielFiltersType, désormais adossé aux états dérivés (MaterielDisplayState).
