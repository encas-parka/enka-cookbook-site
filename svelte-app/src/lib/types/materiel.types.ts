import type { Models } from "appwrite";
import type {
  Materiel,
  MaterielType,
  MaterielStatus,
  MaterielLoan,
  MaterielLoanStatus,
} from "./appwrite";

// =============================================================================
// TYPES APPWRITE - Format brut depuis Appwrite
// =============================================================================

/**
 * Type union pour faciliter l'utilisation des status de prêt avec des string literals
 * Évite les problèmes de typage avec les enums auto-générés
 */
export type MaterielLoanStatusUnion =
  | "asked"
  | "accepted"
  | "refused"
  | "canceled"
  | "returned"
  | "completed"
  | "archived";

/**
 * Type alias pour clarifier qu'il s'agit du format brut Appwrite
 * C'est exactement le même type que Materiel mais rend explicite
 * qu'on travaille avec des données non-transformées
 */
export type MaterielFromAppwrite = Models.Row & Materiel;

// =============================================================================
// TYPES LOCAUX - Format parsé côté client
// =============================================================================

// Structure d'un item d'emprunt dans MaterielLoan
export interface MaterielLoanItem {
  materielId: string;
  materielName: string; // Snapshot du nom au moment de l'emprunt
  quantity: number;
  lostQuantity?: number; // Nombre d'articles perdus (retour d'emprunt)
  brokenQuantity?: number; // Nombre d'articles cassés (retour d'emprunt)
}

// Détail d'un emprunt côté client (calculé depuis MaterielLoan)
export interface MaterielLoanDetail {
  loanId: string; // ID du MaterielLoan
  responsibleName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  status: "asked" | "accepted" | "canceled";
}

// Structure du propriétaire (après parsing du JSON depuis Appwrite)
export interface MaterielOwner {
  userName?: string; // Nom du user propriétaire
  userId?: string; // ID du user (si owner = user)
  teamName?: string; // Nom de l'équipe (si owner = team)
  teamId?: string; // ID de l'équipe (si owner = team)
}

// =============================================================================
// TYPES ENRICHIS - Format calculé côté client
// =============================================================================

/**
 * Statut calculé côté client pour le matériel enrichi
 * - Les statuts Appwrite bruts : ok, lost, torepair
 * - Les statuts calculés depuis les emprunts : loan (en cours), reserved (futur)
 */
export type EnrichedMaterielStatus = MaterielStatus | "loan" | "reserved";

/**
 * Matériel enrichi avec données parsées et calculées
 *
 * Pattern similaire à EnrichedEvent :
 * - Conserve tous les champs Appwrite bruts (pour référence)
 * - Ajoute les champs parsés (ownerData, loanDetails)
 * - Ajoute les champs calculés (availableQuantity, isAvailable, etc.)
 */
export interface EnrichedMateriel extends Omit<
  MaterielFromAppwrite,
  "owner" | "status"
> {
  // Champ brut Appwrite (JSON stringifié)
  owner: string | null; // Données brutes Appwrite (JSON string)

  // Statut enrichi (peut être un statut Appwrite ou un statut calculé)
  status: EnrichedMaterielStatus;

  // Champs enrichis parsés depuis Appwrite
  ownerData: MaterielOwner; // Owner parsé depuis le JSON
  loanDetails: MaterielLoanDetail[]; // Emprunts actifs/planifiés calculés depuis MaterielLoan

  // Champs dérivés calculés
  availableQuantity: number; // Quantité disponible (quantity - totalLoanedQuantity)
  totalLoanedQuantity: number; // Quantité totale empruntée
  isAvailable: boolean; // Au moins 1 dispo
  isFullyLoaned: boolean; // Tout est emprunté
}

// =============================================================================
// ENRICHED LOAN - Emprunt enrichi avec données parsées
// =============================================================================

/**
 * Type alias pour un loan Appwrite brut
 */
export type MaterielLoanFromAppwrite = MaterielLoan;

/**
 * Emprunt enrichi avec les données parsées
 * Pattern similaire à EnrichedEvent et EnrichedMateriel :
 * - Conserve tous les champs Appwrite bruts
 * - Ajoute le champ materielItems parsé depuis le JSON
 */
export interface EnrichedMaterielLoan extends Omit<
  MaterielLoanFromAppwrite,
  "materiels"
> {
  // Champ brut Appwrite (tableau de JSON strings)
  materiels: string[] | null; // Tableau où chaque string est un MaterielLoanItem JSON-stringifié

  // Champ enrichi parsé depuis Appwrite
  materielItems: MaterielLoanItem[]; // Items parsés en tableau d'objets
}

export interface MaterielFilters {
  type?: MaterielType | null;
  status?: MaterielStatus | null;
  location?: string | null;
  loan?: string | null;
  hasAvailable?: boolean; // true = a de la quantité dispo
  ownerType?: "me" | "myTeams" | "others";
  search?: string; // recherche textuelle
}
