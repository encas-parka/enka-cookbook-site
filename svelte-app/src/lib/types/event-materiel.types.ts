/**
 * Types pour la gestion du matériel événement (collection 'event_materiel')
 *
 * Chaque document représente un item de matériel nécessaire pour un événement.
 * Pas de JSON à parser ici, tout est en champs plats.
 */

import type { EventMateriel } from "./pb";
import type {
  EventMaterielStatusOptions,
  EventMaterielTypeOptions,
} from "./pb-generated";

// Re-export select types (single source of truth)
export type { EventMaterielStatusOptions as EventMaterielStatus, EventMaterielTypeOptions as EventMaterielType } from "./pb-generated";
export { EventMaterielStatusOptions, EventMaterielTypeOptions } from "./pb-generated";

// =============================================================================
// TYPES ENRICHIS
// =============================================================================

/**
 * Item de matériel événement enrichi
 * Hérite directement de EventMateriel (PbDoc + champs PB)
 */
export interface EnrichedEventMateriel extends EventMateriel {}

// =============================================================================
// FILTRES UI
// =============================================================================

export interface EventMaterielFilters {
  types?: EventMaterielTypeOptions[];
  statuses?: EventMaterielStatusOptions[];
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
  type: EventMaterielTypeOptions;
  status?: EventMaterielStatusOptions;
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
