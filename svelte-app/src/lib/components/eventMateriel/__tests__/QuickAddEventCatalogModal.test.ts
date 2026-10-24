/**
 * @vitest-environment jsdom
 */

/**
 * QuickAddEventCatalogModal — la saisie rapide des besoins par catalogue
 * (ADR 0004). Seam : vraie modale + vrai EventMaterielStore + stub-pb.
 *
 * Contrats épinglés :
 *  - à l'ouverture, les quantités préchargent les besoins « sans source »
 *    (pas de who/where) matchés par nom du catalogue ; les apports sourcés
 *    s'affichent en badges, hors compteur
 *  - le submit est différentiel : créer (qty > 0 sans existant), mettre à
 *    jour la quantité, supprimer à qty 0 — un item du store par geste
 *  - le bouton Enregistrer est gardé par hasChanges (aucune écriture sans
 *    divergence)
 *  - la recherche filtre le catalogue
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
} from "$lib/stores/__tests__/harness/fixtures";
import type { EventMateriel } from "$lib/types/pb";
import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
import QuickAddEventCatalogModal from "../QuickAddEventCatalogModal.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import {
  modalDialog,
  expectModalClosed,
} from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const CATALOG_ITEM = "Gastro 1/1 (10cm)";

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
 * Monte la modale avec `isOpen` réactif (`onClose` rebascule la prop —
 * canal réel de la page). `openModal` est écarté : il étale les props
 * dans un littéral, ce qui rompt la remontée du proxy $state.
 */
function mountQuickAdd(): { target: HTMLElement } {
  const holder = bindableProps({
    isOpen: true,
    onClose: () => {},
    eventId: TEST_EVENT_ID,
  });
  holder.onClose = () => {
    holder.isOpen = false;
  };
  const target = mountSvelte(QuickAddEventCatalogModal, holder as never);
  const dialog = modalDialog(target);
  if (!dialog) throw new Error("La modale ne s'est pas rendue");
  return { target };
}

/**
 * La ligne d'un item du catalogue : le plus petit ancêtre du nom portant
 * l'input quantité.
 */
function rowInput(target: HTMLElement, name: string): HTMLInputElement {
  const span = getByText(target, "span", name);
  let el: HTMLElement | null = span;
  while (el && !el.querySelector('input[aria-label="Quantité"]')) {
    el = el.parentElement;
  }
  const input = el?.querySelector<HTMLInputElement>(
    'input[aria-label="Quantité"]',
  );
  if (!input) throw new Error(`Ligne « ${name} » introuvable`);
  return input;
}

function searchInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder="Rechercher dans le catalogue..."]',
  );
  if (!input) throw new Error("Champ recherche introuvable");
  return input;
}

describe("QuickAddEventCatalogModal — ouverture et préchargement", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("les quantités préchargent les besoins sans source ; les apports sourcés sont des badges", async () => {
    await seedAndInit([
      makeEventMaterielRecord({
        name: CATALOG_ITEM,
        quantity: 5,
        type: "cooking",
      }),
      makeEventMaterielRecord({
        id: TEST_EM_ALLOC_ID,
        name: CATALOG_ITEM,
        quantity: 3,
        type: "cooking",
        status: "confirmed",
        groupId: TEST_EM_HEADER_ID,
        who: "Jean",
      }),
    ]);
    const { target } = mountQuickAdd();

    // Préchargé depuis le besoin sans source
    expect(rowInput(target, CATALOG_ITEM).value).toBe("5");
    expect(target.textContent).toContain("à trouver: 5");
    // L'apport sourcé n'entre pas dans le compteur, il s'affiche en badge
    expect(target.textContent).toContain("Jean: 3");
  });

  it("sans modification, Enregistrer reste désactivé (garde hasChanges)", async () => {
    const { target } = mountQuickAdd();
    const save = getByText(target, "button", "Enregistrer");
    expect(save.disabled).toBe(true);
  });
});

describe("QuickAddEventCatalogModal — submit différentiel", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("une quantité nouvelle crée le besoin en statut « à trouver »", async () => {
    await seedAndInit([]);
    const { target } = mountQuickAdd();

    setInputValue(rowInput(target, CATALOG_ITEM), "3");
    expect(target.textContent!.replace(/\s+/g, " ")).toContain(
      "1 item — quantité totale : 3",
    );

    getByText(target, "button", "Enregistrer").click();
    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items.length === 1,
      "le besoin est créé dans le store",
      100,
      flushSync,
    );
    const [item] = eventMaterielStore.items;
    expect(item.name).toBe(CATALOG_ITEM);
    expect(item.quantity).toBe(3);
    expect(item.status).toBe("to_find");
    expect(item.type).toBe("cooking");
    expect(toastStub.success).toHaveBeenCalledWith("Besoins : 1 ajouté");
  });

  it("augmenter un besoin existant met à jour sa quantité", async () => {
    await seedAndInit([
      makeEventMaterielRecord({
        name: CATALOG_ITEM,
        quantity: 5,
        type: "cooking",
      }),
    ]);
    const { target } = mountQuickAdd();

    setInputValue(rowInput(target, CATALOG_ITEM), "7");
    getByText(target, "button", "Enregistrer").click();
    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items[0]?.quantity === 7,
      "la quantité du besoin est mise à jour",
      100,
      flushSync,
    );
    expect(toastStub.success).toHaveBeenCalledWith("Besoins : 1 mis à jour");
  });

  it("ramener la quantité à 0 supprime le besoin (retrait du catalogue)", async () => {
    await seedAndInit([
      makeEventMaterielRecord({
        name: CATALOG_ITEM,
        quantity: 5,
        type: "cooking",
      }),
    ]);
    const { target } = mountQuickAdd();

    setInputValue(rowInput(target, CATALOG_ITEM), "0");
    getByText(target, "button", "Enregistrer").click();
    await expectModalClosed(target);
    await waitForCondition(
      () => eventMaterielStore.items.length === 0,
      "le besoin est retiré",
      100,
      flushSync,
    );
    expect(toastStub.success).toHaveBeenCalledWith("Besoins : 1 retiré");
  });
});

describe("QuickAddEventCatalogModal — recherche", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("la recherche filtre le catalogue", async () => {
    const { target } = mountQuickAdd();

    expect(getByText(target, "span", CATALOG_ITEM)).toBeTruthy();
    setInputValue(searchInput(target), "Passoire 1/1 Fine");

    expect(getByText(target, "span", "Passoire 1/1 Fine (6,5cm)")).toBeTruthy();
    expect(queryByText(target, "span", CATALOG_ITEM)).toBeNull();
  });

  it("une recherche sans correspondance affiche le message vide", async () => {
    const { target } = mountQuickAdd();

    setInputValue(searchInput(target), "Inexistant au catalogue");

    expect(target.textContent).toContain("Aucun résultat pour");
    expect(queryByText(target, "span", CATALOG_ITEM)).toBeNull();
  });
});
