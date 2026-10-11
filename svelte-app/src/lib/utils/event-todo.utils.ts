/**
 * Utilitaires pour EventTodo
 * Parsing et validation des priorités
 *
 * ÉTAT (documenté 08-10, décision C3 reportée) : ce module n'a plus
 * d'importeur — la page Tâches lit/écrit le champ JSON `events.todos`
 * (embedded), pas la collection `event_todos`. Celle-ci reste en base
 * DORMANTE (17 records d'archive migrés : 2 standalone Appwrite + 15
 * extraits des events) : son schéma relationnel (`assignedTo`) offre une
 * granularité par-tâche que le JSON embedded n'a pas — la conserver
 * facilite une migration vers une collection dédiée si le produit la veut
 * (permissions par todo). Ne pas supprimer sans trancher C3.
 * Contexte : .agents/plans/6_migration-evaluation.md § 5.
 */

import type { EventTodo, EventTodoPriority, EventTodoStatus } from "$lib/types/events";
// Valeurs runtime : les enums PB sont générés en `const` dans pb-generated
// (events.d.ts n'expose que les types — pas de module runtime).
import {
  EventTodosPriorityOptions,
  EventTodosStatusOptions,
} from "$lib/types/pb-generated";

/**
 * Parse et valide la priorité d'un todo
 * @param priority - La priorité à valider
 * @returns La priorité validée ou "medium" par défaut
 */
export function parseEventTodoPriority(
  priority: string | undefined,
): EventTodoPriority {
  const validPriorities: EventTodoPriority[] = [
    EventTodosPriorityOptions.high,
    EventTodosPriorityOptions.medium,
    EventTodosPriorityOptions.low,
  ];

  if (priority && validPriorities.includes(priority as EventTodoPriority)) {
    return priority as EventTodoPriority;
  }

  console.warn(
    `[event-todo.utils] Priority invalide: ${priority}, utilisation de "medium"`,
  );
  return EventTodosPriorityOptions.medium; // Valeur par défaut
}

/**
 * Ordre de tri pour les priorités (utilisé dans le store)
 */
export const PRIORITY_ORDER: Record<EventTodoPriority, number> = {
  [EventTodosPriorityOptions.high]: 3,
  [EventTodosPriorityOptions.medium]: 2,
  [EventTodosPriorityOptions.low]: 1,
};

/**
 * Formate le nom de la priorité pour l'affichage
 */
export function formatPriority(priority: EventTodoPriority): string {
  const labels: Record<EventTodoPriority, string> = {
    [EventTodosPriorityOptions.high]: "Haute",
    [EventTodosPriorityOptions.medium]: "Moyenne",
    [EventTodosPriorityOptions.low]: "Basse",
  };

  return labels[priority] || priority;
}

/**
 * Vérifie si un todo est complété
 */
export function isTodoCompleted(todo: EventTodo): boolean {
  return todo.status === EventTodosStatusOptions.done;
}

/**
 * Vérifie si un todo est en retard
 */
export function isTodoOverdue(todo: EventTodo): boolean {
  if (!todo.dueDate || todo.status === EventTodosStatusOptions.done) {
    return false;
  }

  return new Date(todo.dueDate) < new Date();
}

/**
 * Calcule le pourcentage de complétion d'une liste de todos
 */
export function calculateCompletionPercentage(todos: EventTodo[]): number {
  if (todos.length === 0) return 0;

  const completed = todos.filter(isTodoCompleted).length;
  return Math.round((completed / todos.length) * 100);
}
