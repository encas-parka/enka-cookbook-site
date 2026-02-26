/**
 * Types spécifiques pour la gestion des événements (collection 'main')
 * Ces types correspondent aux structures stockées sous forme de JSON stringified dans Appwrite.
 */

/**
 * Statut possible d'un événement
 *
 * - "local" : Événement de démonstration en mode local (sans Appwrite)
 * - "proposition" : Événement en cours de création
 * - "confirmed" : Événement confirmé
 * - "canceled" : Événement annulé
 * - "archive" : Événement archivé
 * - "locked" : Événement verrouillé
 */
export type EventStatus =
  | "local"
  | "proposition"
  | "confirmed"
  | "canceled"
  | "archive"
  | "locked";

/**
 * Information sur un contributeur d'événement
 * Stocké dans le champ 'contributors' (string[]) sous forme de JSON stringified
 */
export interface EventContributor {
  id: string;
  email?: string; // Optionnel car peut être un ID utilisateur
  name?: string;
  status: "invited" | "accepted" | "declined";
  invitedAt: string;
  respondedAt?: string;
  teamId?: string; // Si l'invitation provient d'une équipe
  isKTeamMember?: boolean;
}

/**
 * Repas dans un événement
 * Stocké dans le champ 'meals' (string) sous forme de JSON stringified (EventMeal[])
 */
export interface EventMeal {
  id?: string; // UUID pour le tracking UI
  date: string; // DateTime ISO 8601 complet
  guests: number;
  recipes: EventMealRecipe[];
}

/**
 * Recette dans un repas d'événement
 */
/**
 * Recette dans un repas d'événement
 */
import { type RecettesTypeR } from "./recipes.types";

export interface EventMealRecipe {
  recipeUuid: string;
  plates: number; // Nombre de couverts
  typeR: RecettesTypeR;
  hasOwnPlatesNb?: boolean; // Si true, ne pas auto-sync avec meal.guests
  locked?: boolean; // Verrouillage manuel si besoin
}

import type { Main } from "./appwrite.d";

export enum EventTodoPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum EventTodoStatus {
  TODO = "todo",
  DONE = "done",
  WAITING = "waiting",
  CANCELED = "canceled",
  INPROGRESS = "inprogress",
}

export enum EventTodoTaskOn {
  BEFORE_EVENT = "beforeEvent",
  ON_EVENT = "onEvent",
  AFTER_EVENT = "afterEvent",
}

export interface EventTodo {
  id: string; // Identifiant unique (UUID généré client)
  taskName: string;
  taskDescription: string | null;
  dueDate: string | null;
  priority: EventTodoPriority | null;
  status: EventTodoStatus | null; // Par défaut TODO
  taskOn: EventTodoTaskOn | null;
  requiredPeopleNb: number;
  assignedTo: string[] | null; // IDs des utilisateurs
}

/**
 * Événement enrichi avec les données parsées
 * Utilisé dans le store et l'UI
 */
export interface EnrichedEvent extends Omit<
  Main,
  "meals" | "contributors" | "todos" | "status"
> {
  meals: EventMeal[];
  contributors: EventContributor[];
  todos: EventTodo[];
  teams?: string[]; // Noms des équipes (pour affichage)
  teamsId?: string[]; // IDs des équipes (pour filtrage)
  status: EventStatus; // Surcharge pour permettre "local"
}

/**
 * Données pour créer un événement
 */
export interface CreateEventData {
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  allDates?: string[]; // Tableau de toutes les dates uniques des repas
  meals?: EventMeal[];
  teams?: string[]; // Noms des équipes (pour affichage)
  teamsId?: string[]; // IDs des équipes (pour filtrage)
  contributors?: EventContributor[]; // Tableau d'objets EventContributor
  todos?: EventTodo[];
  status?: EventStatus;
}

/**
 * Données pour mettre à jour un événement
 */
export interface UpdateEventData {
  $updatedAt?: Date;
  name?: string;
  dateStart?: string;
  dateEnd?: string;
  allDates?: string[]; // Tableau de toutes les dates uniques des repas
  meals?: EventMeal[];
  teams?: string[]; // Noms des équipes (pour affichage)
  teamsId?: string[]; // IDs des équipes (pour filtrage)
  contributors?: EventContributor[]; // Tableau d'objets EventContributor
  todos?: EventTodo[];
  status?: EventStatus;
}
