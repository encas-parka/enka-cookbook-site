/**
 * @vitest-environment jsdom
 */

/**
 * CheckboxBadge — badge à case (filtres, sélection d'items).
 *
 * Contrat de données (ADR 0004) : le composant est contrôlé — il ne
 * possède pas l'état ; un clic délègue au parent via `onchange` (une
 * fois), et l'état coché affiché vient de la prop `checked`. Le badge
 * numérique optionnel est affiché.
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import CheckboxBadge from "../CheckboxBadge.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

const user = userEvent.setup();

function mountCheckboxBadge(props: Record<string, unknown> = {}) {
  const onchange = vi.fn();
  const target = mountSvelte(CheckboxBadge, {
    checked: false,
    label: "Légumes",
    onchange,
    ...props,
  });
  return { target, onchange };
}

/** L'input checkbox porté par le libellé du badge. */
function checkbox(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!input) throw new Error("Checkbox introuvable");
  return input;
}

describe("CheckboxBadge — badge contrôlé", () => {
  afterEach(() => cleanupSvelte());

  it("reflète l'état coché reçu en prop", () => {
    const { target } = mountCheckboxBadge({ checked: true });
    expect(checkbox(target).checked).toBe(true);
  });

  it("un clic délègue au parent via onchange — une fois", async () => {
    const { target, onchange } = mountCheckboxBadge();
    await user.click(checkbox(target));
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  it("disabled neutralise le clic", async () => {
    const { target, onchange } = mountCheckboxBadge({ disabled: true });
    expect(checkbox(target).disabled).toBe(true);
    await user.click(checkbox(target));
    expect(onchange).not.toHaveBeenCalled();
  });

  it("affiche le badge numérique optionnel", () => {
    const { target } = mountCheckboxBadge({ badge: "3" });
    getByText(target, ".badge", "3");
  });

  it("pas de badge rendu sans la prop", () => {
    const { target } = mountCheckboxBadge();
    expect(queryByText(target, ".badge", "3")).toBeNull();
  });

  it("le tooltip optionnel est posé sur le libellé", () => {
    const { target } = mountCheckboxBadge({ title: "Produits frais" });
    const label = getByText(target, "label", "Légumes");
    expect(label.getAttribute("title")).toBe("Produits frais");
  });
});
