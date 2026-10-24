/**
 * @vitest-environment jsdom
 */

/**
 * AutocompleteInput — champ à complétion floue (fuzzysort).
 *
 * Contrats de données (ADR 0004) :
 *  - le focus à champ vide liste tous les items (showAllOnFocus) ;
 *  - la saisie filtre par recherche floue et surligne les correspondances
 *    (<mark>) ;
 *  - sélection (clic ou Entrée sur l'item surligné) → `onSelect` reçoit
 *    l'item ET le champ se vide (prêt pour la saisie suivante) ;
 *  - requête sans résultat → « Aucun résultat trouvé » ;
 *  - `minQueryLength` gate la recherche (pas de liste, pas de message).
 *
 * Seam : vrai composant monté en jsdom, une interaction déléguée par
 * montage (le focus est un canal non délégué). blur arme un délai de
 * 150 ms — les scénarios n'en dépendent pas.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { flushSync } from "svelte";
import AutocompleteInput from "../AutocompleteInput.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";

const user = userEvent.setup();

const ITEMS = ["Pomme", "Poire", "Carotte"];

function mountAutocomplete(props: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const target = mountSvelte(AutocompleteInput, {
    items: ITEMS,
    onSelect,
    ...props,
  });
  const input = target.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error("Input de recherche introuvable");
  return { target, onSelect, input };
}

function results(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>("ul button"));
}

describe("AutocompleteInput — complétion floue", () => {
  afterEach(() => cleanupSvelte());

  it("focus à champ vide : tous les items listés (showAllOnFocus)", () => {
    const { target, input } = mountAutocomplete();
    input.focus();
    flushSync();
    expect(results(target)).toHaveLength(3);
  });

  it("la saisie filtre en flou et surligne la correspondance", () => {
    const { target, input } = mountAutocomplete();
    input.focus();
    flushSync();

    setInputValue(input, "pom");
    const buttons = results(target);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("Pomme");
    expect(buttons[0].querySelector("span")?.innerHTML).toContain("<mark>");
  });

  it("un clic sur un résultat appelle onSelect et vide le champ", async () => {
    const { target, onSelect, input } = mountAutocomplete();
    input.focus();
    flushSync();

    await user.click(getByText(target, "button", "Pomme"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Pomme");
    expect(input.value).toBe("");
  });

  it("Entrée sélectionne l'item surligné", async () => {
    const { onSelect, input } = mountAutocomplete();
    input.focus();
    flushSync();

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Pomme");
  });

  it("ArrowDown déplace la sélection, Entrée confirme le nouvel item", async () => {
    const { onSelect, input } = mountAutocomplete();
    input.focus();
    flushSync();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("Poire");
  });

  it("requête sans résultat : « Aucun résultat trouvé »", () => {
    const { target, input } = mountAutocomplete();
    input.focus();
    flushSync();

    setInputValue(input, "choucroute");
    getByText(target, "div", "Aucun résultat trouvé");
  });

  it("minQueryLength gate la recherche : ni liste ni message en dessous", () => {
    const { target, input } = mountAutocomplete({ minQueryLength: 3 });
    input.focus();
    flushSync();

    setInputValue(input, "po");
    expect(results(target)).toHaveLength(0);
    expect(target.textContent).not.toContain("Aucun résultat trouvé");
  });
});
