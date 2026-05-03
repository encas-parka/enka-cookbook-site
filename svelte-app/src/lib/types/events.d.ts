/**
 * Types spécifiques pour la gestion des événements (collection 'events')
 *
 * Les champs contributors, meals, todos sont stockés en JSON dans PocketBase.
 * Les types ci-dessous décrivent les structures parsées côté client.
 */

import type { Main } from "./pb";
import type { EventsStatusOptions, EventTodosPriorityOptions, EventTodosStatusOptions, RecipesTypeROptions } from "./pb-generated";

// Re-export select types from pb-generated (single source of truth)
export type {
  EventTodosPriorityOptions as EventTodoPriority,
  EventTodosStatusOptions as EventTodoStatus,
} from "./pb-generated";

// EventTodoTaskOn: not a PB select field — kept as local type
export type EventTodoTaskOn = "beforeEvent" | "onEvent" | "afterEvent";

// =============================================================================
// EVENT STATUS (PB + client-side)
// =============================================================================

/**
 * Statut possible d'un événement
 * - "local" : Événement de démonstration en mode local (sans backend)
 * - Les autres statuts viennent de EventsStatusOptions (PB select field)
 */
export type EventStatus = EventsStatusOptions | "local";

// =============================================================================
// JSON STRUCTURES — parsed from PocketBase JSON fields
// =============================================================================

/** Contributeur d'événement (stocké dans contributors JSON) */
export interface EventContributor {
  id: string;
  email?: string;
  name?: string;
  status: "invited" | "accepted" | "declined";
  invitedAt: string;
  respondedAt?: string;
  teamId?: string;
  isKTeamMember?: boolean;
}

/** Repas dans un événement (stocké dans meals JSON) */
export interface EventMeal {
  id?: string; // UUID pour le tracking UI
  date: string; // DateTime ISO 8601 complet
  guests: number;
  recipes: EventMealRecipe[];
}

/** Recette dans un repas d'événement */
export interface EventMealRecipe {
  recipeUuid: string;
  plates: number;
  typeR: RecipesTypeROptions;
  hasOwnPlatesNb?: boolean;
  locked?: boolean;
}

/** Todo embarqué dans l'événement (ancien format JSON, avant collection event_todos) */
export interface EventTodo {
  id: string;
  taskName: string;
  taskDescription: string | null;
  dueDate: string | null;
  priority: EventTodosPriorityOptions | null;
  status: EventTodosStatusOptions | null;
  taskOn: EventTodoTaskOn | null;
  requiredPeopleNb: number;
  assignedTo: string[] | null;
}

// =============================================================================
// TYPES ENRICHIS
// =============================================================================

/** Événement enrichi avec les données JSON parsées */
export interface EnrichedEvent extends Omit<
  Main,
  "meals" | "contributors" | "todos" | "status"
> {
  meals: EventMeal[];
  contributors: EventContributor[];
  todos: EventTodo[];
  teams?: string[];
  teamsId?: string[];
  status: EventStatus;
}

// =============================================================================
// CRÉATION / UPDATE
// =============================================================================

/** Données pour créer un événement */
export interface CreateEventData {
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  allDates?: string[];
  meals?: EventMeal[];
  teams?: string[];
  teamsId?: string[];
  contributors?: EventContributor[];
  todos?: EventTodo[];
  status?: EventStatus;
}

/** Données pour mettre à jour un événement */
export interface UpdateEventData {
  updated?: Date;
  name?: string;
  description?: string;
  minContrib?: number;
  dateStart?: string;
  dateEnd?: string;
  allDates?: string[];
  meals?: EventMeal[];
  teams?: string[];
  teamsId?: string[];
  contributors?: EventContributor[];
  guestEmails?: string[];
  todos?: EventTodo[];
  status?: EventStatus;
}
