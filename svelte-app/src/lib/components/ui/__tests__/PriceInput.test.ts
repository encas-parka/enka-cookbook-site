/**
 * @vitest-environment jsdom
 */

/**
 * PriceInput — saisie d'un prix (achats).
 *
 * Contrat de données (ADR 0004) : bornage natif (nombre, min 0, pas de
 * centime via step=1) et remontée $bindable ; champ vidé, la valeur vaut
 * null (prix inconnu), distinct de 0 (gratuit).
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage. La
 * remontée au parent passe par `bindableProps` (proxy `$state` — `mount()`
 * seul n'écrit pas en retour).
 */

import { describe, it, expect, afterEach } from "vitest";
import PriceInput from "../PriceInput.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

interface Holder {
  value: number | null;
  disabled?: boolean;
}

function mountPriceInput(initial: Partial<Holder> = {}) {
  const holder = bindableProps<Holder>({
    value: null,
    disabled: false,
    ...initial,
  });
  const target = mountSvelte(PriceInput, holder);
  return { target, holder };
}

function priceInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="number"]');
  if (!input) throw new Error("Input prix introuvable");
  return input;
}

describe("PriceInput — bornage et liaison du prix", () => {
  afterEach(() => cleanupSvelte());

  it("borne la saisie au natif : nombre, min 0", () => {
    const { target } = mountPriceInput();
    const input = priceInput(target);
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.step).toBe("1");
    expect(input.placeholder).toBe("0.00");
  });

  it("le prix saisi remonte au parent en nombre", () => {
    const { target, holder } = mountPriceInput();
    setInputValue(priceInput(target), "12.5");
    expect(holder.value).toBe(12.5);
  });

  it("champ vidé, le prix vaut null — distinct de 0 (gratuit)", () => {
    const { target, holder } = mountPriceInput({ value: 12.5 });
    setInputValue(priceInput(target), "");
    expect(holder.value).toBeNull();
  });

  it("disabled gèle la saisie", () => {
    const { target } = mountPriceInput({ value: 3, disabled: true });
    expect(priceInput(target).disabled).toBe(true);
  });
});
