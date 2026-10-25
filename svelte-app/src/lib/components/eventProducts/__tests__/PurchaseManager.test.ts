/**
 * @vitest-environment jsdom
 */

/**
 * PurchaseManager — les achats d'un produit (ADR 0004).
 * Seam : vrai composant + vrai ProductModalState + vrai productsStore +
 * stub-pb + fake-indexeddb (patron EventMaterielModal.test). Le state est
 * l'instance réelle que ProductModal construit : le composant ne mocke
 * rien de ce qu'il pilote.
 *
 * Contrats épinglés :
 *  - l'ajout crée l'achat (quantité normalisée en unité de base, `who`
 *    prérempli de l'utilisateur) ; statut « Acheté » sans date →
 *    deliveryDate posée par défaut (maintenant)
 *  - statut « Commandé » sans date de commande → orderDate = aujourd'hui
 *    (item checklist §5 « préremplies »), pas de deliveryDate
 *  - l'édition réutilise le formulaire d'ajout : préremplissage depuis
 *    l'achat, persistance des modifications, sortie du mode édition
 *  - la suppression passe par le confirm natif (convention § Canons),
 *    retire le record
 *  - le formulaire vide désactive « Ajouter l'achat » (garde de validité)
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
    isMobile: false,
  },
}));

vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    getRecipeUpdatedAt: vi.fn(),
    getRecipesByUuidsBulk: vi.fn(async () => new Map()),
    getRecipeByUuid: vi.fn(async () => null),
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
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  makePurchaseRecord,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
  TEST_PURCHASE_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { ProductModalState } from "$lib/stores/ProductModalState.svelte";
import { pb } from "$lib/db-sync/pb-sync";
import PurchaseManager from "../PurchaseManager.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  setSelectValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

/** Date de service future — l'event ne doit PAS basculer en mode consultation. */
const EVENT_DATE = "2026-12-19T18:00:00.000Z";

/** Toasts de ProductModalState : CustomEvent `toast` sur window, pas le service. */
function collectStateToasts(): Array<{ type: string; message: string }> {
  const received: Array<{ type: string; message: string }> = [];
  window.addEventListener("toast", ((event: CustomEvent) => {
    received.push(event.detail);
  }) as EventListener);
  return received;
}

/**
 * Symptôme terminal d'un geste d'achat : le toast du state (succès OU
 * erreur). L'écriture Dexie est optimiste — la table peut afficher la
 * valeur AVANT la confirmation serveur ; tout assert serveur passe
 * derrière cette barrière.
 */
async function waitForStateToast(
  message: string,
  toasts: Array<{ type: string; message: string }>,
): Promise<void> {
  await waitForCondition(
    () => toasts.some((t) => t.message === message),
    `le toast « ${message} » confirme la fin de la chaîne`,
    100,
    flushSync,
  );
}

async function resetState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  toastStub.reset();
  await productsStore.softReset();
  await clearDexie();
  vi.mocked(eventsStore.getEventById).mockImplementation((id: string) =>
    id === TEST_EVENT_ID ? makeEvent({ date: [EVENT_DATE] }) : null,
  );
}

/**
 * Seed produit + besoin déclaré (manque 2 l.) et initialise le store.
 * Le manque préremplit le formulaire d'achat du state (quantité 2).
 */
async function seedAndInit(records = []) {
  currentFakePb().seed("products", [
    makeProductRecord({
      productName: "Huile d'olive",
      productType: "épicerie",
    }),
  ]);
  currentFakePb().seed("purchases", records);
  await productsStore.initialize(TEST_EVENT_ID);
  await waitForTick(5);
}

function mountManager(): { target: HTMLElement; state: ProductModalState } {
  const state = new ProductModalState(TEST_PRODUCT_ID, "achats");
  const target = mountSvelte(PurchaseManager, {
    modalState: state,
    isArchiveMode: false,
  });
  return { target, state };
}

function quantityInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder="Quantité"]',
  );
  if (!input) throw new Error("Champ quantité introuvable");
  return input;
}

function unitSelect(target: HTMLElement): HTMLSelectElement {
  const select = target.querySelector<HTMLSelectElement>("select");
  if (!select) throw new Error("Select d'unité introuvable");
  return select;
}

function statusSelect(target: HTMLElement): HTMLSelectElement {
  const select = [...target.querySelectorAll("select")].find((s) =>
    s.textContent?.includes("Commandé"),
  );
  if (!select) throw new Error("Select de statut introuvable");
  return select;
}

function addPurchaseRecords(): Promise<Record<string, unknown>[]> {
  return pb.collection("purchases").getFullList({}) as Promise<
    Record<string, unknown>[]
  >;
}

describe("PurchaseManager — création d'achat", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("l'ajout crée l'achat : quantité en unité de base, who prérempli, deliveryDate par défaut sur « Acheté »", async () => {
    await seedAndInit();
    const toasts = collectStateToasts();
    const { target } = mountManager();

    // Sans besoin seedé, le formulaire démarre vide : saisie complète
    setInputValue(quantityInput(target), "500");
    setSelectValue(unitSelect(target), "gr.");
    getByText(target, "button", "Ajouter l'achat").click();

    await waitForStateToast("Achat ajouté avec succès", toasts);
    await waitForCondition(
      () => queryByText(target, "td", "500 gr.") !== null,
      "l'achat apparaît dans la table",
      100,
      flushSync,
    );
    const [record] = await addPurchaseRecords();
    expect(record.quantity).toBe(500);
    expect(record.unit).toBe("gr.");
    expect(record.status).toBe("delivered");
    expect(record.who).toBe("test-user");
    // Statut livré sans date → date de livraison posée par défaut
    expect(record.deliveryDate).toBeTruthy();
  });

  it("statut « Commandé » sans date : orderDate = aujourd'hui, pas de deliveryDate", async () => {
    await seedAndInit();
    const toasts = collectStateToasts();
    const { target } = mountManager();

    setInputValue(quantityInput(target), "3");
    setSelectValue(unitSelect(target), "gr.");
    setSelectValue(statusSelect(target), "ordered");
    flushSync();
    // Le champ date de livraison apparaît (wiring StatusSelect)
    expect(target.querySelector('input[type="date"]')).toBeTruthy();

    getByText(target, "button", "Ajouter l'achat").click();
    await waitForStateToast("Achat ajouté avec succès", toasts);
    await waitForCondition(
      () => queryByText(target, "td", "Commandé") !== null,
      "l'achat commandé apparaît dans la table",
      100,
      flushSync,
    );
    const [record] = await addPurchaseRecords();
    expect(record.status).toBe("ordered");
    expect(record.orderDate).toBe(new Date().toISOString().split("T")[0]);
    expect(record.deliveryDate).toBeNull();
  });

  it("formulaire sans quantité : « Ajouter l'achat » désactivé", async () => {
    await seedAndInit();
    const { target } = mountManager();

    // Sans besoin seedé, la quantité démarre à null : la garde de validité
    // du state tient le bouton désactivé
    expect(
      (getByText(target, "button", "Ajouter l'achat") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("PurchaseManager — édition et suppression", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("l'édition préremplit le formulaire puis persiste les modifications", async () => {
    await seedAndInit([
      makePurchaseRecord({ quantity: 6, unit: "l.", store: "Carrefour" }),
    ]);
    const toasts = collectStateToasts();
    const { target } = mountManager();
    await waitForCondition(
      () => queryByText(target, "td", "Carrefour") !== null,
      "l'achat seedé est affiché",
      100,
      flushSync,
    );

    // Le crayon : premier bouton de la cellule actions de la table
    const editButton = target.querySelector<HTMLButtonElement>(
      "tbody td:last-child button",
    )!;
    editButton.click();
    flushSync();
    expect(target.textContent).toContain("Modifier l'achat");
    expect(quantityInput(target).value).toBe("6");

    setInputValue(quantityInput(target), "500");
    setSelectValue(unitSelect(target), "gr.");
    getByText(target, "button", "Enregistrer les modifications").click();

    await waitForStateToast("Achat modifié avec succès", toasts);
    await waitForCondition(
      () => queryByText(target, "td", "500 gr.") !== null,
      "la modification est affichée",
      100,
      flushSync,
    );
    const [record] = await addPurchaseRecords();
    expect(record.quantity).toBe(500);
    expect(record.unit).toBe("gr.");
    // La sortie d'édition réarme le formulaire d'ajout
    expect(target.textContent).toContain("Ajouter un achat");
  });

  it("la suppression passe par le confirm natif puis retire le record", async () => {
    await seedAndInit([
      makePurchaseRecord({
        id: TEST_PURCHASE_ID,
        quantity: 6,
        unit: "l.",
      }),
    ]);
    const toasts = collectStateToasts();
    const { target } = mountManager();
    await waitForCondition(
      () => queryByText(target, "td", "6 l.") !== null,
      "l'achat seedé est affiché",
      100,
      flushSync,
    );

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteButton = target.querySelector<HTMLButtonElement>(
      "tbody td:last-child button.btn-error, tbody td:last-child button.text-error",
    )!;
    deleteButton.click();

    await waitForStateToast("Achat supprimé avec succès", toasts);
    // Symptôme terminal de la chaîne : la ligne disparaît de la table
    await waitForCondition(
      () => queryByText(target, "td", "6 l.") === null,
      "l'achat supprimé disparaît de la table",
      100,
      flushSync,
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain("Supprimer cet achat");
    // Suppression SOFT : le record serveur subsiste, marqué « deleted »
    const records = await addPurchaseRecords();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("deleted");
  });
});
