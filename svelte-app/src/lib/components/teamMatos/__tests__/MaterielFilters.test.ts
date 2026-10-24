/**
 * @vitest-environment jsdom
 */

/**
 * MaterielFilters — le filtre d'inventaire parle les états dérivés
 * (MaterielDisplayState) et tient la source unique des libellés courts
 * (getMaterielDisplayStateShortLabel).
 *
 * Seam : vrai composant monté en jsdom, interactions via user-event.
 * Contrainte jsdom : sur un composant qui réassigne une prop $bindable,
 * un seul événement délégué par montage est fiable (voir ADR 0004) —
 * chaque scénario de bascule repart donc d'un montage frais.
 */

import { describe, it, expect, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { MaterielDisplayState } from "$lib/types/materiel.types";
import { getMaterielDisplayStateShortLabel } from "$lib/utils/materiel.utils";
import MaterielFilters from "../MaterielFilters.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";

const ALL_STATES: MaterielDisplayState[] = [
  "complete",
  "partial",
  "repair",
  "depleted",
  "loan",
  "reserved",
];

interface FiltersShape {
  types: string[];
  locations: string[];
  statuses: MaterielDisplayState[];
}

function mountFilters(initialStatuses: MaterielDisplayState[] = []) {
  const filters: FiltersShape = {
    types: [],
    locations: [],
    statuses: initialStatuses,
  };
  const target = mountSvelte(MaterielFilters, {
    filters,
    availableTypes: [],
    availableLocations: [],
    availableDisplayStates: ALL_STATES,
    onReset: () => {},
  });
  return { target, filters };
}

/** L'input checkbox porté par le libellé court de l'état. */
function stateCheckbox(
  target: HTMLElement,
  state: MaterielDisplayState,
): HTMLInputElement {
  const label = getByText(
    target,
    ".label-text",
    getMaterielDisplayStateShortLabel(state),
  );
  const input = label.closest("label")?.querySelector("input");
  if (!input) throw new Error(`Checkbox de l'état « ${state} » introuvable`);
  return input as HTMLInputElement;
}

const user = userEvent.setup();

describe("MaterielFilters — filtre par état dérivé", () => {
  afterEach(() => cleanupSvelte());

  it("propose les six états dérivés sous leurs libellés courts", () => {
    const { target, filters } = mountFilters();
    for (const state of ALL_STATES) {
      expect(stateCheckbox(target, state).checked).toBe(
        filters.statuses.includes(state),
      );
    }
  });

  it("rend cochés les états pré-sélectionnés (état initial fidèle)", () => {
    const { target } = mountFilters(["partial", "depleted"]);
    expect(stateCheckbox(target, "partial").checked).toBe(true);
    expect(stateCheckbox(target, "depleted").checked).toBe(true);
    expect(stateCheckbox(target, "repair").checked).toBe(false);
  });

  it("un clic ajoute l'état à filters.statuses", async () => {
    const { target, filters } = mountFilters();
    await user.click(stateCheckbox(target, "partial"));
    expect(filters.statuses).toEqual(["partial"]);
  });

  it("un clic sur un état déjà sélectionné le retire", async () => {
    const { target, filters } = mountFilters(["partial"]);
    await user.click(stateCheckbox(target, "partial"));
    expect(filters.statuses).toEqual([]);
  });

  it("les états pré-sélectionnés et le nouveau clic se cumulent", async () => {
    const { target, filters } = mountFilters(["repair"]);
    await user.click(stateCheckbox(target, "depleted"));
    expect(filters.statuses).toEqual(["repair", "depleted"]);
  });
});
