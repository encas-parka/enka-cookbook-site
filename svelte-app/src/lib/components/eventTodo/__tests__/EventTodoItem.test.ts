/**
 * @vitest-environment jsdom
 */

/**
 * EventTodoItem — la ligne d'une tâche (ADR 0004, W/D).
 *
 * Seam : vrai composant monté en jsdom ; `eventsStore` remplacé par des
 * espions (le write path store est couvert par les tests store) ;
 * `globalState` fixe l'utilisateur courant.
 *
 * Contrats épinglés :
 *  - affichage : titre, moment, assignés (« Moi » pour l'utilisateur courant,
 *    noms des contributeurs), compteur N/M pers., « Non assigné »
 *  - tâche faite : titre barré ; assez d'assignés : ombre succès
 *  - bascule de statut (tâches « avant » seulement) : updateTodo status done
 *  - volontariat : « M'inscrire » ajoute l'utilisateur (assignedTo),
 *    « me désinscrire » le retire (assignedTo null quand il était seul)
 *  - bouton d'édition : onEdit(todo)
 */

const eventsStoreMock = vi.hoisted(() => ({
  updateTodo: vi.fn(() => Promise.resolve()),
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
import EventTodoItem from "../EventTodoItem.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import type { EventTodo, EventContributor } from "$lib/types/events";

const TEST_EVENT_ID = "event000000001";
const MARION: EventContributor = {
  id: "user0000000002",
  name: "Marion",
} as EventContributor;

function makeTodo(overrides: Partial<EventTodo> = {}): EventTodo {
  return {
    id: "todo000000001",
    taskName: "Préparer la salle",
    taskDescription: null,
    dueDate: null,
    priority: "medium",
    status: "todo",
    taskOn: "beforeEvent",
    requiredPeopleNb: 2,
    assignedTo: null,
    ...overrides,
  };
}

function mountItem(
  todoOverrides: Partial<EventTodo> = {},
  extra: Record<string, unknown> = {},
) {
  // Fixture réactive ($state) : le mock d'updateTodo applique les updates sur
  // la tâche, comme le ferait le store réel (écriture optimiste) — sinon les
  // dérivés (`isAssigned`) restent figés et le toast d'assignation est faux.
  const holder = bindableProps({ todo: makeTodo(todoOverrides) });
  const todo = (holder as { todo: EventTodo }).todo;
  eventsStoreMock.updateTodo.mockImplementation(
    async (_eventId: string, _id: string, updates: Partial<EventTodo>) => {
      Object.assign(todo, updates);
    },
  );
  const onEdit = vi.fn();
  const target = mountSvelte(EventTodoItem, {
    todo,
    eventId: TEST_EVENT_ID,
    onEdit,
    contributors: [MARION],
    ...extra,
  });
  return { target, onEdit };
}

function buttonByTitle(target: HTMLElement, title: string): HTMLButtonElement {
  const button = target.querySelector<HTMLButtonElement>(
    `button[title="${title}"]`,
  );
  if (!button) throw new Error(`Bouton « ${title} » introuvable`);
  return button;
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  eventsStoreMock.updateTodo.mockClear();
});
afterEach(() => cleanupSvelte());

describe("EventTodoItem — affichage dérivé", () => {
  it("rend le titre, le moment et les assignés (« Moi » distingué)", () => {
    const { target } = mountItem({
      taskOn: "onEvent",
      assignedTo: ["user0000000001", "user0000000002"],
    });

    expect(target.textContent).toContain("Préparer la salle");
    expect(target.textContent).toContain("Pendant l'événement");
    expect(target.textContent).toContain("Moi");
    expect(target.textContent).toContain("Marion");
    expect(target.textContent).toContain("2/2 pers. requise");
  });

  it("sans assigné : « Non assigné » et compteur en avertissement", () => {
    const { target } = mountItem({ assignedTo: null });

    expect(target.textContent).toContain("Non assigné");
    expect(target.textContent).toContain("0/2 pers. requise");
    expect(target.querySelector(".text-warning")).not.toBeNull();
  });

  it("tâche faite : titre barré ; assez d'assignés : ombre succès", () => {
    const { target } = mountItem({
      status: "done",
      assignedTo: ["user0000000001", "user0000000002"],
    });

    expect(target.querySelector(".line-through")).not.toBeNull();
    expect(target.firstElementChild?.className).toContain("shadow-success/40");
  });
});

describe("EventTodoItem — écritures", () => {
  it("bascule le statut d'une tâche « avant » (updateTodo status done)", async () => {
    const { target } = mountItem({ taskOn: "beforeEvent" });

    buttonByTitle(target, "Marquer fait").click();
    await vi.waitFor(() => {
      expect(eventsStoreMock.updateTodo).toHaveBeenCalledWith(
        TEST_EVENT_ID,
        "todo000000001",
        { status: "done" },
      );
    });
  });

  it("les tâches « pendant » n'ont pas de bascule de statut", () => {
    const { target } = mountItem({ taskOn: "onEvent" });

    expect(queryByText(target, "button", "Fait ?")).toBeNull();
    expect(eventsStoreMock.updateTodo).not.toHaveBeenCalled();
  });

  it("« M'inscrire » ajoute l'utilisateur courant à assignedTo", async () => {
    const { target } = mountItem({ assignedTo: null });

    buttonByTitle(target, "Me porter volontaire pour cette tâche").click();
    await vi.waitFor(() => {
      expect(toastStub.success).toHaveBeenCalledWith(
        "Vous avez rejoint la tâche",
      );
    });
    expect(eventsStoreMock.updateTodo).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      "todo000000001",
      { assignedTo: ["user0000000001"] },
    );
  });

  it("« me désinscrire » retire l'utilisateur (null quand il était seul)", async () => {
    const { target } = mountItem({ assignedTo: ["user0000000001"] });

    buttonByTitle(target, "Quitter cette tâche").click();
    await vi.waitFor(() => {
      expect(toastStub.success).toHaveBeenCalledWith(
        "Vous avez quitté la tâche",
      );
    });
    expect(eventsStoreMock.updateTodo).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      "todo000000001",
      { assignedTo: null },
    );
  });

  it("le bouton d'édition remonte la tâche au parent", () => {
    const { target, onEdit } = mountItem();

    buttonByTitle(target, "Modifier la tâche").click();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({
      id: "todo000000001",
      taskName: "Préparer la salle",
    });
  });

  it("désactivé : la bascule de statut est neutralisée", () => {
    const { target } = mountItem({ taskOn: "beforeEvent" }, { disabled: true });

    expect(buttonByTitle(target, "Marquer fait").disabled).toBe(true);
    expect(eventsStoreMock.updateTodo).not.toHaveBeenCalled();
  });
});
