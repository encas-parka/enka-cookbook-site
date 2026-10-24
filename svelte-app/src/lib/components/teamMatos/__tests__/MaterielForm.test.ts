/**
 * @vitest-environment jsdom
 */

/**
 * MaterielForm — les gestes de réparation et les contrats du formulaire
 * (granularité des dommages, ADR 0004 pour l'approche).
 *
 * Seam : vrai composant monté en jsdom + vrai store (harness stub-pb +
 * fake-indexeddb). On épingle les contrats de données portés par l'UI :
 *  - les gestes n'apparaissent qu'en édition et si repairQuantity > 0
 *  - après un geste, le formulaire est resynchronisé sur la vérité du
 *    store : « Enregistrer » soumet l'état post-geste, jamais celui
 *    d'ouverture (sinon la réforme serait silencieusement annulée)
 *  - la garde du geste (n entier, 1 ≤ n ≤ repairQuantity) désactive
 *    les boutons
 *  - le rebut (quantity 0) est valide en édition seulement
 */

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
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForTick } from "$lib/stores/__tests__/harness/wait-for-tick";
import {
  makeMaterielRecord,
  TEST_MATERIEL_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import MaterielForm from "../MaterielForm.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

interface InitialValues {
  id: string;
  name: string;
  description: string | null;
  type: "other" | null;
  quantity: number;
  repairQuantity: number;
  location: string | null;
  shareableWith: string[] | null;
}

function makeInitialValues(
  overrides: Partial<InitialValues> = {},
): InitialValues {
  return {
    id: TEST_MATERIEL_ID,
    name: "Gastro 1/1",
    description: null,
    type: "other",
    quantity: 5,
    repairQuantity: 3,
    location: null,
    shareableWith: null,
    ...overrides,
  };
}

/**
 * Attend qu'une condition devienne vraie (chaîne async du geste : update
 * optimiste, liveQuery, resync du formulaire) — bien plus fiable qu'un
 * nombre de ticks figé ; échoue avec l'état atteint si timeout.
 */
async function waitForCondition(
  condition: () => boolean,
  description: string,
  maxTicks = 100,
): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    if (condition()) return;
    await waitForTick(1);
    flushSync();
  }
  throw new Error(`Timeout : ${description}`);
}

/** L'input quantité principale (celui sans aria-label du geste). */
function quantityInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[type="number"]:not([aria-label])',
  );
  if (!input) throw new Error("Input quantité introuvable");
  return input;
}

function gestureInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    '[aria-label="Quantité concernée par le geste"]',
  );
  if (!input) throw new Error("Input du geste introuvable");
  return input;
}

async function seedAndInitialize(repairQuantity: number, quantity: number) {
  currentFakePb().seed("materiel", [
    makeMaterielRecord({ quantity, repairQuantity }),
  ]);
  currentFakePb().seed("materiel_loan", []);
  await materielStore.initialize();
  await waitForTick(5);
}

/** État neuf : transport, spies, store et Dexie remis à zéro. */
async function resetMaterielState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  await materielStore.destroy();
  await clearDexie();
}

describe("MaterielForm — gestes de réparation", () => {
  beforeEach(resetMaterielState);

  afterEach(() => cleanupSvelte());

  it("affiche les gestes seulement en édition avec repairQuantity > 0", async () => {
    await seedAndInitialize(3, 5);
    const target = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues(),
    });
    expect(getByText(target, "button", "Réformer")).toBeTruthy();

    const withoutRepair = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues({ repairQuantity: 0 }),
    });
    expect(queryByText(withoutRepair, "button", "Réformer")).toBeNull();
  });

  it("la réforme resynchronise le formulaire : « Enregistrer » soumet l'état post-geste", async () => {
    await seedAndInitialize(3, 5);
    const submitted: Array<{ quantity: number }> = [];
    const target = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues(),
      onSubmit: (data: { quantity: number }) => submitted.push(data),
    });

    // Réformer 1 exemplaire (valeur par défaut du geste)
    getByText(target, "button", "Réformer").click();
    await waitForCondition(
      () => quantityInput(target).value === "4",
      "le formulaire se resync après la réforme",
    );
    // Le snapshot suit le store : quantité 4, plus que 2 en réparation
    expect(quantityInput(target).value).toBe("4");
    expect(gestureInput(target).max).toBe("2");

    // « Enregistrer » sans toucher aux champs : la quantité réformée
    // n'est PAS restaurée (le décrément de réforme est définitif)
    getByText(target, "button", "Enregistrer").click();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].quantity).toBe(4);
  });

  it("la remise en service redescend repairQuantity sans toucher la quantité", async () => {
    await seedAndInitialize(3, 5);
    const target = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues(),
    });

    getByText(target, "button", "Remettre en service").click();
    await waitForCondition(
      () => gestureInput(target).max === "2",
      "repairQuantity redescend après la remise en service",
    );
    expect(quantityInput(target).value).toBe("5");
  });

  it("garde du geste : bornes inclusives, hors bornes désactivé", async () => {
    await seedAndInitialize(3, 5);
    const target = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues(),
    });
    const reformer = getByText(
      target,
      "button",
      "Réformer",
    ) as HTMLButtonElement;

    // Borne haute inclusive : n = repairQuantity reste valide
    setInputValue(gestureInput(target), "3");
    expect(reformer.disabled).toBe(false);

    // Dépassement : désactivé
    setInputValue(gestureInput(target), "4");
    expect(reformer.disabled).toBe(true);

    // Borne basse : n = 0 invalide (le geste commence à 1)
    setInputValue(gestureInput(target), "0");
    expect(reformer.disabled).toBe(true);

    // Valeur valide : réactivé
    setInputValue(gestureInput(target), "2");
    expect(reformer.disabled).toBe(false);
  });
});

describe("MaterielForm — rebut et validation", () => {
  beforeEach(resetMaterielState);

  afterEach(() => cleanupSvelte());

  it("quantité 0 valide en édition (rebut re-sauvable)", async () => {
    await seedAndInitialize(0, 0);
    const submitted: Array<{ quantity: number }> = [];
    const target = mountSvelte(MaterielForm, {
      initialValues: makeInitialValues({ quantity: 0, repairQuantity: 0 }),
      onSubmit: (data: { quantity: number }) => submitted.push(data),
    });

    const save = getByText(
      target,
      "button",
      "Enregistrer",
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    save.click();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].quantity).toBe(0);
  });

  it("en création, le stock commence à 1 et les gestes n'existent pas", () => {
    const target = mountSvelte(MaterielForm, {});
    expect(quantityInput(target).min).toBe("1");
    expect(quantityInput(target).value).toBe("1");
    // L'aide au rebut n'a de sens qu'en édition
    expect(target.textContent).not.toContain("0 = au rebut");
    // Les gestes sont un contrat d'édition : absents en création
    expect(queryByText(target, "button", "Réformer")).toBeNull();
    expect(queryByText(target, "button", "Remettre en service")).toBeNull();
  });
});
