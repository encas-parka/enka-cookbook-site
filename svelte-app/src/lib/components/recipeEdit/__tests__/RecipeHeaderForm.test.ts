/**
 * @vitest-environment jsdom
 */

/**
 * RecipeHeaderForm — l'en-tête d'édition recette (ADR 0004, V).
 *
 * Seam : vrai composant monté en jsdom, fixture `recipe` minimale (les props
 * sont typées `any` — la forme suit le patron MaterielCard : la forme ne lit
 * qu'un sous-ensemble des champs). Les modales de création enfants rendent
 * fermées ; le catalogue (recipeDataStore) est mocké à leur borne PB.
 *
 * Contrat épinglé (item checklist §4 « statut par défaut ») : la case
 * Brouillon est verrouillée tant que la recette n'est pas testée
 * (`recipe.check !== true`) et la règle est affichée — une recette non
 * testée est forcément conservée en brouillon. Le défaut `draft: true` est
 * posé par RecipeCreatePage ; le composant, lui, empêche de le décocher.
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

// Les modales de création enfants passent par ModalContainer → GlobalState
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
import RecipeHeaderForm from "../RecipeHeaderForm.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  queryByText,
} from "$lib/test/mount-svelte";

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "t12recipe000001",
    title: "Tarte aux pommes",
    description: null,
    plate: 6,
    quantite_desc: null,
    typeR: "dessert",
    categories: [],
    serveHot: null,
    cuisson: null,
    saison: [],
    region: null,
    materiel: [],
    check: false,
    draft: false,
    versionLabel: null,
    ...overrides,
  };
}

const recipeInfo = { categories: ["Desserts"], materiel: ["Four"] };

/** La case à cocher du bloc Brouillon (label contenant le texte « Brouillon »). */
function draftCheckbox(target: HTMLElement): HTMLInputElement {
  const checkbox = Array.from(
    target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).find((el) => el.closest("label")?.textContent?.includes("Brouillon"));
  if (!checkbox) throw new Error("Case Brouillon introuvable");
  return checkbox;
}

function mountForm(props: {
  recipe?: Record<string, unknown>;
  validationErrors?: Record<string, string>;
  canEdit?: boolean;
}) {
  const holder = bindableProps({
    recipe: props.recipe ?? makeRecipe(),
    recipeInfo,
    validationErrors: props.validationErrors ?? {},
    canEdit: props.canEdit ?? true,
  });
  const target = mountSvelte(RecipeHeaderForm, holder as never);
  return { target, holder };
}

describe("RecipeHeaderForm — règle brouillon (checklist §4)", () => {
  afterEach(() => cleanupSvelte());

  it("recette non testée : brouillon verrouillé et règle affichée", () => {
    const recipe = makeRecipe({ check: false, draft: false });
    const { target } = mountForm({ recipe });

    expect(draftCheckbox(target).disabled).toBe(true);
    expect(
      target.textContent.includes(
        "Une recette non testée est forcément conservée en brouillon",
      ),
    ).toBe(true);
  });

  it("recette testée : brouillon déverrouillé, la règle disparaît, la case écrit dans recipe", () => {
    const recipe = makeRecipe({ check: true, draft: false });
    const { target, holder } = mountForm({ recipe });

    const checkbox = draftCheckbox(target);
    expect(checkbox.disabled).toBe(false);
    expect(
      queryByText(
        target,
        "p",
        "Une recette non testée est forcément conservée en brouillon.",
      ),
    ).toBeNull();

    checkbox.click();
    expect(holder.recipe.draft).toBe(true);
  });
});

describe("RecipeHeaderForm — validation et lecture seule", () => {
  afterEach(() => cleanupSvelte());

  it("les erreurs de validation sont rendues sous les champs concernés", () => {
    const { target } = mountForm({
      recipe: makeRecipe({ title: "" }),
      validationErrors: {
        title: "Le titre est requis",
        check: "Indiquez si vous avez testé la recette",
      },
    });

    expect(target.textContent).toContain("Le titre est requis");
    expect(target.textContent).toContain(
      "Indiquez si vous avez testé la recette",
    );
    expect(target.querySelector(".input-error")).not.toBeNull();
  });

  it("hors édition (canEdit false) : saisies verrouillées, version affichée en badge", () => {
    const { target } = mountForm({
      recipe: makeRecipe({ versionLabel: "v1 - economique" }),
      canEdit: false,
    });

    const title = target.querySelector<HTMLInputElement>("#recipe-title");
    expect(title?.disabled).toBe(true);
    expect(draftCheckbox(target).disabled).toBe(true);
    expect(target.textContent).toContain("v1 - economique");
  });

  it("les compteurs de caractères suivent la saisie", () => {
    const { target } = mountForm({ recipe: makeRecipe({ title: "Houmous" }) });

    expect(target.textContent).toContain("7/80 caractères");
    const title = target.querySelector<HTMLInputElement>("#recipe-title");
    if (!title) throw new Error("Champ titre introuvable");
    title.value = "Houmous maison";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    expect(target.textContent).toContain("14/80 caractères");
  });
});
