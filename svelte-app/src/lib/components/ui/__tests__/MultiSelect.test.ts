/**
 * @vitest-environment jsdom
 */

/**
 * MultiSelect — sélection multiple avec recherche (filtres, tags).
 *
 * Contrats de données (ADR 0004) :
 *  - `selected` est $bindable : ajouter/retirer une option remonte la
 *    nouvelle liste au parent, et `onChange` la reçoit en même temps ;
 *  - la recherche filtre les options (inclut, insensible à la casse) ;
 *  - Backspace sur champ vide retire la dernière sélection ; Échap ferme
 *    le menu ;
 *  - sans correspondance, « Aucune option disponible » puis l'action de
 *    création (`onCreateNew`), qui ferme le menu.
 *
 * Seam : vrai composant monté en jsdom, une interaction déléguée par
 * montage (l'ouverture passe par le focus, canal non délégué).
 * Remontée via `bindableProps`.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { flushSync } from "svelte";
import MultiSelect from "../MultiSelect.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const user = userEvent.setup();

const OPTIONS = ["Alpha", "Bêta", "Gamma"];

interface Holder {
  selected: string[];
  options: string[];
  disabled?: boolean;
}

interface Mounted {
  target: HTMLElement;
  holder: Holder;
  onChange: ReturnType<typeof vi.fn>;
  input: HTMLInputElement;
}

function mountMultiSelect(
  initial: Partial<Holder> = {},
  extra: Record<string, unknown> = {},
): Mounted {
  const onChange = vi.fn();
  // Toutes les props dans le même objet $state — étaler le proxy dans un
  // littéral `{ onChange, ...holder }` romprait la remontée.
  const holder = bindableProps<Holder & { onChange: typeof onChange }>({
    selected: [],
    options: OPTIONS,
    onChange,
    ...initial,
    ...extra,
  });
  const target = mountSvelte(MultiSelect, holder);
  const input = target.querySelector<HTMLInputElement>(
    'input[role="combobox"]',
  );
  if (!input) throw new Error("Input combobox introuvable");
  return { target, holder, onChange, input };
}

/** Ouvre le menu par le focus (canal non délégué) et vérifie le rendu. */
function open({ target, input }: Mounted): void {
  input.focus();
  flushSync();
  expect(target.querySelector('[role="listbox"]')).not.toBeNull();
}

function optionButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    target.querySelectorAll<HTMLButtonElement>('[role="option"]'),
  );
}

describe("MultiSelect — sélection multiple", () => {
  afterEach(() => cleanupSvelte());

  it("fermé au montage ; le focus ouvre le menu avec toutes les options", () => {
    const mounted = mountMultiSelect();
    expect(mounted.target.querySelector('[role="listbox"]')).toBeNull();
    open(mounted);
    expect(optionButtons(mounted.target)).toHaveLength(3);
  });

  it("cliquer une option l'ajoute à selected, notifie onChange et affiche le badge", async () => {
    const mounted = mountMultiSelect();
    open(mounted);
    const { target, holder, onChange } = mounted;

    await user.click(getByText(target, "button", "Alpha"));
    expect(holder.selected).toEqual(["Alpha"]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["Alpha"]);
    getByText(target, ".badge", "Alpha");
  });

  it("cliquer une option déjà sélectionnée la retire", async () => {
    const mounted = mountMultiSelect({ selected: ["Alpha", "Gamma"] });
    open(mounted);
    const { target, holder, onChange } = mounted;

    await user.click(getByText(target, "button", "Alpha"));
    expect(holder.selected).toEqual(["Gamma"]);
    expect(onChange).toHaveBeenCalledWith(["Gamma"]);
  });

  it("la croix du badge retire l'option et notifie onChange", async () => {
    const mounted = mountMultiSelect({ selected: ["Alpha", "Gamma"] });
    const { target, holder, onChange, input } = mounted;

    const remove = target.querySelector<HTMLButtonElement>(
      'button[aria-label="Supprimer Alpha"]',
    );
    if (!remove) throw new Error("Bouton de suppression du badge introuvable");
    await user.click(remove);
    expect(holder.selected).toEqual(["Gamma"]);
    expect(onChange).toHaveBeenCalledWith(["Gamma"]);
    void input;
  });

  it("la recherche filtre les options (insensible à la casse)", () => {
    const mounted = mountMultiSelect();
    const { target, input } = mounted;
    input.focus();
    flushSync();

    setInputValue(input, "alp");
    expect(optionButtons(target)).toHaveLength(1);
    expect(optionButtons(target)[0].textContent).toContain("Alpha");
  });

  it("sans correspondance : message vide et action de création qui ferme le menu", async () => {
    const onCreateNew = vi.fn();
    const mounted = mountMultiSelect({}, { onCreateNew });
    const { target, input } = mounted;
    input.focus();
    flushSync();

    setInputValue(input, "inconnu");
    getByText(target, "div", "Aucune option disponible");
    getByText(target, "button", "Créer...");

    await user.click(getByText(target, "button", "Créer..."));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[role="listbox"]')).toBeNull();
  });

  it("Échap ferme le menu", () => {
    const mounted = mountMultiSelect();
    const { target, input } = mounted;
    input.focus();
    flushSync();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    flushSync();
    expect(target.querySelector('[role="listbox"]')).toBeNull();
  });

  it("Backspace sur champ vide retire la dernière sélection", async () => {
    const mounted = mountMultiSelect({ selected: ["Alpha", "Gamma"] });
    const { target, holder, input } = mounted;
    input.focus();
    flushSync();

    await user.keyboard("{Backspace}");
    expect(holder.selected).toEqual(["Alpha"]);
    expect(queryByText(target, ".badge", "Gamma")).toBeNull();
  });

  it("disabled : le menu ne s'ouvre pas", () => {
    const mounted = mountMultiSelect({ disabled: true });
    mounted.input.focus();
    flushSync();
    expect(mounted.target.querySelector('[role="listbox"]')).toBeNull();
  });
});
