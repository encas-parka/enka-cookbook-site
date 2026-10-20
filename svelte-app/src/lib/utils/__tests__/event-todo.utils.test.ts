import { describe, it, expect } from "vitest";
import {
  parseEventTodoPriority,
  PRIORITY_ORDER,
  formatPriority,
  isTodoCompleted,
  isTodoOverdue,
  calculateCompletionPercentage,
} from "../event-todo.utils";
import type { EventTodo } from "$lib/types/events";

// Les valeurs runtime des enums PB sont la source de vérité côté client
// (events.todos est un JSON écrit par le client — cf. types/events.d.ts).
// Ce fichier charge le module au top-level : si les enums sont importés
// comme types au lieu de valeurs, PRIORITY_ORDER explose à l'import.
import {
  EventTodosPriorityOptions,
  EventTodosStatusOptions,
} from "$lib/types/pb-generated";

function makeTodo(overrides: Partial<EventTodo> = {}): EventTodo {
  return {
    id: "t1",
    taskName: "Une tâche",
    taskDescription: null,
    dueDate: null,
    priority: null,
    status: null,
    taskOn: null,
    requiredPeopleNb: 0,
    assignedTo: null,
    ...overrides,
  };
}

describe("event-todo.utils — valeurs runtime des enums", () => {
  it("expose les valeurs PB attendues (shape JSON écrit par le client)", () => {
    expect(EventTodosPriorityOptions).toEqual({
      low: "low",
      medium: "medium",
      high: "high",
    });
    expect(EventTodosStatusOptions.done).toBe("done");
  });
});

describe("parseEventTodoPriority", () => {
  it("accepte les priorités valides", () => {
    expect(parseEventTodoPriority("high")).toBe("high");
    expect(parseEventTodoPriority("medium")).toBe("medium");
    expect(parseEventTodoPriority("low")).toBe("low");
  });

  it("retombe sur medium pour une valeur inconnue ou absente", () => {
    expect(parseEventTodoPriority("urgent")).toBe("medium");
    expect(parseEventTodoPriority(undefined)).toBe("medium");
  });
});

describe("PRIORITY_ORDER", () => {
  it("classe high > medium > low", () => {
    expect(PRIORITY_ORDER["high"]).toBeGreaterThan(PRIORITY_ORDER["medium"]);
    expect(PRIORITY_ORDER["medium"]).toBeGreaterThan(PRIORITY_ORDER["low"]);
  });
});

describe("formatPriority", () => {
  it("traduit les priorités en libellés français", () => {
    expect(formatPriority("high")).toBe("Haute");
    expect(formatPriority("medium")).toBe("Moyenne");
    expect(formatPriority("low")).toBe("Basse");
  });
});

describe("isTodoCompleted / isTodoOverdue", () => {
  it("détecte un todo terminé via le statut done", () => {
    expect(isTodoCompleted(makeTodo({ status: "done" }))).toBe(true);
    expect(isTodoCompleted(makeTodo({ status: "todo" }))).toBe(false);
  });

  it("détecte un todo en retard (dueDate passée, non terminé)", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isTodoOverdue(makeTodo({ dueDate: past, status: "todo" }))).toBe(
      true,
    );
    expect(isTodoOverdue(makeTodo({ dueDate: future, status: "todo" }))).toBe(
      false,
    );
  });

  it("ignore les retards pour un todo terminé ou sans échéance", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isTodoOverdue(makeTodo({ dueDate: past, status: "done" }))).toBe(
      false,
    );
    expect(isTodoOverdue(makeTodo({ dueDate: null, status: "todo" }))).toBe(
      false,
    );
  });
});

describe("calculateCompletionPercentage", () => {
  it("retourne 0 pour une liste vide", () => {
    expect(calculateCompletionPercentage([])).toBe(0);
  });

  it("calcule le pourcentage de todos terminés", () => {
    const todos = [
      makeTodo({ id: "a", status: "done" }),
      makeTodo({ id: "b", status: "done" }),
      makeTodo({ id: "c", status: "todo" }),
    ];
    expect(calculateCompletionPercentage(todos)).toBe(67);
  });
});
