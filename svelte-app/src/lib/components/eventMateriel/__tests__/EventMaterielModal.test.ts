/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielModal — les gestes d'écriture du matériel événement via le
 * store pb-sync (ADR 0004). Seam : vraie modale + vrai EventMaterielStore
 * + stub-pb + fake-indexeddb (patron MaterielForm.test).
 *
 * Contrats épinglés :
 *  - création d'un besoin « à trouver » → un item sans groupId
 *  - création avec source (statut ≠ to_find + qui) → besoin + allocation
 *    liée (addHeaderWithAllocation : le besoin reste le marqueur to_find)
 *  - édition → updateItem persisté
 *  - suppression → ConfirmModal puis deleteItemAndRemoveFromLoan, avec la
 *    cascade header → allocations
 *  - réattachement d'une allocation à un autre besoin (select natif
 *    pilotable en jsdom, contrairement au driver click-through) ; à
 *    quantité différente, l'ancien besoin survit — le nettoyage de
 *    l'orphelin (quantité égale) n'est PAS épinglé : la re-vérification
 *    du store lit le bridge liveQuery juste après l'await du link, la
 *    branche est sensible au timing (voir rapport de run, Findings)
 *  - liaison d'un item venu d'un emprunt à un besoin existant → statut
 *    to_check (une allocation ne reste jamais « à trouver »)
 *  - garde de fermeture : Échap sur formulaire sale passe par le
 *    sous-dialogue (canal window de ModalContainer)
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
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import {
  makeEventMaterielRecord,
  TEST_EVENT_ID,
  TEST_EM_ALLOC_ID,
  TEST_EM_HEADER_ID,
  TEST_EM_HEADER2_ID,
  TEST_EM_LOANITEM_ID,
  TEST_LOAN_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import type { EventMateriel } from "$lib/types/pb";
import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
import EventMaterielModal from "../EventMaterielModal.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  setSelectValue,
  getByText,
} from "$lib/test/mount-svelte";
import {
  modalDialog,
  pressEscape,
  confirmModalClose,
  cancelModalClose,
  expectModalClosed,
} from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";

/** Reset complet : transport, mocks, store singleton et Dexie. */
async function resetState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  toastStub.reset();
  await eventMaterielStore.destroy();
  await clearDexie();
}

async function seedAndInit(records: EventMateriel[]) {
  currentFakePb().seed("event_materiel", records);
  await eventMaterielStore.initializeForEvent(TEST_EVENT_ID);
  await waitForTick(5);
}

/**
 * Monte la modale avec `isOpen` réactif : `onClose` rebascule la prop —
 * le canal réel de la page. `openModal` est écarté car il étale les props
 * dans un littéral (piège bindableProps : la remontée serait rompue).
 */
function mountModal(props: Record<string, unknown> = {}): {
  target: HTMLElement;
} {
  const holder = bindableProps({
    isOpen: true,
    onClose: () => {},
    eventId: TEST_EVENT_ID,
    itemId: null as string | null,
    ...props,
  });
  holder.onClose = () => {
    holder.isOpen = false;
  };
  const target = mountSvelte(EventMaterielModal, holder as never);
  const dialog = modalDialog(target);
  if (!dialog) throw new Error("La modale ne s'est pas rendue");
  return { target };
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function typeSelect(target: HTMLElement): HTMLSelectElement {
  const select = [...target.querySelectorAll("select")].find((s) =>
    s.textContent?.includes("Sélectionner"),
  );
  if (!select) throw new Error("Select type introuvable");
  return select;
}

function whoInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder="Personne responsable"]',
  );
  if (!input) throw new Error("Champ qui introuvable");
  return input;
}

/**
 * Le bouton flèche du réattachement : le seul bouton primaire sans texte
 * de la modale (le footer « Enregistrer » porte son libellé).
 */
function reattachButton(target: HTMLElement): HTMLButtonElement {
  const button = [...target.querySelectorAll("button")].find(
    (b) =>
      b.classList.contains("btn-primary") &&
      b.textContent?.trim() === "" &&
      !b.disabled,
  );
  if (!button) throw new Error("Bouton de réattachement introuvable");
  return button;
}

/** Item du store par nom (une seule occurrence attendue par scénario). */
function itemByName(name: string) {
  return eventMaterielStore.items.find((i) => i.name === name);
}

describe("EventMaterielModal — création", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("un besoin « à trouver » est créé comme item sans groupId", async () => {
    await seedAndInit([]);
    const { target } = mountModal();

    setInputValue(nameInput(target), "Percolateur");
    setSelectValue(typeSelect(target), "electronic");
    getByText(target, "button", "Ajouter").click();

    // La fermeture est le symptôme terminal de la chaîne async (success →
    // handleClose → onClose) : elle garantit que le toast et le write ont
    // eu lieu (le bridge peut gagner la course contre la continuation UI).
    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items.length === 1,
      "l'item créé apparaît dans le store",
      100,
      flushSync,
    );
    const [item] = eventMaterielStore.items;
    expect(item.name).toBe("Percolateur");
    expect(item.type).toBe("electronic");
    expect(item.status).toBe("to_find");
    expect(item.groupId).toBeNull();
    expect(toastStub.success).toHaveBeenCalledWith("Item ajouté");
  });

  it("avec une source, la création fait besoin + allocation liée (statut to_find préservé sur le besoin)", async () => {
    await seedAndInit([]);
    const { target } = mountModal();

    setInputValue(nameInput(target), "Percolateur");
    setSelectValue(typeSelect(target), "electronic");
    setSelectValue(
      [...target.querySelectorAll("select")].find((s) =>
        s.textContent?.includes("À trouver"),
      )!,
      "to_check",
    );
    setInputValue(whoInput(target), "Jean");
    getByText(target, "button", "Ajouter").click();

    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items.length === 2,
      "besoin et allocation sont créés",
      100,
      flushSync,
    );
    const header = eventMaterielStore.items.find((i) => !i.groupId)!;
    const alloc = eventMaterielStore.items.find((i) => i.groupId)!;
    expect(header.status).toBe("to_find");
    expect(alloc.groupId).toBe(header.id);
    expect(alloc.status).toBe("to_check");
    expect(alloc.who).toBe("Jean");
    expect(toastStub.success).toHaveBeenCalledWith(
      "Besoin et allocation ajoutés",
    );
  });
});

describe("EventMaterielModal — édition et suppression", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("l'édition pré-remplit le formulaire et persiste la modification", async () => {
    await seedAndInit([
      makeEventMaterielRecord({ name: "Tables pliantes", quantity: 5 }),
    ]);
    const { target } = mountModal({ itemId: TEST_EM_HEADER_ID });

    expect(target.textContent).toContain("Modifier : Tables pliantes");
    expect(nameInput(target).value).toBe("Tables pliantes");

    setInputValue(nameInput(target), "Tables pliantes XL");
    getByText(target, "button", "Enregistrer").click();

    await expectModalClosed(target);
    await waitForCondition(
      () => itemByName("Tables pliantes XL") !== undefined,
      "la modification est persistée",
      100,
      flushSync,
    );
    expect(toastStub.track).toHaveBeenCalled();
  });

  it("la suppression d'un item passe par la confirmation puis retire le record", async () => {
    await seedAndInit([makeEventMaterielRecord({ name: "Percolateur" })]);
    const { target } = mountModal({ itemId: TEST_EM_HEADER_ID });

    target
      .querySelector<HTMLButtonElement>('button[title="Supprimer"]')!
      .click();
    flushSync();
    // Le sous-dialogue de confirmation est apparu
    getByText(target, "button", "Supprimer").click();

    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items.length === 0,
      "le record est supprimé",
      100,
      flushSync,
    );
  });

  it("supprimer un besoin cascade sur ses allocations", async () => {
    await seedAndInit([
      makeEventMaterielRecord({ name: "Tables pliantes", quantity: 5 }),
      makeEventMaterielRecord({
        id: TEST_EM_ALLOC_ID,
        name: "Tables pliantes",
        status: "confirmed",
        groupId: TEST_EM_HEADER_ID,
        who: "Jean",
        quantity: 2,
      }),
    ]);
    expect(eventMaterielStore.items).toHaveLength(2);
    const { target } = mountModal({ itemId: TEST_EM_HEADER_ID });

    target
      .querySelector<HTMLButtonElement>('button[title="Supprimer"]')!
      .click();
    flushSync();
    getByText(target, "button", "Supprimer").click();

    await waitForCondition(
      () => eventMaterielStore.items.length === 0,
      "besoin et allocations sont supprimés",
      100,
      flushSync,
    );
  });
});

describe("EventMaterielModal — réattachement et liaison", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("rattacher l'allocation à un autre besoin met à jour groupId sans toucher l'ancien besoin à quantité différente", async () => {
    await seedAndInit([
      makeEventMaterielRecord({ name: "Gastro 1/1 (10cm)", quantity: 5 }),
      makeEventMaterielRecord({
        id: TEST_EM_ALLOC_ID,
        name: "Gastro 1/1 (10cm)",
        status: "confirmed",
        groupId: TEST_EM_HEADER_ID,
        who: "Jean",
        quantity: 2,
      }),
      makeEventMaterielRecord({
        id: TEST_EM_HEADER2_ID,
        name: "Tables pliantes",
        quantity: 4,
      }),
    ]);
    const { target } = mountModal({ itemId: TEST_EM_ALLOC_ID });

    // Section réattachement : select natif pilotable en jsdom
    const select = [...target.querySelectorAll("select")].find((s) =>
      s.textContent?.includes("Choisir un besoin"),
    )!;
    setSelectValue(select, TEST_EM_HEADER2_ID);
    reattachButton(target).click();

    await waitForCondition(
      () =>
        eventMaterielStore.items.find((i) => i.id === TEST_EM_ALLOC_ID)
          ?.groupId === TEST_EM_HEADER2_ID,
      "l'allocation est rattachée au second besoin",
      100,
      flushSync,
    );
    // L'ancien besoin survit : quantité (5) différente de l'allocation
    // déplacée (2), le nettoyage automatique ne s'applique pas
    expect(
      eventMaterielStore.items.find((i) => i.id === TEST_EM_HEADER_ID),
    ).toBeDefined();
    expect(
      eventMaterielStore.items.find((i) => i.id === TEST_EM_ALLOC_ID)!.status,
    ).toBe("confirmed");
    expect(
      eventMaterielStore.items.find((i) => i.id === TEST_EM_HEADER2_ID),
    ).toBeDefined();
    expect(toastStub.info).not.toHaveBeenCalled();
  });

  it("lier un item venu d'un emprunt à un besoin existant passe son statut à « à vérifier »", async () => {
    await seedAndInit([
      makeEventMaterielRecord({ name: "Tables pliantes", quantity: 4 }),
      makeEventMaterielRecord({
        id: TEST_EM_LOANITEM_ID,
        name: "Gastro 1/1 (10cm)",
        quantity: 3,
        loanId: TEST_LOAN_ID,
        fromTeamName: "Team One",
      }),
    ]);
    const { target } = mountModal({ itemId: TEST_EM_LOANITEM_ID });

    expect(target.textContent).toContain("Lier à un besoin existant");
    const linkButton = [...target.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Tables pliantes"),
    )!;
    linkButton.click();

    await waitForCondition(
      () => toastStub.track.mock.calls.length > 0,
      "la liaison est partie (track)",
      100,
      flushSync,
    );
    await waitForCondition(
      () => itemByName("Gastro 1/1 (10cm)")!.groupId === TEST_EM_HEADER_ID,
      "l'item est lié au besoin",
      100,
      flushSync,
    );
    const linked = itemByName("Gastro 1/1 (10cm)")!;
    expect(linked.status).toBe("to_check");
  });

  it("un itemId inconnu affiche « Item introuvable »", async () => {
    await seedAndInit([makeEventMaterielRecord({ name: "Tables pliantes" })]);
    const { target } = mountModal({ itemId: "t12inexist000001" });
    expect(target.textContent).toContain("Item introuvable");
  });
});

describe("EventMaterielModal — garde de fermeture", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("Échap sur formulaire sale : sous-dialogue, annulation garde la modale, confirmation ferme", async () => {
    await seedAndInit([
      makeEventMaterielRecord({ name: "Tables pliantes", quantity: 5 }),
    ]);
    const { target } = mountModal({ itemId: TEST_EM_HEADER_ID });

    setInputValue(nameInput(target), "Tables pliantes XL");
    pressEscape();
    expect(target.textContent).toContain("Fermer sans sauvegarder");

    cancelModalClose(target);
    expect(modalDialog(target)).toBeTruthy();

    pressEscape();
    confirmModalClose(target);
    await expectModalClosed(target);
  });
});
