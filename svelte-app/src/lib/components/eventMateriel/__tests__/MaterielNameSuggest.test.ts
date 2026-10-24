/**
 * @vitest-environment jsdom
 */

/**
 * MaterielNameSuggest — les suggestions du champ nom : besoins existants
 * de l'event d'abord, catalogue ensuite, dédupliqués par nom, préfixe
 * prioritaire (ADR 0004).
 *
 * Seam : vrai composant + vrai EventMaterielStore (stub-pb). La prop
 * `value` est contrôlée par le parent : le test joue ce rôle avec un
 * proxy $state (bindableProps) réécrit par `onInput`, exactement comme
 * EventMaterielForm le fait.
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
  makeEventMaterielRecord,
  TEST_EVENT_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
import MaterielNameSuggest from "../MaterielNameSuggest.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const CATALOG_ITEM = "Gastro 1/1 (10cm)";

async function resetState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  await eventMaterielStore.destroy();
  await clearDexie();
}

async function seedHeader(name: string, quantity = 5) {
  currentFakePb().seed("event_materiel", [
    makeEventMaterielRecord({ name, quantity, type: "cooking" }),
  ]);
  await eventMaterielStore.initializeForEvent(TEST_EVENT_ID);
  await waitForTick(5);
}

/**
 * Monte le suggesteur en jouant le parent contrôleur : `onInput`
 * réécrit `value` dans le proxy $state (le composant re-reçoit la
 * valeur, ses suggestions dérivent).
 */
function mountSuggest(props: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const holder = bindableProps({
    value: "",
    onSelect,
    onInput: (_v: string) => {},
    hasError: false,
    ...props,
  });
  holder.onInput = (v: string) => {
    holder.value = v;
  };
  const target = mountSvelte(MaterielNameSuggest, holder as never);
  const input = target.querySelector<HTMLInputElement>('input[type="text"]')!;
  return { target, onSelect, input };
}

function dropdown(target: HTMLElement): HTMLUListElement | null {
  return target.querySelector<HTMLUListElement>('ul[role="listbox"]');
}

/** Les noms suggérés, dans l'ordre du rendu. */
function suggestionNames(target: HTMLElement): string[] {
  return [...dropdown(target)!.querySelectorAll("span.flex-1")].map(
    (s) => s.textContent?.trim() ?? "",
  );
}

describe("MaterielNameSuggest — suggestions dérivées", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("moins de deux caractères : pas de suggestions", () => {
    const { target, input } = mountSuggest();
    setInputValue(input, "g");
    expect(dropdown(target)).toBeNull();
  });

  it("le besoin existant précède le catalogue, porteur du badge « Existant » et du compteur", async () => {
    await seedHeader("Gastro personnel");
    const { target, input } = mountSuggest();
    setInputValue(input, "gast");

    const names = suggestionNames(target);
    expect(names[0]).toBe("Gastro personnel");
    expect(names).toContain(CATALOG_ITEM);
    const headerButton = getByText(target, "span", "Gastro personnel").closest(
      "button",
    )!;
    expect(headerButton.textContent).toContain("Existant");
    expect(headerButton.textContent).toContain("x5");
  });

  it("un besoin existant éclipse l'item de catalogue de même nom (déduplication)", async () => {
    await seedHeader("Table Pliante Bois", 3);
    const { target, input } = mountSuggest();
    setInputValue(input, "Table Pliante");

    const names = suggestionNames(target);
    // Le besoin existant éclipse l'item de catalogue de même nom,
    // l'autre item de catalogue qui matche reste proposé
    expect(names).toEqual(["Table Pliante Bois", "Table Pliante Plastique"]);
    const button = getByText(target, "span", "Table Pliante Bois").closest(
      "button",
    )!;
    expect(button.textContent).toContain("Existant");
  });

  it("aucune correspondance : pas de dropdown", () => {
    const { target, input } = mountSuggest();
    setInputValue(input, "zz aucun match");
    expect(dropdown(target)).toBeNull();
  });
});

describe("MaterielNameSuggest — sélection remontée", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("choisir un besoin existant remonte source header + itemId", async () => {
    await seedHeader("Gastro personnel");
    const { target, onSelect, input } = mountSuggest();
    setInputValue(input, "gast");

    getByText(target, "span", "Gastro personnel").closest("button")!.click();
    flushSync();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Gastro personnel",
        source: "header",
        alreadyExists: true,
        itemId: eventMaterielStore.headers[0].id,
      }),
    );
  });

  it("choisir un item de catalogue remonte source catalog, sans itemId", () => {
    const { target, onSelect, input } = mountSuggest();
    setInputValue(input, "gast");

    getByText(target, "span", CATALOG_ITEM).closest("button")!.click();
    flushSync();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: CATALOG_ITEM,
        source: "catalog",
      }),
    );
  });

  it("Échap referme le dropdown", () => {
    const { target, input } = mountSuggest();
    setInputValue(input, "gast");
    expect(dropdown(target)).toBeTruthy();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    flushSync();
    expect(dropdown(target)).toBeNull();
  });
});
