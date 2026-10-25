/**
 * @vitest-environment jsdom
 */

/**
 * RecipePrepaForm — ingrédients, préparation markdown et astuces (ADR 0004, W).
 *
 * Seam : vrai composant + vrai MarkdownEditor (TipTap) + vrai
 * RecipeIngredientsEditor, sur un stub-pb vide (le catalogue d'ingrédients
 * est initialisé par l'effet de l'éditeur mais reste vide — hors contrat
 * ici, voir RecipeIngredientsEditor.test). La saisie dans TipTap est
 * pilotée par le canal réel DOMObserver (mutation DOM + event input) —
 * sonde de lot 5 : TipTap monte et écrit en jsdom.
 *
 * Contrats épinglés :
 *  - « + Ajouter une astuce » pousse { astuce: "" } dans recipe.astuces
 *  - la saisie d'une astuce écrit dans recipe.astuces[i] (compteur / 250)
 *  - le retrait filtre la ligne
 *  - la saisie dans l'éditeur markdown écrit recipe.preparation ($bindable)
 *  - l'erreur de validation « ingrédients » ne s'affiche qu'à liste vide
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

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("$lib/stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import RecipePrepaForm from "../RecipePrepaForm.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  queryByText,
} from "$lib/test/mount-svelte";

interface PrepaRecipe {
  [key: string]: unknown;
  ingredients: unknown[];
  preparation: string;
  preparation24h: string | null;
  astuces: Array<{ astuce: string }>;
}

function makeRecipe(overrides: Partial<PrepaRecipe> = {}): PrepaRecipe {
  return {
    ingredients: [],
    preparation: "",
    preparation24h: null,
    astuces: [],
    ...overrides,
  };
}

function mountForm(
  recipe: PrepaRecipe,
  options: {
    validationErrors?: Record<string, unknown>;
    canEdit?: boolean;
  } = {},
) {
  const holder = bindableProps({
    recipe,
    validationErrors: options.validationErrors ?? {},
    canEdit: options.canEdit ?? true,
  }) as unknown as {
    recipe: PrepaRecipe;
    validationErrors: Record<string, unknown>;
    canEdit: boolean;
  };
  const target = mountSvelte(RecipePrepaForm, holder as never);
  return { target, holder };
}

function addAstuceButton(target: HTMLElement): HTMLButtonElement {
  const button = Array.from(
    target.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.includes("Ajouter une astuce"));
  if (!button) throw new Error("Bouton « Ajouter une astuce » introuvable");
  return button;
}

describe("RecipePrepaForm — astuces", () => {
  afterEach(() => cleanupSvelte());

  it("« + Ajouter une astuce » pousse une astuce vide comptée 0/250", () => {
    const recipe = makeRecipe();
    const { target, holder } = mountForm(recipe);

    expect(target.textContent).toContain("Aucune astuce ajoutée");
    addAstuceButton(target).click();
    flushSync();

    expect(holder.recipe.astuces).toHaveLength(1);
    expect(holder.recipe.astuces[0].astuce).toBe("");
    expect(target.textContent).toContain("0 / 250");
    expect(queryByText(target, "p", "Aucune astuce ajoutée")).toBeNull();
  });

  it("la saisie d'une astuce écrit dans recipe.astuces[i]", () => {
    const recipe = makeRecipe({ astuces: [{ astuce: "" }] });
    const { target, holder } = mountForm(recipe);

    const textarea = target.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Textarea d'astuce introuvable");
    textarea.value = "Un filet d'huile d'olive au moment de servir";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();

    expect(holder.recipe.astuces[0].astuce).toBe(
      "Un filet d'huile d'olive au moment de servir",
    );
    expect(target.textContent).toContain("44 / 250");
  });

  it("le retrait filtre la ligne d'astuce", () => {
    const recipe = makeRecipe({
      astuces: [{ astuce: "Première" }, { astuce: "Seconde" }],
    });
    const { target, holder } = mountForm(recipe);

    const remove = Array.from(
      target.querySelectorAll<HTMLButtonElement>(
        'button[title="Supprimer l\'astuce"]',
      ),
    );
    expect(remove).toHaveLength(2);
    remove[0].click();
    flushSync();

    expect(holder.recipe.astuces.map((a) => a.astuce)).toEqual(["Seconde"]);
  });

  it("hors édition, la gestion des astuces est verrouillée", () => {
    const recipe = makeRecipe();
    const { target } = mountForm(recipe, { canEdit: false });

    expect(addAstuceButton(target).disabled).toBe(true);
  });
});

describe("RecipePrepaForm — éditeur markdown", () => {
  afterEach(() => cleanupSvelte());

  it("la saisie dans TipTap écrit recipe.preparation (canal DOMObserver)", async () => {
    const recipe = makeRecipe({ preparation: "Étape 1." });
    const { target, holder } = mountForm(recipe);

    const surface = target.querySelector<HTMLElement>(
      "#recipe-preparation .tiptap",
    );
    if (!surface) throw new Error("Surface TipTap préparation introuvable");
    expect(surface.textContent).toContain("Étape 1");

    // Saisie : mutation DOM externe + event input (canal réel ProseMirror)
    surface.textContent = "Étape 1. Étape 2.";
    surface.dispatchEvent(new Event("input", { bubbles: true }));

    await waitForCondition(
      () => holder.recipe.preparation.includes("Étape 2"),
      "recipe.preparation suit la saisie markdown",
      100,
      flushSync,
    );
  });
});

describe("RecipePrepaForm — validation ingrédients", () => {
  afterEach(() => cleanupSvelte());

  it("l'erreur « ingrédients » ne s'affiche qu'à liste vide", () => {
    const empty = makeRecipe();
    const emptyTarget = mountForm(empty, {
      validationErrors: { ingredients: "Ajoutez au moins un ingrédient" },
    }).target;
    expect(emptyTarget.textContent).toContain("Ajoutez au moins un ingrédient");
    cleanupSvelte();

    const filled = makeRecipe({
      ingredients: [
        {
          ref: "eau0001",
          name: "Eau",
          originalQuantity: 1,
          originalUnit: "l.",
          normalizedQuantity: 1000,
          normalizedUnit: "ml",
          comment: "",
          allergens: [],
          type: "autres",
        },
      ],
    });
    const filledTarget = mountForm(filled, {
      validationErrors: { ingredients: "Ajoutez au moins un ingrédient" },
    }).target;
    expect(
      filledTarget.textContent.includes("Ajoutez au moins un ingrédient"),
    ).toBe(false);
  });
});
