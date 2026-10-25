/**
 * @vitest-environment jsdom
 */

/**
 * RecipeIngredientsEditor — l'ajout d'ingrédients à une recette (ADR 0004, W/L).
 *
 * Seam : vrai composant + vrai recipeDataStore + stub-pb + fake-indexeddb.
 * L'effet de montage appelle `initialize()` si besoin — l'initPromise du
 * singleton est collante, le store est donc initialisé UNE fois par fichier
 * (test 1 l'épingle) et les tests suivants re-seedent la table Dexie
 * directement : le bridge liveQuery répercute le catalogue dans le store.
 *
 * Contrats épinglés :
 *  - le montage initialise le catalogue (chargement → recherche disponible)
 *  - la recherche fuzzy filtre, la sélection ajoute une ligne RecipeIngredient
 *    (ref, nom, type, allergènes depuis le catalogue) et referme le menu
 *  - la sélection au clavier (↓ puis Entrée) passe par le même chemin
 *  - les lignes sont groupées par type et retirables
 *  - « aucun résultat » propose de créer un ingrédient (prérempli du mot saisi)
 *  - disabled verrouille la recherche
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

// La modale de création enfant passe par ModalContainer → GlobalState
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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import { db } from "$lib/db-sync/pb-sync";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import {
  makeIngredientRecord,
  TEST_INGREDIENT_REF,
} from "$lib/stores/__tests__/harness/fixtures";
import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
import type { RecipeIngredient } from "$lib/types/recipes.types";
import RecipeIngredientsEditor from "../RecipeIngredientsEditor.svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
} from "$lib/test/mount-svelte";

const EAU_REF = TEST_INGREDIENT_REF;
const FARINE_REF = "f4rine0000000";

function seedCatalogue(): void {
  currentFakePb().reset();
  currentFakePb().seed("ingredients", [
    makeIngredientRecord({
      ref: EAU_REF,
      name: "Eau de source",
      type: "autres",
    }),
    makeIngredientRecord({
      id: "t12ingred002",
      ref: FARINE_REF,
      name: "Farine T55",
      type: "sec",
    }),
  ]);
}

/** Ligne RecipeIngredient telle que portée par recipes.ingredients. */
function makeRow(name: string, ref: string, type: string): RecipeIngredient {
  return {
    ref,
    name,
    originalQuantity: 0,
    originalUnit: "gr.",
    normalizedQuantity: 0,
    normalizedUnit: "gr.",
    comment: "",
    allergens: [],
    type,
  };
}

interface MountOptions {
  ingredients?: RecipeIngredient[];
  disabled?: boolean;
}

function mountEditor(options: MountOptions = {}) {
  const holder = bindableProps({
    ingredients: options.ingredients ?? [],
    disabled: options.disabled ?? false,
  }) as unknown as {
    ingredients: RecipeIngredient[];
    disabled: boolean;
  };
  const target = mountSvelte(RecipeIngredientsEditor, holder as never);
  return { target, holder };
}

function searchInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[role="combobox"]',
  );
  if (!input) throw new Error("Champ de recherche introuvable");
  return input;
}

function optionsList(target: HTMLElement): HTMLElement[] {
  return Array.from(target.querySelectorAll('[role="option"]'));
}

beforeEach(async () => {
  vi.restoreAllMocks();
  toastStub.reset();
  seedCatalogue();
  await clearDexie();
});
afterEach(() => cleanupSvelte());

describe("RecipeIngredientsEditor — initialisation du catalogue", () => {
  it("le montage initialise le store puis propose le catalogue au chevron", async () => {
    const { target } = mountEditor();
    expect(recipeDataStore.isInitialized).toBe(false);

    // Effet d'init : loading puis catalogue chargé depuis le serveur factice
    await waitForCondition(
      () => recipeDataStore.isInitialized,
      "le catalogue s'initialise au montage",
      100,
      flushSync,
    );

    const chevron = getByTextAttribute(
      target,
      "button",
      "aria-label",
      "Ouvrir le menu",
    );
    chevron.click();
    flushSync();

    await waitForCondition(
      () => optionsList(target).length === 2,
      "le menu déroulant liste le catalogue",
      100,
      flushSync,
    );
    expect(target.textContent).toContain("Eau de source");
    expect(target.textContent).toContain("Farine T55");
  });
});

describe("RecipeIngredientsEditor — ajout par recherche", () => {
  it("la recherche fuzzy filtre ; la sélection crée la ligne depuis le catalogue", async () => {
    await db.ingredients.bulkPut([
      makeIngredientRecord({
        ref: EAU_REF,
        name: "Eau de source",
        type: "autres",
      }),
      makeIngredientRecord({
        id: "t12ingred002",
        ref: FARINE_REF,
        name: "Farine T55",
        type: "sec",
      }),
    ]);
    const { target, holder } = mountEditor();
    await waitForCondition(
      () => recipeDataStore.count >= 2,
      "le catalogue est répliqué dans le store",
      100,
      flushSync,
    );

    setInputValue(searchInput(target), "Eau");
    await waitForCondition(
      () => optionsList(target).length === 1,
      "la recherche filtre sur « Eau »",
      100,
      flushSync,
    );

    optionsList(target)[0].click();
    flushSync();

    expect(holder.ingredients).toHaveLength(1);
    expect(holder.ingredients[0].ref).toBe(EAU_REF);
    expect(holder.ingredients[0].name).toBe("Eau de source");
    expect(holder.ingredients[0].originalUnit).toBe("gr.");
    expect(toastStub.success).toHaveBeenCalled();
    // Le menu se referme et le champ est vidé pour la saisie suivante
    expect(optionsList(target)).toHaveLength(0);
    expect(searchInput(target).value).toBe("");
  });

  it("la sélection au clavier (↓ puis Entrée) passe par le même ajout", async () => {
    await db.ingredients.bulkPut([
      makeIngredientRecord({
        ref: EAU_REF,
        name: "Eau de source",
        type: "autres",
      }),
    ]);
    const { target, holder } = mountEditor();
    await waitForCondition(
      () => recipeDataStore.count >= 1,
      "le catalogue est répliqué dans le store",
      100,
      flushSync,
    );

    const input = searchInput(target);
    setInputValue(input, "Eau");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();

    expect(holder.ingredients).toHaveLength(1);
    expect(holder.ingredients[0].ref).toBe(EAU_REF);
  });
});

describe("RecipeIngredientsEditor — lignes et retrait", () => {
  it("les ingrédients sont groupés par type et retirables", () => {
    const { target, holder } = mountEditor({
      ingredients: [
        makeRow("Eau de source", EAU_REF, "autres"),
        makeRow("Farine T55", FARINE_REF, "sec"),
      ],
    });

    // Groupes par type (libellés produits), un badge de compte par groupe
    expect(target.textContent).toContain("Autres");
    expect(target.textContent).toContain("Produits Sec");
    const removeButtons = target.querySelectorAll(
      'button[title="Supprimer cet ingrédient"]',
    );
    expect(removeButtons).toHaveLength(2);

    removeButtons[1].dispatchEvent(new Event("click", { bubbles: true }));
    flushSync();

    expect(holder.ingredients).toHaveLength(1);
    expect(holder.ingredients[0].ref).toBe(EAU_REF);
  });
});

describe("RecipeIngredientsEditor — création depuis la recherche", () => {
  it("aucun résultat → proposer de créer, la modale s'ouvre préremplie du mot saisi", async () => {
    const { target } = mountEditor();
    await waitForCondition(
      () => recipeDataStore.isInitialized,
      "le catalogue est prêt",
      100,
      flushSync,
    );

    setInputValue(searchInput(target), "Xyzzynonexistant");
    await waitForCondition(
      () => target.textContent.includes("Aucun ingrédient trouvé"),
      "le message d'absence de résultat s'affiche",
      100,
      flushSync,
    );

    getByTextAttribute(
      target,
      "button",
      "type",
      "button",
      "Créer un nouvel ingrédient...",
    ).click();
    flushSync();

    const dialog = modalDialog(target);
    expect(dialog).not.toBeNull();
    const nameInput = dialog?.querySelector<HTMLInputElement>(
      "#ingredient-name-input",
    );
    expect(nameInput?.value).toBe("Xyzzynonexistant");
  });
});

describe("RecipeIngredientsEditor — lecture seule", () => {
  it("disabled verrouille la recherche et le menu", () => {
    const { target } = mountEditor({
      ingredients: [makeRow("Eau de source", EAU_REF, "autres")],
      disabled: true,
    });

    expect(searchInput(target).disabled).toBe(true);
    const chevron = getByTextAttribute(
      target,
      "button",
      "aria-label",
      "Ouvrir le menu",
    );
    chevron.click();
    flushSync();
    expect(optionsList(target)).toHaveLength(0);
  });
});

/** Premier élément du sélecteur portant l'attribut/valeur donnés. */
function getByTextAttribute(
  root: HTMLElement,
  selector: string,
  attribute: string,
  value: string,
  text?: string,
): HTMLElement {
  const el = Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
    (candidate) =>
      candidate.getAttribute(attribute) === value &&
      (text === undefined || candidate.textContent?.includes(text)),
  );
  if (!el) {
    throw new Error(
      `Aucun « ${selector} » avec ${attribute}="${value}"${text ? ` et le texte « ${text} »` : ""}`,
    );
  }
  return el;
}
