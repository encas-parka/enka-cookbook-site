/**
 * @vitest-environment jsdom
 */

/**
 * ProductModal — l'orchestration d'édition d'un produit existant (ADR 0004).
 * Seam : vraie modale + vrai ProductModalState + vrai productsStore +
 * stub-pb + fake-indexeddb (patron EventMaterielModal.test).
 *
 * Contrats épinglés :
 *  - l'ouverture sur un produit affiche son nom, les cinq onglets, la
 *    tabulation demandée active
 *  - changer d'onglet affiche le gestionnaire correspondant
 *  - une modification de magasin arme « Tout enregistrer » ; le clic
 *    persiste (champ json `store`), re-snapshot l'état, ferme via onClose
 *  - « Fermer » sans modification ne passe ni par le snapshot de garde ni
 *    par une écriture : aucun update serveur
 *  - l'indicateur de garde (`hasUnsavedChanges`) est porté à
 *    ModalContainer : Échap ouvre le sous-dialogue quand il y a des
 *    modifications
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

// RecipesManager (onglet par défaut) importe le routeur — aucun test ici
// ne navigue, l'import seul suffit à vérifier.
vi.mock("$lib/router", () => ({
  navigate: vi.fn(),
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
  makeProductRecord,
  makeEvent,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { pb } from "$lib/db-sync/pb-sync";
import ProductModal from "../ProductModal.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import {
  modalDialog,
  pressEscape,
  cancelModalClose,
} from "$lib/test/__tests__/modal-harness";

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

async function seedAndInit() {
  currentFakePb().seed("products", [
    makeProductRecord({
      productName: "Huile d'olive",
      productType: "épicerie",
    }),
  ]);
  await productsStore.initialize(TEST_EVENT_ID);
  await waitForTick(5);
}

/** Toasts de ProductModalState : CustomEvent `toast` sur window, pas le service. */
function collectStateToasts(): Array<{ type: string; message: string }> {
  const received: Array<{ type: string; message: string }> = [];
  window.addEventListener("toast", ((event: CustomEvent) => {
    received.push(event.detail);
  }) as EventListener);
  return received;
}

/**
 * Monte la modale sur le produit seedé et attend le chargement du model
 * (header « Chargement... » tant que ProductModalState n'a pas résolu).
 */
function mountModal(props: Record<string, unknown> = {}): HTMLElement {
  const onClose = (props.onClose as () => void) ?? (() => {});
  const target = mountSvelte(ProductModal, {
    productId: TEST_PRODUCT_ID,
    onClose,
    ...props,
  });
  return target;
}

async function waitForLoaded(target: HTMLElement): Promise<void> {
  await waitForCondition(
    () => target.textContent!.includes("Huile d'olive"),
    "le produit est chargé dans la modale",
    100,
    flushSync,
  );
}

/**
 * Onglet par libellé contenu (le textContent porte l'icône et le badge de
 * compte : « Recettes0 » — le texte exact de getByText ne matche pas).
 */
function tabButton(target: HTMLElement, label: string): HTMLButtonElement {
  const button = [
    ...target.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ].find((b) => b.textContent?.includes(label));
  if (!button) throw new Error(`Onglet « ${label} » introuvable`);
  return button;
}

describe("ProductModal — ouverture et onglets", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("l'ouverture affiche le produit, les cinq onglets, recettes actif par défaut", async () => {
    await seedAndInit();
    const target = mountModal();
    await waitForLoaded(target);

    for (const tab of [
      "Recettes",
      "Magasin",
      "Volontaires",
      "Stock",
      "Achats",
    ]) {
      expect(tabButton(target, tab)).toBeTruthy();
    }
    const active = target.querySelector(".tab.tab-active");
    expect(active?.textContent).toContain("Recettes");
  });

  it("changer d'onglet affiche le gestionnaire correspondant", async () => {
    await seedAndInit();
    const target = mountModal();
    await waitForLoaded(target);

    tabButton(target, "Achats").click();
    flushSync();
    await waitForCondition(
      () => target.textContent!.includes("Ajouter un achat"),
      "le gestionnaire d'achats est rendu",
      100,
      flushSync,
    );
    expect(target.querySelector(".tab.tab-active")?.textContent).toContain(
      "Achats",
    );

    tabButton(target, "Magasin").click();
    flushSync();
    await waitForCondition(
      () => target.textContent!.includes("Définissez le magasin"),
      "le gestionnaire de magasin est rendu",
      100,
      flushSync,
    );
  });
});

describe("ProductModal — enregistrement et fermeture", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("une modification de magasin arme « Tout enregistrer », persiste puis ferme", async () => {
    await seedAndInit();
    const toasts = collectStateToasts();
    const onClose = vi.fn();
    const target = mountModal({ onClose });
    await waitForLoaded(target);

    tabButton(target, "Magasin").click();
    flushSync();
    // Sans modification : le footer propose « Fermer », pas d'enregistrement
    expect(getByText(target, "button", "Fermer")).toBeTruthy();

    const storeInput = target.querySelector<HTMLInputElement>(
      'input[placeholder="Magasin"]',
    );
    setInputValue(storeInput!, "Carrefour");
    // La modification arme le footer et la garde de ModalContainer
    await waitForCondition(
      () => !!queryByText(target, "button", "Tout enregistrer"),
      "la modification arme « Tout enregistrer »",
      100,
      flushSync,
    );
    pressEscape();
    expect(target.textContent).toContain("Fermer sans sauvegarder");
    // Le bouton « Annuler » du sous-dialogue de garde — PAS celui du
    // footer, qui fermerait la modale sans enregistrer
    cancelModalClose(target);
    flushSync();
    expect(queryByText(target, "button", "Tout enregistrer")).toBeTruthy();
    getByText(target, "button", "Tout enregistrer").click();
    await waitForCondition(
      () => onClose.mock.calls.length > 0,
      "la modale se ferme après l'enregistrement",
      100,
      flushSync,
    );
    expect(toasts.some((t) => t.message === "Modifications enregistrées")).toBe(
      true,
    );

    const [record] = await pb.collection("products").getFullList({});
    // storeInfo passe dans le champ json natif `store` (#toSchemaUpdates)
    expect((record.store as { storeName: string }).storeName).toBe("Carrefour");
  });

  it("« Fermer » sans modification ne met rien à jour au serveur", async () => {
    await seedAndInit();
    const onClose = vi.fn();
    const target = mountModal({ onClose });
    await waitForLoaded(target);

    getByText(target, "button", "Fermer").click();
    flushSync();

    expect(onClose).toHaveBeenCalledTimes(1);
    const [record] = await pb.collection("products").getFullList({});
    expect(record.store).toBeNull();
    expect(toastStub.error).not.toHaveBeenCalled();
  });
});
