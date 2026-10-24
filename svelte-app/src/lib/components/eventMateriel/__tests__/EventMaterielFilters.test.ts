/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielFilters — l'état de filtre $bindable (ADR 0004).
 *
 * Seam : vrai composant monté en jsdom, interactions via user-event.
 * Le filtre mute les tableaux imbriqués puis réassigne `filters` : le
 * test joue le parent avec un proxy $state (bindableProps) pour lire la
 * remontée. Chaque scénario de bascule repart d'un montage frais
 * (contrainte jsdom, ADR 0004).
 *
 * Les libellés viennent des sources uniques (getMaterielTypeConfig /
 * getEventMaterielStatusConfig) : les asserts portent ces libellés, pas
 * des codes bruts.
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

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { flushSync } from "svelte";
import EventMaterielFilters from "../EventMaterielFilters.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

interface FiltersState {
  types: string[];
  statuses: string[];
  who: string[];
  where: string[];
  search: string;
}

function makeFilters(overrides: Partial<FiltersState> = {}): FiltersState {
  return {
    types: [],
    statuses: [],
    who: [],
    where: [],
    search: "",
    ...overrides,
  };
}

const user = userEvent.setup();

function mountFilters(
  filters: FiltersState = makeFilters(),
  props: Record<string, unknown> = {},
) {
  const onReset = vi.fn();
  const holder = bindableProps({
    filters,
    availableTypes: ["electronic", "cooking"],
    availableStatuses: ["to_find", "to_check", "confirmed"],
    availableWho: ["Jean"],
    availableWhere: ["Réserve"],
    onReset,
    disabled: false,
    ...props,
  });
  const target = mountSvelte(EventMaterielFilters, holder as never);
  return { target, holder, onReset };
}

/** La checkbox portée par le libellé d'un badge, dans un fieldset donné. */
function checkboxByLabel(
  target: HTMLElement,
  label: string,
  scope?: HTMLElement,
): HTMLInputElement {
  const root = scope ?? target;
  const span = getByText(root, ".label-text", label);
  const input = span.closest("label")?.querySelector("input");
  if (!input) throw new Error(`Badge « ${label} » introuvable`);
  return input as HTMLInputElement;
}

/** Le fieldset d'une section (Type, Statut, Qui ?, Où ?). */
function section(target: HTMLElement, legend: string): HTMLElement {
  const fieldset = getByText(target, "legend", legend).closest("fieldset");
  if (!fieldset) throw new Error(`Section « ${legend} » introuvable`);
  return fieldset;
}

describe("EventMaterielFilters — état $bindable", () => {
  afterEach(() => cleanupSvelte());

  it("la recherche est écrite dans filters.search", () => {
    const { target, holder } = mountFilters();
    const search =
      target.querySelector<HTMLInputElement>('input[type="text"]')!;
    setInputValue(search, "percolateur");
    expect(holder.filters.search).toBe("percolateur");
  });

  it("cocher un type l'ajoute à filters.types", async () => {
    const { target, holder } = mountFilters();
    await user.click(checkboxByLabel(target, "Électronique"));
    expect(holder.filters.types).toEqual(["electronic"]);
    expect(checkboxByLabel(target, "Électronique").checked).toBe(true);
  });

  it("cocher un statut l'ajoute à filters.statuses (libellé de la source unique)", async () => {
    const { target, holder } = mountFilters();
    await user.click(checkboxByLabel(target, "À vérifier"));
    expect(holder.filters.statuses).toEqual(["to_check"]);
  });

  it("l'option « Personne » filtre les items sans qui (__none__)", async () => {
    const { target, holder } = mountFilters();
    await user.click(checkboxByLabel(target, "Personne"));
    expect(holder.filters.who).toEqual(["__none__"]);
  });

  it("l'option « À trouver » filtre les items sans où (__none__) — facettes where, pas statut", async () => {
    const { target, holder } = mountFilters();
    // « À trouver » existe aussi comme statut : scoper à la section Où ?
    await user.click(
      checkboxByLabel(target, "À trouver", section(target, "Où ?")),
    );
    expect(holder.filters.where).toEqual(["__none__"]);
    expect(holder.filters.statuses).toEqual([]);
  });
});

describe("EventMaterielFilters — reset et disponibilité", () => {
  afterEach(() => cleanupSvelte());

  it("Effacer appelle onReset (le parent possède la remise à zéro)", async () => {
    const { target, onReset } = mountFilters();
    await user.click(getByText(target, "button", "Effacer"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("les sections Qui/Où disparaissent sans valeurs disponibles", () => {
    const { target } = mountFilters(makeFilters(), {
      availableWho: [],
      availableWhere: [],
    });
    expect(target.textContent).not.toContain("Qui ?");
    expect(target.textContent).not.toContain("Où ?");
    // Types et statuts toujours là
    expect(target.textContent).toContain("Type");
    expect(target.textContent).toContain("Statut");
  });

  it("disabled rend les contrôles inertes", () => {
    const { target } = mountFilters(makeFilters(), { disabled: true });
    expect(checkboxByLabel(target, "Électronique").disabled).toBe(true);
    expect(
      (getByText(target, "button", "Effacer") as HTMLButtonElement).disabled,
    ).toBe(true);
    const search =
      target.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(search.disabled).toBe(true);
  });
});
