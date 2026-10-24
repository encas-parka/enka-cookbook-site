/**
 * @vitest-environment jsdom
 */

/**
 * BtnGroupCheck — groupe de badges à bascule (retirer/réintégrer des
 * items d'une sélection).
 *
 * Contrats de données (ADR 0004) :
 *  - l'état initial vient des items (`selected ?? true` — un item sans
 *    préférence est actif) ;
 *  - la bascule délègue au parent via `onToggleItem(itemId)` — le
 *    composant possède l'état de bascule (contrairement à CheckboxBadge) ;
 *  - `showStats` affiche les comptes dérivés actifs/retirés/total ;
 *  - un item désactivé ne bascule pas.
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import BtnGroupCheck from "../BtnGroupCheck.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

const user = userEvent.setup();

const ITEMS = [
  { id: "tomates", label: "Tomates" },
  { id: "oignons", label: "Oignons", selected: false },
  { id: "ail", label: "Ail", disabled: true },
];

/** L'input checkbox porté par le libellé du badge. */
function checkboxFor(target: HTMLElement, label: string): HTMLInputElement {
  const span = getByText(target, ".label-text", label);
  const input = span.closest("label")?.querySelector("input");
  if (!input) throw new Error(`Checkbox « ${label} » introuvable`);
  return input as HTMLInputElement;
}

function mountGroup(extra: Record<string, unknown> = {}) {
  const onToggleItem = vi.fn();
  const target = mountSvelte(BtnGroupCheck, {
    items: ITEMS,
    onToggleItem,
    ...extra,
  });
  return { target, onToggleItem };
}

describe("BtnGroupCheck — bascule d'items", () => {
  afterEach(() => cleanupSvelte());

  it("l'état initial vient des items : selected ?? true", () => {
    const { target } = mountGroup();
    expect(checkboxFor(target, "Tomates").checked).toBe(true);
    expect(checkboxFor(target, "Oignons").checked).toBe(false);
    expect(checkboxFor(target, "Ail").checked).toBe(true);
  });

  it("la bascule appelle onToggleItem avec l'item basculé", async () => {
    const { target, onToggleItem } = mountGroup();
    await user.click(checkboxFor(target, "Oignons"));
    expect(onToggleItem).toHaveBeenCalledTimes(1);
    expect(onToggleItem).toHaveBeenCalledWith("oignons");
  });

  it("l'item basculé change d'état coché", async () => {
    const { target } = mountGroup();
    await user.click(checkboxFor(target, "Oignons"));
    expect(checkboxFor(target, "Oignons").checked).toBe(true);
  });

  it("un item désactivé ne bascule pas", async () => {
    const { target, onToggleItem } = mountGroup();
    expect(checkboxFor(target, "Ail").disabled).toBe(true);
    await user.click(checkboxFor(target, "Ail"));
    expect(onToggleItem).not.toHaveBeenCalled();
  });

  it("showStats affiche les comptes dérivés — la ligne « retirés » disparaît à 0", async () => {
    const { target } = mountGroup({ showStats: true });
    getByText(target, "span", "2 actifs");
    getByText(target, "span", "1 retirés");
    getByText(target, "span", "Total: 3 items");

    await user.click(checkboxFor(target, "Oignons"));
    getByText(target, "span", "3 actifs");
    // Comportement épinglé : la ligne « N retirés » n'est rendue que si
    // inactiveCount > 0 — elle disparaît à 0 plutôt que d'afficher « 0 ».
    expect(queryByText(target, "span", "0 retirés")).toBeNull();
  });
});
