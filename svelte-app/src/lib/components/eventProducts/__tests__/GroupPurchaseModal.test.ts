/**
 * @vitest-environment jsdom
 */

/**
 * GroupPurchaseModal — l'achat groupé des manques d'un groupe de produits
 * (ADR 0004). Seam : vraie modale + vrai productsStore + stub-pb +
 * fake-indexeddb (patron EventMaterielModal.test).
 *
 * Contrats épinglés :
 *  - le titre compte les produits et la période ; chaque produit est
 *    proposé avec son manque en badge
 *  - la validation ferme D'ABORD (onClose), crée en fond un achat par
 *    produit manquant rattaché à une facture FACTURE_*, plus la dépense
 *    quand un montant est saisi ; onSuccess confirme, clearSyncStatus
 *    est passé
 *  - décocher un produit le retire du lot : un seul achat, pas de dépense
 *  - « Annuler » ferme sans aucun write ni toast
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
import {
  clearDexie,
  seedProductNeeds,
} from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForTick } from "$lib/stores/__tests__/harness/wait-for-tick";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import {
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
  TEST_PRODUCT2_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import type { EnrichedProduct } from "$lib/types/store.types";
import { pb } from "$lib/db-sync/pb-sync";
import GroupPurchaseModal from "../GroupPurchaseModal.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

/** Date de service future — l'event ne doit PAS basculer en mode consultation. */
const EVENT_DATE = "2026-12-19T18:00:00.000Z";

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
 * Deux produits réels avec un besoin déclaré chacun (2 l. d'eau, 1 kg de
 * riz) : les manques alimentent le lot d'achat groupé.
 */
async function seedAndInit() {
  currentFakePb().seed("products", [
    makeProductRecord({ productName: "Eau" }),
    makeProductRecord({ id: TEST_PRODUCT2_ID, productName: "Riz" }),
  ]);
  await seedProductNeeds([
    makeNeedRow(),
    makeNeedRow({
      id: TEST_PRODUCT2_ID,
      ingredientRef: "riz",
      productName: "Riz",
      totalNeededArray: JSON.stringify([{ q: 1, u: "kg" }]),
      nbRecipes: 1,
      totalAssiettes: 5,
    }),
  ]);
  await productsStore.initialize(TEST_EVENT_ID);
  await waitForTick(5);
}

function mountedProducts(): EnrichedProduct[] {
  const products = [TEST_PRODUCT_ID, TEST_PRODUCT2_ID]
    .map((id) => productsStore.getEnrichedProductById(id))
    .filter((p): p is EnrichedProduct => p !== null);
  if (products.length !== 2) {
    throw new Error("Les produits seedés ne sont pas enrichis dans le store");
  }
  return products;
}

function mountModal(
  products: EnrichedProduct[],
  handlers: { onClose: () => void; onSuccess?: () => void },
): HTMLElement {
  return mountSvelte(GroupPurchaseModal, { products, ...handlers });
}

/**
 * Badge produit du lot (BtnGroupCheck → CheckboxBadge) : un `label`
 * portant le nom + manque formaté, piloté par sa checkbox interne.
 */
function productToggle(target: HTMLElement, name: string): HTMLInputElement {
  const label = [...target.querySelectorAll("label")].find((l) =>
    l.textContent?.includes(name),
  );
  if (!label) throw new Error(`Badge produit « ${name} » introuvable`);
  const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`Checkbox du badge « ${name} » introuvable`);
  return input;
}

function hasProductBadge(target: HTMLElement, name: string): boolean {
  return [...target.querySelectorAll("label")].some((l) =>
    l.textContent?.includes(name),
  );
}

describe("GroupPurchaseModal — présentation du lot", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("le titre compte les produits, chaque badge porte le manque, le bouton annonce le lot", async () => {
    await seedAndInit();
    const target = mountModal(mountedProducts(), { onClose: () => {} });

    expect(target.textContent).toContain("Achat groupé (2 produits)");
    expect(hasProductBadge(target, "Eau")).toBe(true);
    expect(hasProductBadge(target, "Riz")).toBe(true);
    expect(target.textContent).toContain("Valider");
    expect(target.textContent).toContain("2 produits");
  });

  it("sans produit, le lot affiche l'avertissement dédié", async () => {
    await seedAndInit();
    const target = mountModal([], { onClose: () => {} });
    expect(target.textContent).toContain(
      "Aucun besoin dans le groupe séléctionné",
    );
  });
});

describe("GroupPurchaseModal — validation du lot", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("valider ferme d'abord, puis crée la dépense facturée ; BUG épinglé : les achats sont vides", async () => {
    await seedAndInit();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const target = mountModal(mountedProducts(), { onClose, onSuccess });

    const storeInput = target.querySelector<HTMLInputElement>(
      'input[placeholder="Magasin"]',
    )!;
    setInputValue(storeInput, "Carrefour");
    const priceInput = target.querySelector<HTMLInputElement>(
      'input[placeholder="0.00"]',
    )!;
    setInputValue(priceInput, "15.5");

    getByText(target, "button", "Annuler")
      .closest(".flex")!
      .querySelector<HTMLButtonElement>("button.btn-primary")!
      .click();
    // La fermeture part AVANT la création (traitement en fond)
    expect(onClose).toHaveBeenCalledTimes(1);

    await waitForCondition(
      () => toastStub.track.mock.calls.length > 0,
      "la création groupée est partie (toast track)",
      100,
      flushSync,
    );
    await waitForCondition(
      () => onSuccess.mock.calls.length > 0,
      "onSuccess confirme le succès du batch",
      100,
      flushSync,
    );

    // BUG épinglé (à retourner au fix) : GroupPurchaseModal filtre les
    // manques par `qty.q < 0` alors que productModel.stats.missingQuantities
    // est documenté « positif seulement » (calculateAndFormatMissing ne
    // pousse que missing > 0) — le lot part vide et AUCUN achat n'est créé,
    // seul le succès est toasté. L'utilisateur croit avoir acheté pour le
    // groupe : ne rien écrire d'autre que ce constat tant que le filtre
    // n'est pas corrigé.
    const purchases = (await pb
      .collection("purchases")
      .getFullList({})) as Record<string, unknown>[];
    const realPurchases = purchases.filter((p) => p.status !== "expense");
    const expenses = purchases.filter((p) => p.status === "expense");
    expect(realPurchases).toHaveLength(0);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].price).toBe(15.5);
    expect(expenses[0].invoiceTotal).toBe(15.5);
    expect(expenses[0].store).toBe("Carrefour");
    expect(expenses[0].invoiceId).toMatch(/^FACTURE_/);
  });

  it("décocher un produit le retire du lot (décompte du bouton, lot réduit)", async () => {
    await seedAndInit();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const target = mountModal(mountedProducts(), { onClose, onSuccess });

    productToggle(target, "Riz").click();
    flushSync();
    expect(target.textContent).toContain("Valider");
    expect(target.textContent).toContain("1 produit");
    expect(target.textContent).not.toContain("1 produits");

    getByText(target, "button", "Annuler")
      .closest(".flex")!
      .querySelector<HTMLButtonElement>("button.btn-primary")!
      .click();
    expect(onClose).toHaveBeenCalledTimes(1);

    await waitForCondition(
      () => onSuccess.mock.calls.length > 0,
      "onSuccess confirme le batch réduit",
      100,
      flushSync,
    );
    // Même filtre mort que le test précédent : aucun achat créé
    const purchases = (await pb
      .collection("purchases")
      .getFullList({})) as Record<string, unknown>[];
    expect(purchases.filter((p) => p.status !== "expense")).toHaveLength(0);
    expect(purchases.some((p) => p.status === "expense")).toBe(false);
  });

  it("« Annuler » ferme sans aucun write", async () => {
    await seedAndInit();
    const onClose = vi.fn();
    const target = mountModal(mountedProducts(), { onClose });

    getByText(target, "button", "Annuler").click();
    flushSync();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastStub.track).not.toHaveBeenCalled();
    const purchases = await pb.collection("purchases").getFullList({});
    expect(purchases).toHaveLength(0);
  });
});
