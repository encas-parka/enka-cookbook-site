import { nanoid } from "nanoid";
import { safeJsonArrayParse } from "./safe-operation";
import type {
  EventMeal,
  EventContributor,
  EnrichedEvent,
} from "../types/events.d";

/**
 * Parse les meals d'un événement.
 *
 * Compatible Appwrite (string[] de JSON) et PocketBase (objets natifs).
 * Avec PocketBase, les champs JSON arrivent déjà parsés en objets.
 */
export function parseEventMeals(
  raw: (string | EventMeal)[] | null | undefined,
): EventMeal[] {
  if (!raw || !Array.isArray(raw)) return [];

  // PocketBase native JSON: already objects, no parsing needed
  if (raw.length > 0 && typeof raw[0] !== "string") {
    return raw as EventMeal[];
  }

  // Legacy Appwrite: JSON strings
  return safeJsonArrayParse(raw as string[], {
    context: "parseEventMeals",
    itemFallback: (mealStr, index) => {
      console.warn(
        `[parseEventMeals] Meal ${index} invalide, utilisation d'un fallback`,
        mealStr,
      );
      return {
        id: `unknown-${index}`,
        name: "Repas inconnu",
        date: new Date().toISOString(),
        guests: 1,
        recipes: [],
      };
    },
  });
}

/**
 * Parse les contributeurs d'un événement.
 *
 * Compatible Appwrite (string[] de JSON) et PocketBase (objets natifs).
 */
export function parseEventContributors(
  raw: (string | EventContributor)[] | null | undefined,
): EventContributor[] {
  if (!raw || !Array.isArray(raw)) return [];

  // PocketBase native JSON: already objects, no parsing needed
  if (raw.length > 0 && typeof raw[0] !== "string") {
    return raw as EventContributor[];
  }

  // Legacy Appwrite: JSON strings
  return safeJsonArrayParse(raw as string[], {
    context: "parseEventContributors",
    itemFallback: (contributorStr, index) => {
      console.warn(
        `[parseEventContributors] Contributor ${index} invalide, utilisation d'un fallback`,
        contributorStr,
      );
      return {
        id:
          typeof contributorStr === "string"
            ? contributorStr
            : `unknown-${index}`,
        status: "accepted" as const,
        invitedAt: new Date().toISOString(),
      };
    },
  });
}

import type { EventTodo } from "../types/events.d";

/**
 * Parse les todos d'un événement.
 *
 * Compatible Appwrite (string[] de JSON) et PocketBase (objets natifs).
 */
export function parseEventTodos(
  raw: (string | EventTodo)[] | null | undefined,
): EventTodo[] {
  if (!raw || !Array.isArray(raw)) return [];

  // PocketBase native JSON: already objects, no parsing needed
  if (raw.length > 0 && typeof raw[0] !== "string") {
    return raw as EventTodo[];
  }

  // Legacy Appwrite: JSON strings
  return safeJsonArrayParse(raw as string[], {
    context: "parseEventTodos",
    itemFallback: (todoStr, index) => {
      console.warn(
        `[parseEventTodos] Todo ${index} invalide, utilisation d'un fallback`,
        todoStr,
      );
      return {
        id: `unknown-${index}`,
        taskName: "Tâche invalide",
        taskDescription: null,
        dueDate: null,
        priority: null,
        status: null,
        taskOn: null,
        requiredPeopleNb: 1,
        assignedTo: null,
      };
    },
  });
}

/**
 * Liste unique et triée des dates d'un événement.
 *
 * Source de vérité : le champ JSON `date` (peuplé à l'écriture, dérivé des repas).
 * Retombe sur les dates des repas pour les records antérieurs où `date` est vide.
 * Sert à la fois côté lecture (affichage) et côté écriture (peuplement de `date`).
 */
export function getEventDates(event: {
  date?: unknown | null;
  meals?: Pick<EventMeal, "date">[] | null;
}): string[] {
  const stored = Array.isArray(event.date) ? event.date : [];
  const dates =
    stored.length > 0
      ? stored
      : (event.meals ?? []).map((m) => m.date).filter(Boolean);
  return [...new Set(dates)].sort();
}
