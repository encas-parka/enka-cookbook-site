/**
 * @vitest-environment jsdom
 */

/**
 * CreateIngredientModal — la création d'ingrédient au catalogue (ADR 0004, W).
 *
 * Seam : vraie modale + vrai recipeDataStore + stub-pb + fake-indexeddb
 * (patron CreateCategoryModal.test). `addIngredient` exige un store
 * initialisé (garde isInitialized) : le catalogue est initialisé une fois
 * par fichier (l'initPromise du singleton est collant — pas de re-init) et
 * les tests re-seedent la table Dexie directement, le bridge liveQuery la
 * répercute dans le store.
 *
 * Contrats épinglés :
 *  - le submit à vide affiche les 5 validations et n'écrit rien
 *  - le submit complet crée l'ingrédient au serveur (ref métier généré),
 *    toaste le succès, remonte l'ingrédient au parent et ferme la modale
 *  - l'allergène « Aucun » évince les autres (payload allergens [])
 *  - le garde anti-doublon : un nom ressemblant à un ingrédient existant
 *    propose l'existant (« utiliser » ferme sans créer)
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

// ModalContainer (via ModalHeader/Content/Footer) lit GlobalState
vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("$lib/stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import { db, pb } from "$lib/db-sync/pb-sync";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import { makeIngredientRecord } from "$lib/stores/__tests__/harness/fixtures";
import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
import CreateIngredientModal from "../CreateIngredientModal.svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  setSelectValue,
  getByText,
} from "$lib/test/mount-svelte";

/**
 * Catalogue de jointure : « Eau de source » sert à la fois de réplica serveur
 * (initialFetch de l'init) et de candidat anti-doublon. La clé de jointure
 * est le champ `ref`, pas l'id PB.
 */
function seedCatalogue(): void {
  currentFakePb().seed("ingredients", [
    makeIngredientRecord({ name: "Eau de source", type: "autres" }),
  ]);
}

async function resetState() {
  vi.restoreAllMocks();
  toastStub.reset();
  await clearDexie();
}

beforeAll(async () => {
  seedCatalogue();
  await recipeDataStore.initialize();
});

beforeEach(resetState);
afterEach(() => cleanupSvelte());

function mountModal(
  callbacks: {
    onIngredientCreated?: (i: unknown) => void;
    onUseExisting?: (i: unknown) => void;
  } = {},
) {
  const holder = bindableProps({
    open: true,
    onIngredientCreated: callbacks.onIngredientCreated ?? ((_i: unknown) => {}),
    onUseExisting: callbacks.onUseExisting ?? ((_i: unknown) => {}),
  }) as Record<string, unknown>;
  const target = mountSvelte(CreateIngredientModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, holder };
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    "#ingredient-name-input",
  );
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function typeSelect(target: HTMLElement): HTMLSelectElement {
  const select = target.querySelector<HTMLSelectElement>("select");
  if (!select) throw new Error("Select type introuvable");
  return select;
}

/** Les boutons Oui/Non du join pF (0-1) puis pS (2-3). */
function pfpsButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>(".join .btn"));
}

function allergenCheckbox(
  target: HTMLElement,
  label: string,
): HTMLInputElement {
  const checkbox = Array.from(
    target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).find((el) => el.closest("label")?.textContent?.includes(label));
  if (!checkbox) throw new Error(`Case allergène « ${label} » introuvable`);
  return checkbox;
}

function submit(target: HTMLElement): void {
  getByText(target, "button", "Créer l'ingrédient").click();
  flushSync();
}

describe("CreateIngredientModal — validation", () => {
  it("le submit à vide affiche les 5 validations et n'écrit rien", async () => {
    const { target } = mountModal();

    submit(target);

    expect(target.textContent).toContain("Le nom est requis");
    expect(target.textContent).toContain("Le type est requis");
    expect(target.textContent).toContain(
      "Cochez 'Aucun' si l'ingrédient ne contient aucun allergène",
    );
    expect(target.textContent).toContain("Indiquez si c'est un produit frais");
    expect(target.textContent).toContain(
      "Indiquez si c'est un produit surgelé",
    );
    expect(modalDialog(target)).not.toBeNull();
    expect(toastStub.success).not.toHaveBeenCalled();
    expect(await pb.collection("ingredients").getFullList({})).toHaveLength(1);
  });
});

describe("CreateIngredientModal — création", () => {
  it("le submit complet crée l'ingrédient (ref métier, allergènes normalisés) et ferme", async () => {
    const created: Array<{ name: string; ref: string }> = [];
    const { target, holder } = mountModal({
      onIngredientCreated: (i) =>
        created.push(i as { name: string; ref: string }),
    });

    setInputValue(nameInput(target), "Céleri-rave Bio");
    setSelectValue(typeSelect(target), "legumes");
    // Un allergène puis « Aucun » : « Aucun » doit l'évincer du payload
    allergenCheckbox(target, "Céleri").click();
    flushSync();
    allergenCheckbox(target, "Aucun").click();
    flushSync();
    pfpsButtons(target)[0].click(); // pF = Oui
    flushSync();
    pfpsButtons(target)[3].click(); // pS = Non
    flushSync();

    submit(target);

    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après la création",
      100,
      flushSync,
    );
    expect(holder.open).toBe(false);
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Céleri-rave Bio");
    // Ref métier court (7 chars) — la clé de jointure du catalogue
    expect(created[0].ref).toHaveLength(7);
    expect(toastStub.success).toHaveBeenCalledWith(
      'Ingrédient "Céleri-rave Bio" créé avec succès',
    );

    const records = (await pb
      .collection("ingredients")
      .getFullList({})) as Array<Record<string, unknown>>;
    const record = records.find((r) => r.name === "Céleri-rave Bio");
    expect(record).toBeDefined();
    expect(record?.type).toBe("legumes");
    // « Aucun » évince les autres allergènes → payload []
    expect(record?.allergens).toEqual([]);
    expect(record?.pF).toBe(true);
    expect(record?.pS).toBe(false);
  });
});

describe("CreateIngredientModal — garde anti-doublon", () => {
  it("un nom ressemblant à l'existant propose de l'utiliser et ferme sans créer", async () => {
    // Catalogue local (bridge) : le candidat à « utiliser » existe en Dexie
    await db.ingredients.bulkPut([
      makeIngredientRecord({ name: "Eau de source", type: "boissons" }),
    ]);
    const used: Array<{ name: string; ref: string }> = [];
    const { target, holder } = mountModal({
      onUseExisting: (i) => used.push(i as { name: string; ref: string }),
    });

    setInputValue(nameInput(target), "Eau");
    await waitForCondition(
      () =>
        target.textContent.includes("ressemble à des ingrédients existants"),
      "l'alerte anti-doublon s'affiche",
      100,
      flushSync,
    );

    // « Utiliser » l'existant proposé par le garde (libellé = nom surligné
    // + type en suffixe — matcher par le span de highlight)
    const useButton = Array.from(
      target.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.querySelector(".fuzzysort-highlight"));
    if (!useButton)
      throw new Error("Bouton « utiliser l'existant » introuvable");
    // Isolation : le faux PB garde les records des tests précédents du
    // fichier — la preuve « aucune création » est le compte inchangé.
    const recordsBefore = await pb.collection("ingredients").getFullList({});
    useButton.click();
    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après l'utilisation de l'existant",
      100,
      flushSync,
    );
    expect(used).toHaveLength(1);
    expect(used[0].name).toBe("Eau de source");
    expect(used[0].ref).toBe("t12ingref0001");
    expect(toastStub.success).toHaveBeenCalledWith(
      'Ingrédient "Eau de source" sélectionné',
    );
    // Aucune création : le catalogue serveur garde exactement son compte
    // (le ref généré n'apparaît pas)
    const records = (await pb
      .collection("ingredients")
      .getFullList({})) as Array<Record<string, unknown>>;
    expect(records).toHaveLength(recordsBefore.length);
  });
});
