/**
 * Types pour la gestion du matériel événement (collection 'event_materiel')
 *
 * Chaque document représente un item de matériel nécessaire pour un événement.
 * Pas de JSON à parser ici (contrairement à MaterielLoan), tout est en champs plats.
 */

import type { EventMateriel } from "./appwrite";

// =============================================================================
// STATUTS (PROVISOIRE : commenté en attendant refonte)
// Le statut est actuellement derivé de `where` dans l'UI
// TODO: refondre selon besoin : tofind | ok | bonus
// =============================================================================

// export type EventMaterielStatus = "needed" | "confirmed" | "brought";

export type EventMaterielType =
  | "electronic"
  | "manual"
  | "other"
  | "tools"
  | "dish"
  | "cooking"
  | "gaz"
  | "hygiene";

// =============================================================================
// TYPES ENRICHIS
// =============================================================================

/**
 * Item de matériel événement enrichi
 *
 * Pas de JSON à parser, mais on ajoute le type strict pour les enums
 * et des champs dérivés pour l'UI.
 */
export interface EnrichedEventMateriel extends EventMateriel {
  // Les champs Appwrite sont déjà plats, on hérite directement
  // Les enums sont castés en types string stricts pour l'UI
}

// =============================================================================
// FILTRES UI
// =============================================================================

export interface EventMaterielFilters {
  types?: EventMaterielType[];
  // statuses?: EventMaterielStatus[]; // TODO: status derive de where
  who?: string[]; // filtres par personne (inclut "__none__" pour "Personne")
  where?: string[]; // filtres par lieu (inclut "__none__" pour "À trouver")
  search?: string; // recherche globale (nom, who, where, notes)
}

export type EventMaterielSortField = "name" | "type" | "status" | "who" | "where";

export type SortDirection = "asc" | "desc";

export interface EventMaterielSort {
  field: EventMaterielSortField;
  direction: SortDirection;
}

// =============================================================================
// CRÉATION / UPDATE
// =============================================================================

export interface CreateEventMaterielData {
  eventId: string;
  name: string;
  quantity: number;
  type: EventMaterielType;
  who?: string | null;
  where?: string | null;
  fromTeamName?: string | null;
  sourceMaterielId?: string | null;
  loanId?: string | null;
  // status?: EventMaterielStatus; // TODO: status derive de where
  notes?: string | null;
}

export type UpdateEventMaterielData = Partial<CreateEventMaterielData>;
