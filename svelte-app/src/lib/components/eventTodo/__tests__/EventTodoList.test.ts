/**
 * @vitest-environment jsdom
 */

/**
 * EventTodoList — la vue tâches groupée par moment (ADR 0004, D + wiring).
 *
 * Seam : vraie liste (avec ses enfants EventTodoItem et EventTodoModal)
 * montée en jsdom sur un event fixture ; `eventsStore` est remplacé par des
 * espions — la liste tire son état de `event.todos` (props), le store ne
 * sert qu'aux écritures des enfants.
 *
 * Contrats épinglés :
 *  - vide : zone d'appel « Aucune tâche » qui ouvre la modale de création
 *  - groupement par moment (colonnes « Avant / Pendant / Après » avec compte)
 *  - tri dans un groupe par échéance croissante (sans échéance en dernier)
 *  - « Nouvelle tâche » ouvre la modale en création ; le crayon d'un item
 *    l'ouvre en édition préremplie
 *  - fil onTodosChange mort aujourd'hui : EventTodoModal ne rappelle jamais
 *    onSave — comportement actuel épinglé (la propagation passe par le store)
 */

const eventsStoreMock = vi.hoisted(() => ({
  updateTodo: vi.fn(() => Promise.resolve()),
  addTodo: vi.fn(() => Promise.resolve()),
  addTodos: vi.fn(() => Promise.resolve()),
}));

vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: eventsStoreMock,
}));

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userId: "user0000000001",
    userName: "Test",
    isAuthenticated: true,
    isMobile: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import EventTodoList from "../EventTodoList.svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";
import {
  makeEvent,
  makeEventTodo,
} from "$lib/stores/__tests__/harness/fixtures";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import type { EventTodo } from "$lib/types/events";

const TEST_EVENT_ID = "event000000001";

function mountList(todos: EventTodo[], extra: Record<string, unknown> = {}) {
  const onTodosChange = vi.fn();
  const target = mountSvelte(EventTodoList, {
    event: makeEvent({ id: TEST_EVENT_ID, todos }),
    contributors: [],
    onTodosChange,
    ...extra,
  });
  return { target, onTodosChange };
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  eventsStoreMock.updateTodo.mockClear();
  eventsStoreMock.addTodo.mockClear();
  eventsStoreMock.addTodos.mockClear();
});
afterEach(() => cleanupSvelte());

describe("EventTodoList — groupement", () => {
  it("vide : zone d'appel qui ouvre la modale de création", async () => {
    const { target } = mountList([]);

    expect(target.textContent).toContain("Aucune tâche pour le moment.");
    getByText(target, "span", "Créer la première tâche +").click();

    await waitForCondition(
      () => modalDialog(target) !== null,
      "la modale de création s'ouvre",
      100,
      flushSync,
    );
    expect(modalDialog(target)?.textContent).toContain("Nouvelle Tâche");
  });

  it("une colonne par moment présent, avec compte", () => {
    const { target } = mountList([
      makeEventTodo({
        id: "todo-a",
        taskName: "Courses",
        taskOn: "beforeEvent",
      }),
      makeEventTodo({ id: "todo-b", taskName: "Service", taskOn: "onEvent" }),
      makeEventTodo({ id: "todo-c", taskName: "Vaisselle", taskOn: "onEvent" }),
      makeEventTodo({
        id: "todo-d",
        taskName: "Retour matos",
        taskOn: "afterEvent",
      }),
    ]);

    expect(target.textContent).toContain("Avant l'événement (1)");
    expect(target.textContent).toContain("Pendant l'événement (2)");
    expect(target.textContent).toContain("Après l'événement (1)");
    expect(target.textContent).toContain("Courses");
    expect(target.textContent).toContain("Vaisselle");
  });

  it("dans un groupe, les échéances passent avant (croissant), sans échéance en dernier", () => {
    const { target } = mountList([
      makeEventTodo({ id: "todo-1", taskName: "Sans date", taskOn: "onEvent" }),
      makeEventTodo({
        id: "todo-2",
        taskName: "Tard",
        taskOn: "onEvent",
        dueDate: "2026-10-30T08:00:00.000Z",
      }),
      makeEventTodo({
        id: "todo-3",
        taskName: "Tôt",
        taskOn: "onEvent",
        dueDate: "2026-10-20T08:00:00.000Z",
      }),
    ]);

    const columnText = target.textContent ?? "";
    expect(columnText.indexOf("Tôt")).toBeLessThan(columnText.indexOf("Tard"));
    expect(columnText.indexOf("Tard")).toBeLessThan(
      columnText.indexOf("Sans date"),
    );
  });
});

describe("EventTodoList — wiring modale", () => {
  it("« Nouvelle tâche » ouvre la modale en création", async () => {
    const { target } = mountList([]);

    getByText(target, "button", "Nouvelle tâche").click();
    await waitForCondition(
      () => modalDialog(target) !== null,
      "la modale s'ouvre",
      100,
      flushSync,
    );
    expect(modalDialog(target)?.textContent).toContain("Nouvelle Tâche");
  });

  it("le crayon d'un item ouvre la modale en édition préremplie", async () => {
    const { target } = mountList([
      makeEventTodo({ id: "todo-edit", taskName: "Courses" }),
    ]);

    target
      .querySelector<HTMLButtonElement>('button[title="Modifier la tâche"]')
      ?.click();
    await waitForCondition(
      () => modalDialog(target) !== null,
      "la modale d'édition s'ouvre",
      100,
      flushSync,
    );

    expect(modalDialog(target)?.textContent).toContain("Modifier la Tâche");
    await waitForCondition(
      () =>
        modalDialog(target)?.querySelector<HTMLInputElement>("input")?.value ===
        "Courses",
      "le titre est prérempli",
      100,
      flushSync,
    );
  });

  it("après sauvegarde, onTodosChange n'est pas rappelée (fil mort épinglé)", async () => {
    const { target, onTodosChange } = mountList([
      makeEventTodo({ id: "todo-edit", taskName: "Courses" }),
    ]);

    target
      .querySelector<HTMLButtonElement>('button[title="Modifier la tâche"]')
      ?.click();
    await waitForCondition(
      () => modalDialog(target) !== null,
      "la modale d'édition s'ouvre",
      100,
      flushSync,
    );

    getByText(target, "button", "Mettre à jour").click();
    await vi.waitFor(() => {
      expect(eventsStoreMock.updateTodo).toHaveBeenCalledTimes(1);
    });

    expect(onTodosChange).not.toHaveBeenCalled();
  });
});
