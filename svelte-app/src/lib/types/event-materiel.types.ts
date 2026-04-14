/**
 * Types pour la gestion du matériel événement (collection 'event_materiel')
 *
 * Chaque document représente un item de matériel nécessaire pour un événement.
 * Pas de JSON à parser ici (contrairement à MaterielLoan), tout est en champs plats.
 */

import type { EventMateriel } from "./appwrite";

// =============================================================================
// STATUTS
// =============================================================================

export type EventMaterielStatus = "to_find" | "to_check" | "confirmed";

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
  statuses?: EventMaterielStatus[];
  who?: string[];
  where?: string[];
  search?: string;
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
  status?: EventMaterielStatus;
  groupId?: string | null;
  who?: string | null;
  where?: string | null;
  fromTeamName?: string | null;
  sourceMaterielId?: string | null;
  loanId?: string | null;
  notes?: string | null;
}

export type UpdateEventMaterielData = Partial<CreateEventMaterielData>;

// =============================================================================
// GROUPES (besoin + allocations)
// =============================================================================

export interface MaterielGroup {
  header: EventMateriel;
  allocations: EventMateriel[];
  remainingQty: number;
  totalAllocated: number;
}
