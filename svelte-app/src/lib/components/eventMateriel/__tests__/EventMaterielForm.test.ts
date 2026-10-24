/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielForm — validation, remontées $bindable et garde
 * « lié à une réservation » (ADR 0004).
 *
 * Seam : vrai composant monté en jsdom. Le formulaire ne possède pas
 * l'écriture (onSubmit est un callback du parent) : les scénarios
 * d'écriture via store vivent dans EventMaterielModal.test.ts. Ici on
 * épingle :
 *  - la validation (nom, type, quantité, source qui/où dès que le statut
 *    n'est plus « à trouver ») : erreurs toastées, submit bloqué,
 *    `errors` remonté au parent
 *  - le payload soumis : champs trimmés, who/where/notes vides → null
 *  - `dirty` $bindable : toute divergence avec les valeurs d'ouverture
 *  - la garde isLoanLinked : nom/quantité/type/statut gérés par la
 *    réservation → champs désactivés, bascule vers l'édition de l'emprunt
 *  - le mode header (besoin) : pas de statut ni de source
 *  - en édition d'allocation : « à trouver » n'est pas proposé (une
 *    allocation est toujours à vérifier ou confirmée)
 *  - la suggestion d'un besoin existant bascule vers l'édition via
 *    onExistingSelected (le parent décide, le nom n'est pas écrasé)
 *
 * Contrainte jsdom : les réassignations $bindable (errors notamment) se
 * font dans le handler de submit — les scénarios de saisie + submit
 * repartent d'un montage frais (une interaction décisionnelle par
 * montage, ADR 0004).
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "testuser12345678",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("$lib/stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForTick } from "$lib/stores/__tests__/harness/wait-for-tick";
import {
  makeEventMaterielRecord,
  TEST_EVENT_ID,
  TEST_LOAN_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
import EventMaterielForm from "../EventMaterielForm.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  setSelectValue,
  getByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

/** Reset complet : transport, mocks, store singleton et Dexie. */
async function resetState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  toastStub.reset();
  await eventMaterielStore.destroy();
  await clearDexie();
}

/** Seed un besoin existant et initialise le store pour l'event test. */
async function seedHeader() {
  currentFakePb().seed("event_materiel", [
    makeEventMaterielRecord({ name: "Table Pliante Bois", quantity: 3 }),
  ]);
  await eventMaterielStore.initializeForEvent(TEST_EVENT_ID);
  await waitForTick(5);
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function quantityInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="number"]');
  if (!input) throw new Error("Champ quantité introuvable");
  return input;
}

/** Le select type est celui qui porte l'option vide « Sélectionner ». */
function typeSelect(target: HTMLElement): HTMLSelectElement {
  const select = [...target.querySelectorAll("select")].find((s) =>
    s.textContent?.includes("Sélectionner"),
  );
  if (!select) throw new Error("Select type introuvable");
  return select;
}

/** Le select statut est celui qui porte les statuts « À trouver/À vérifier ». */
function statusSelect(target: HTMLElement): HTMLSelectElement {
  const select = [...target.querySelectorAll("select")].find((s) =>
    s.textContent?.includes("À vérifier"),
  );
  if (!select) throw new Error("Select statut introuvable");
  return select;
}

function whereInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder="Lieu de stockage"]',
  );
  if (!input) throw new Error("Champ où introuvable");
  return input;
}

/** Monte le formulaire avec les remontées $bindable traçables. */
function mountForm(props: Partial<Record<string, unknown>> = {}): {
  target: HTMLElement;
  onSubmit: ReturnType<typeof vi.fn>;
} {
  const onSubmit = vi.fn(async () => {});
  const holder = bindableProps({
    eventId: TEST_EVENT_ID,
    onSubmit,
    onCancel: () => {},
    submitting: false,
    errors: [] as string[],
    dirty: false,
    ...props,
  });
  const target = mountSvelte(EventMaterielForm, holder as never);
  return { target, onSubmit };
}

describe("EventMaterielForm — validation (création)", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  /**
   * Canal composant : dispatch direct du submit, sans passer par la
   * validation des contraintes HTML. Mesuré en jsdom 30 (et identique au
   * navigateur réel) : `requestSubmit` bloque sur `required`/`min` AVANT
   * d'atteindre le handler — les contraintes natives jouent le premier
   * rideau, la validation du composant le second.
   */
  function submitJs(target: HTMLElement): void {
    target
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    flushSync();
  }

  it("le submit à vide est bloqué par les contraintes natives : le handler n'est pas atteint", async () => {
    const { target, onSubmit } = mountForm({ mode: "item" });

    // Canal navigateur réel : l'input nom (required) vide intercepte
    target.querySelector("form")!.requestSubmit();
    flushSync();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastStub.error).not.toHaveBeenCalled();
  });

  it("la validation du composant toast nom + type manquants (canal submit direct)", async () => {
    const { target, onSubmit } = mountForm({ mode: "item" });

    submitJs(target);

    expect(onSubmit).not.toHaveBeenCalled();
    // À vide en création : nom + type requis (statut « à trouver » ne
    // demande pas encore de source)
    expect(toastStub.error).toHaveBeenCalledTimes(2);
    expect(toastStub.error).toHaveBeenCalledWith("Le nom est requis.");
    expect(toastStub.error).toHaveBeenCalledWith("Le type est requis.");
  });

  it("le statut « à vérifier » exige une source (qui ou où) avant le submit", async () => {
    const { target, onSubmit } = mountForm({ mode: "item" });
    setInputValue(nameInput(target), "Percolateur");
    setSelectValue(typeSelect(target), "electronic");
    setSelectValue(statusSelect(target), "to_check");

    // Contraintes natives satisfaites (nom non vide, quantité ≥ 1) :
    // requestSubmit atteint le handler, qui bloque sur la source manquante
    target.querySelector("form")!.requestSubmit();
    flushSync();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastStub.error).toHaveBeenCalledWith(
      "Indiquez qui apporte le matériel ou d'où il vient.",
    );
  });

  it("le lieu seul suffit comme source et le payload est trimmé, les champs vides à null", async () => {
    const { target, onSubmit } = mountForm({ mode: "item" });
    setInputValue(nameInput(target), "  Percolateur  ");
    setSelectValue(typeSelect(target), "electronic");
    setSelectValue(statusSelect(target), "to_check");
    setInputValue(whereInput(target), "  Réserve cuisson  ");

    target.querySelector("form")!.requestSubmit();
    flushSync();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      eventId: TEST_EVENT_ID,
      name: "Percolateur",
      quantity: 1,
      type: "electronic",
      status: "to_check",
      who: null,
      where: "Réserve cuisson",
      notes: null,
    });
  });

  it("dirty est écrit dans l'objet props $state du parent", () => {
    const onSubmit = vi.fn(async () => {});
    const holder = bindableProps({
      eventId: TEST_EVENT_ID,
      onSubmit,
      onCancel: () => {},
      submitting: false,
      errors: [] as string[],
      dirty: false,
      mode: "item",
    });
    const target = mountSvelte(EventMaterielForm, holder as never);
    expect(holder.dirty).toBe(false);
    setInputValue(nameInput(target), "Percolateur");
    expect(holder.dirty).toBe(true);
  });
});

describe("EventMaterielForm — garde réservation liée (isLoanLinked)", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("item lié à un emprunt : champs portés par la réservation désactivés, bascule vers l'emprunt", async () => {
    const onEditLoan = vi.fn();
    const { target } = mountForm({
      mode: "item",
      initialData: makeEventMaterielRecord({
        status: "confirmed",
        who: "Jean",
        where: "Réserve",
        loanId: TEST_LOAN_ID,
        fromTeamName: "Team One",
      }),
      onEditLoan,
    });

    // L'encart annonce la délégation à la réservation
    expect(target.textContent).toContain("gérés par la réservation");
    expect(nameInput(target).disabled).toBe(true);
    expect(quantityInput(target).disabled).toBe(true);
    expect(typeSelect(target).disabled).toBe(true);
    expect(statusSelect(target).disabled).toBe(true);

    getByText(target, "button", "Voir la réservation").click();
    flushSync();
    expect(onEditLoan).toHaveBeenCalledWith(TEST_LOAN_ID);
  });
});

describe("EventMaterielForm — modes header et allocation", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("mode header (besoin) : pas de statut, pas de qui/où — le besoin ne porte pas de source", () => {
    const { target } = mountForm({ mode: "header" });
    expect(target.querySelectorAll("select")).toHaveLength(1); // type seul
    expect(nameInput(target)).toBeTruthy(); // nom rendu
    expect(
      target.querySelector('input[placeholder="Personne responsable"]'),
    ).toBeNull();
    expect(
      target.querySelector('input[placeholder="Lieu de stockage"]'),
    ).toBeNull();
  });

  it("en édition d'une allocation, « à trouver » n'est pas proposé", () => {
    const { target } = mountForm({
      mode: "allocation",
      initialData: makeEventMaterielRecord({
        status: "to_check",
        groupId: "t12evem00000002",
        who: "Jean",
      }),
    });
    const select = statusSelect(target);
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(["to_check", "confirmed"]);
  });
});

describe("EventMaterielForm — suggestion d'un besoin existant", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("choisir un besoin suggéré bascule vers l'édition via onExistingSelected, sans écraser le nom", async () => {
    await seedHeader();
    const onExistingSelected = vi.fn();
    const { target } = mountForm({
      mode: "item",
      onExistingSelected,
    });

    setInputValue(nameInput(target), "Table Pliante Bois");
    const dropdown = target.querySelector('ul[role="listbox"]');
    expect(dropdown).toBeTruthy();

    getByText(target, "span", "Table Pliante Bois").closest("button")!.click();
    flushSync();

    expect(onExistingSelected).toHaveBeenCalledTimes(1);
    expect(onExistingSelected).toHaveBeenCalledWith(
      eventMaterielStore.headers[0].id,
    );
  });
});
