/**
 * @vitest-environment jsdom
 */

/**
 * AddProductModal — la création produit hors recettes (ADR 0004).
 * Seam : vraie modale + vrai productsStore + stub-pb + fake-indexeddb
 * (patron EventMaterielModal.test + products-store-create.test).
 *
 * Contrats épinglés :
 *  - le submit crée le produit au serveur (updatedBy posé par le store —
 *    item checklist §5) et ferme la modale
 *  - le submit à vide toaste l'erreur de validation, affiche les messages
 *    sous les champs et n'écrit rien
 *  - « Ajouter et créer un nouveau » crée sans fermer : nom/quantité/
 *    drapeaux réinitialisés, type conservé (enchaînement de saisie)
 *  - la quantité déclarée va en specs normalisée (besoin hors recettes),
 *    aucun achat n'est créé
 *  - le doublon (event, nom) remonte en erreur métier dans l'alert et le
 *    toast, la modale reste ouverte pour correction
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
  TEST_EVENT_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { pb } from "$lib/db-sync/pb-sync";
import AddProductModal from "../AddProductModal.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  setSelectValue,
  getByText,
} from "$lib/test/mount-svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";

/** Date de service future — l'event ne doit PAS basculer en mode consultation. */
const EVENT_DATE = "2026-12-19T18:00:00.000Z";

async function resetState() {
  currentFakePb().reset();
  // Unicité (event, nom) : le chemin de création est testé sous elle.
  currentFakePb().defineUniqueIndexes({
    products: [["eventId", "productName"]],
  });
  vi.restoreAllMocks();
  toastStub.reset();
  await productsStore.softReset();
  await clearDexie();
  vi.mocked(eventsStore.getEventById).mockImplementation((id: string) =>
    id === TEST_EVENT_ID ? makeEvent({ date: [EVENT_DATE] }) : null,
  );
}

async function initStore() {
  await productsStore.initialize(TEST_EVENT_ID);
  await waitForTick(3);
}

/**
 * Modale avec `open` réactif (prop `$bindable` du composant) : la
 * fermeture interne fait disparaître le dialogue, comme depuis la page.
 */
function mountModal(): {
  target: HTMLElement;
  holder: Record<string, unknown>;
} {
  const holder = bindableProps({ open: true }) as Record<string, unknown>;
  const target = mountSvelte(AddProductModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, holder };
}

function submitForm(target: HTMLElement): void {
  const form = target.querySelector("form");
  if (!form) throw new Error("Formulaire introuvable");
  // Contraintes HTML : aucun champ required ici, mais le dispatch direct
  // reste le canal sûr (piège requestSubmit, rapport lot 3).
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  flushSync();
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>("#product-name");
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function typeInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>("#product-type");
  if (!input) throw new Error("Champ type introuvable");
  return input;
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

/** Tous les records produits côté serveur (polling au besoin). */
async function serverProducts(): Promise<Record<string, unknown>[]> {
  for (let i = 0; i < 100; i++) {
    const all = await pb.collection("products").getFullList({});
    if (all.length > 0) return all as Record<string, unknown>[];
    await waitForTick(1);
    flushSync();
  }
  return [];
}

describe("AddProductModal — création", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("le submit crée le produit au serveur (updatedBy posé) et ferme la modale", async () => {
    await initStore();
    const { target, holder } = mountModal();

    setInputValue(nameInput(target), "Huile d'olive");
    setInputValue(typeInput(target), "épicerie");
    submitForm(target);

    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après la création",
      100,
      flushSync,
    );
    expect(holder.open).toBe(false);

    const [record] = await serverProducts();
    expect(record.productName).toBe("Huile d'olive");
    expect(record.productType).toBe("épicerie");
    expect(record.eventId).toBe(TEST_EVENT_ID);
    // Item checklist §5 : la création pose `updatedBy` (l'utilisateur
    // courant, fourni par le store)
    expect(record.updatedBy).toBe("test-user");
    expect(JSON.parse(record.specs as string)).toEqual({
      pF: false,
      pS: false,
    });
    expect(toastStub.success).toHaveBeenCalledWith(
      'Produit "Huile d\'olive" ajouté',
    );
  });

  it("le submit à vide toaste l'erreur de validation, affiche les messages et n'écrit rien", async () => {
    await initStore();
    const { target } = mountModal();

    submitForm(target);

    expect(toastStub.error).toHaveBeenCalledWith(
      "Veuillez remplir les champs obligatoires",
    );
    expect(target.textContent).toContain("Le nom du produit est requis");
    expect(target.textContent).toContain("Le type/catégorie est requis");
    expect(modalDialog(target)).not.toBeNull();
    expect(await serverProducts()).toHaveLength(0);
  });
});

describe("AddProductModal — enchaînement et besoin déclaré", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("« Ajouter et créer un nouveau » crée sans fermer : nom vidé, type conservé", async () => {
    await initStore();
    const { target } = mountModal();

    setInputValue(nameInput(target), "Coca");
    setInputValue(typeInput(target), "Boissons");
    getByText(target, "button", "Ajouter et créer un nouveau").click();
    flushSync();

    await waitForCondition(
      () => toastStub.success.mock.calls.length > 0,
      "le premier produit est créé",
      100,
      flushSync,
    );
    // La modale reste rendue, prête pour la saisie suivante
    expect(modalDialog(target)).not.toBeNull();
    expect(nameInput(target).value).toBe("");
    expect(typeInput(target).value).toBe("Boissons");

    // Le second produit de la série se crée dans le même flot
    setInputValue(nameInput(target), "Fanta");
    getByText(target, "button", "Ajouter et créer un nouveau").click();
    await waitForCondition(
      () => toastStub.success.mock.calls.length === 2,
      "le second produit est créé",
      100,
      flushSync,
    );
    const records = await serverProducts();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.productName).sort()).toEqual(["Coca", "Fanta"]);
  });

  it("la quantité déclarée va en specs normalisée (besoin hors recettes), aucun achat créé", async () => {
    await initStore();
    const { target } = mountModal();

    setInputValue(nameInput(target), "Jus d'orange");
    setInputValue(typeInput(target), "Boissons");
    setInputValue(quantityInput(target), "500");
    setSelectValue(unitSelect(target), "gr.");
    submitForm(target);

    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après la création",
      100,
      flushSync,
    );
    const [record] = await serverProducts();
    // Le besoin déclaré est stocké en specs (unité de base), il ne crée
    // PAS un achat
    expect(JSON.parse(record.specs as string)).toEqual({
      quantity: { q: 500, u: "gr." },
      pF: false,
      pS: false,
    });
    const purchases = await pb.collection("purchases").getFullList({});
    expect(purchases).toHaveLength(0);
  });

  it("un doublon (event, nom) remonte en erreur métier et garde la modale ouverte", async () => {
    await initStore();
    const { target, holder } = mountModal();

    setInputValue(nameInput(target), "Huile d'olive");
    setInputValue(typeInput(target), "épicerie");
    submitForm(target);
    await waitForCondition(
      () => modalDialog(target) === null,
      "la première création ferme la modale",
      100,
      flushSync,
    );

    // Réouverture : le formulaire a été réinitialisé à la fermeture
    holder.open = true;
    flushSync();
    expect(nameInput(target).value).toBe("");
    setInputValue(nameInput(target), "Huile d'olive");
    setInputValue(typeInput(target), "épicerie");
    submitForm(target);

    await waitForCondition(
      () => target.textContent.includes("existe déjà dans cet événement"),
      "l'erreur métier de doublon est affichée",
      100,
      flushSync,
    );
    expect(toastStub.error).toHaveBeenCalled();
    expect(modalDialog(target)).not.toBeNull();
    const records = await serverProducts();
    expect(records).toHaveLength(1);
  });
});
