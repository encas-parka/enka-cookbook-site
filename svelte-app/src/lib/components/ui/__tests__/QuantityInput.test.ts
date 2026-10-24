/**
 * @vitest-environment jsdom
 */

/**
 * QuantityInput — saisie quantité + unité (ingrédients, matériels).
 *
 * Contrats de données (ADR 0004) :
 *  - bornage natif de la saisie : type=number, min=0, step=1, required —
 *    une quantité négative ou fractionnaire est invalide au niveau du
 *    champ, pas au niveau du composant ;
 *  - `quantity` et `unit` remontent au parent ($bindable) ; champ vidé,
 *    la quantité vaut null (pas 0 — 0 est le rebut, glossaire matériel) ;
 *  - l'unité propose la source unique QUANTITY_UNITS derrière un
 *    placeholder « - ».
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage. La
 * remontée au parent passe par `bindableProps` (proxy `$state` — `mount()`
 * seul n'écrit pas en retour).
 */

import { describe, it, expect, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import QuantityInput from "../QuantityInput.svelte";
import { QUANTITY_UNITS } from "$lib/constants/units";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const user = userEvent.setup();

interface Holder {
  quantity: number | null;
  unit: string;
  disabled?: boolean;
}

function mountQuantityInput(initial: Partial<Holder> = {}) {
  const holder = bindableProps<Holder>({
    quantity: null,
    unit: "",
    disabled: false,
    ...initial,
  });
  const target = mountSvelte(QuantityInput, holder);
  return { target, holder };
}

function quantityInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="number"]');
  if (!input) throw new Error("Input quantité introuvable");
  return input;
}

function unitSelect(target: HTMLElement): HTMLSelectElement {
  const select = target.querySelector("select");
  if (!select) throw new Error("Select unité introuvable");
  return select;
}

describe("QuantityInput — bornage et liaison quantité/unité", () => {
  afterEach(() => cleanupSvelte());

  it("borne la saisie au natif : nombre, min 0, pas entier, requis", () => {
    const { target } = mountQuantityInput({ quantity: 2 });
    const input = quantityInput(target);
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.step).toBe("1");
    expect(input.required).toBe(true);
    expect(input.getAttribute("aria-required")).toBe("true");
  });

  it("la quantité saisie remonte au parent en nombre", () => {
    const { target, holder } = mountQuantityInput();
    setInputValue(quantityInput(target), "3");
    expect(holder.quantity).toBe(3);
  });

  it("champ vidé, la quantité vaut null — distinct du rebut (0)", () => {
    const { target, holder } = mountQuantityInput({ quantity: 3 });
    setInputValue(quantityInput(target), "");
    expect(holder.quantity).toBeNull();
  });

  it("propose la source unique des unités derrière un placeholder", () => {
    const { target } = mountQuantityInput();
    const select = unitSelect(target);
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", ...QUANTITY_UNITS.map((u) => u.value)]);
  });

  it("l'unité choisie remonte au parent", async () => {
    const { target, holder } = mountQuantityInput({ unit: "" });
    await user.selectOptions(unitSelect(target), "kg");
    expect(holder.unit).toBe("kg");
  });

  it("disabled gèle les deux champs", () => {
    const { target } = mountQuantityInput({ quantity: 1, disabled: true });
    expect(quantityInput(target).disabled).toBe(true);
    expect(unitSelect(target).disabled).toBe(true);
  });

  it("l'étiquette d'unité est portée par le libellé de la source unique", () => {
    const { target } = mountQuantityInput();
    getByText(target, "option", QUANTITY_UNITS[0].label);
  });
});
