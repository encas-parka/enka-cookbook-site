/**
 * @vitest-environment jsdom
 */

/**
 * EventTodoModal — création, édition en série et édition d'une tâche
 * (ADR 0004, W/V — item checklist §7 « Modification d'une tâche »).
 *
 * Seam : vraie modale montée en jsdom ; `eventsStore` est remplacé par des
 * espions — le contrat du composant est l'appel store (arguments exacts),
 * les toasts et la fermeture ; le write path du store est couvert par les
 * tests store (`events-store-*`).
 *
 * Contrats épinglés :
 *  - édition : le formulaire est prérempli de la tâche (échéance tronquée au
 *    jour, assignés rechargés) ; « Mettre à jour » appelle updateTodo avec
 *    les champs saisis (assignedTo vide → null), toast succès, fermeture
 *  - création : titre requis (warning, zéro write) ; « Créer la tâche »
 *    appelle addTodo avec le statut initial `todo` et referme
 *  - « Sauvegarder & Créer » : crée sans fermer, formulaire remis à zéro
 *  - onglet « Listes prédéfinies » : 10 tâches précochées sur 12 ; la
 *    validation envoie uniquement les cochées (aucune aprèsEvent décochée) ;
 *    tout décocher → avertissement, zéro write
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
import EventTodoModal from "../EventTodoModal.svelte";
import {
  modalDialog,
  expectModalClosed,
} from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";
import type { EventTodo } from "$lib/types/events";

const TEST_EVENT_ID = "event000000001";

function makeTodo(overrides: Partial<EventTodo> = {}): EventTodo {
  return {
    id: "todo000000001",
    taskName: "Acheter du pain",
    taskDescription: "Deux baguettes",
    dueDate: "2026-10-20T08:00:00.000Z",
    priority: "medium",
    status: "todo",
    taskOn: "beforeEvent",
    requiredPeopleNb: 2,
    assignedTo: ["user0000000001"],
    ...overrides,
  };
}

function mountModal(
  props: Partial<{
    todoToEdit: EventTodo | null;
    contributors: unknown[];
  }> = {},
) {
  const onClose = vi.fn();
  const holder = bindableProps({
    open: true,
    eventId: TEST_EVENT_ID,
    todoToEdit: props.todoToEdit ?? null,
    contributors: props.contributors ?? [],
    currentTodos: [],
    onClose,
  });
  // Le test attend que onClose ferme réellement la modale — le patron du
  // lot 3 : le handler du holder bascule la prop, sinon elle reste ouverte.
  const anyHolder = holder as unknown as {
    open: boolean;
    onClose: () => void;
  };
  anyHolder.onClose = () => {
    onClose();
    anyHolder.open = false;
  };
  const target = mountSvelte(EventTodoModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, holder };
}

function titleInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder^="Ex:"]',
  );
  if (!input) throw new Error("Champ titre introuvable");
  return input;
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  eventsStoreMock.updateTodo.mockClear();
  eventsStoreMock.addTodo.mockClear();
  eventsStoreMock.addTodos.mockClear();
});
afterEach(() => cleanupSvelte());

describe("EventTodoModal — édition", () => {
  it("préremplit le formulaire de la tâche (échéance au jour, assignés)", () => {
    const { target } = mountModal({ todoToEdit: makeTodo() });

    expect(titleInput(target).value).toBe("Acheter du pain");
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Deux baguettes",
    );
    expect(target.querySelector<HTMLSelectElement>("select")?.value).toBe(
      "beforeEvent",
    );
    expect(
      target.querySelector<HTMLInputElement>('input[type="number"]')?.value,
    ).toBe("2");
    expect(
      target.querySelector<HTMLInputElement>('input[type="date"]')?.value,
    ).toBe("2026-10-20");
    // Assigné courant rechargé : compteur 1/2, badge « Manque » (1 sur 2)
    expect(target.textContent).toContain("Assignation (1/2)");
    expect(target.textContent).toContain("Manque 1 pers.");
    // Pas d'onglets en édition
    expect(target.querySelector('[role="tablist"]')).toBeNull();
  });

  it("« Mettre à jour » appelle updateTodo avec les champs saisis, toast, fermeture", async () => {
    const todo = makeTodo();
    const { target } = mountModal({ todoToEdit: todo });

    setInputValue(titleInput(target), "Acheter du pain complet");
    getByText(target, "button", "Mettre à jour").click();

    // Fin de chaîne d'abord : la fermeture prouve la résolution du store
    await expectModalClosed(target, "la modale d'édition");
    expect(eventsStoreMock.updateTodo).toHaveBeenCalledTimes(1);
    expect(eventsStoreMock.updateTodo).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      todo.id,
      expect.objectContaining({
        taskName: "Acheter du pain complet",
        taskOn: "beforeEvent",
        requiredPeopleNb: 2,
        dueDate: new Date("2026-10-20").toISOString(),
      }),
    );
    expect(toastStub.success).toHaveBeenCalledWith("Tâche mise à jour");
  });
});

describe("EventTodoModal — création individuelle", () => {
  it("titre vide : avertissement et zéro write", () => {
    const { target } = mountModal();

    getByText(target, "button", "Créer la tâche").click();

    expect(toastStub.warning).toHaveBeenCalledWith(
      "Le titre de la tâche est requis",
    );
    expect(eventsStoreMock.addTodo).not.toHaveBeenCalled();
    expect(modalDialog(target)).not.toBeNull();
  });

  it("« Créer la tâche » appelle addTodo (statut initial todo) et referme", async () => {
    const { target } = mountModal();

    setInputValue(titleInput(target), "Préparer la salle");
    getByText(target, "button", "Créer la tâche").click();

    await expectModalClosed(target, "la modale de création");
    expect(eventsStoreMock.addTodo).toHaveBeenCalledTimes(1);
    expect(eventsStoreMock.addTodo).toHaveBeenCalledWith(
      TEST_EVENT_ID,
      expect.objectContaining({
        taskName: "Préparer la salle",
        taskOn: "onEvent",
        requiredPeopleNb: 1,
        status: "todo",
      }),
    );
    expect(toastStub.success).toHaveBeenCalledWith("Tâche créée");
  });

  it("« Sauvegarder & Créer » crée sans fermer et remet le formulaire à zéro", async () => {
    const { target } = mountModal();

    setInputValue(titleInput(target), "Tâche série 1");
    getByText(target, "button", "Sauvegarder & Créer").click();

    // Signal terminal d'abord (canon) : le toast prouve la fin de la chaîne
    await vi.waitFor(() => {
      expect(toastStub.success).toHaveBeenCalledWith("Tâche créée");
    });
    expect(eventsStoreMock.addTodo).toHaveBeenCalledTimes(1);
    expect(modalDialog(target)).not.toBeNull();
    expect(titleInput(target).value).toBe("");
  });
});

describe("EventTodoModal — listes prédéfinies", () => {
  function openBulkTab(target: HTMLElement): void {
    getByText(target, "button", "Listes prédéfinies").click();
    flushSync();
  }

  it("propose 10 tâches précochées sur 12 ; la validation n'envoie que les cochées", async () => {
    const { target } = mountModal();
    openBulkTab(target);

    expect(target.textContent).toContain("Avant l'événement (5/5)");
    expect(target.textContent).toContain("Pendant l'événement (5/5)");
    expect(target.textContent).toContain("Après l'événement (0/2)");

    // Décocher la première tâche « avant »
    const boxes = target.querySelectorAll<HTMLInputElement>(
      ".collapse-content .checkbox-primary",
    );
    expect(boxes).toHaveLength(12);
    boxes[0].click();
    flushSync();

    expect(target.textContent).toContain("Avant l'événement (4/5)");
    getByText(target, "button", "Créer les tâches sélectionnées").click();

    // Signal terminal d'abord (canon) : le toast prouve la fin de la chaîne
    await vi.waitFor(() => {
      expect(toastStub.success).toHaveBeenCalledWith("9 tâche(s) créée(s)");
    });
    expect(eventsStoreMock.addTodos).toHaveBeenCalledTimes(1);
    const created = eventsStoreMock.addTodos.mock.calls[0][1] as EventTodo[];
    expect(created).toHaveLength(9);
    expect(created.every((t) => t.status === "todo")).toBe(true);
    expect(created.some((t) => t.taskOn === "afterEvent")).toBe(false);
  });

  it("tout décocher : avertissement et zéro write", async () => {
    const { target } = mountModal();
    openBulkTab(target);

    const boxes = target.querySelectorAll<HTMLInputElement>(
      ".collapse-content .checkbox-primary",
    );
    for (const box of Array.from(boxes)) {
      if (box.checked) box.click();
    }
    flushSync();

    getByText(target, "button", "Créer les tâches sélectionnées").click();

    await vi.waitFor(() => {
      expect(toastStub.warning).toHaveBeenCalledWith(
        "Sélectionnez au moins une tâche",
      );
    });
    expect(eventsStoreMock.addTodos).not.toHaveBeenCalled();
  });
});
