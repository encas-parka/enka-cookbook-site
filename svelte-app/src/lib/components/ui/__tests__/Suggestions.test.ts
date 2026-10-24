/**
 * @vitest-environment jsdom
 */

/**
 * Suggestions — puces d'aide à la saisie (création rapide d'ingrédients,
 * catégories…).
 *
 * Contrats de données (ADR 0004) :
 *  - clic → `onSuggestionClick` reçoit la suggestion cliquée ;
 *  - une suggestion désactivée (déjà sélectionnée) ne déclenche rien ;
 *  - `maxSuggestions` borne la liste affichée (dérivation) ;
 *  - liste vide → rien ne se rend.
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import Suggestions from "../Suggestions.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

const user = userEvent.setup();

function makeSuggestions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `sug-${i + 1}`,
    label: `Suggestion ${i + 1}`,
  }));
}

describe("Suggestions — puces de saisie", () => {
  afterEach(() => cleanupSvelte());

  it("liste vide : rien ne se rend", () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: [],
      onSuggestionClick,
    });
    expect(target.querySelectorAll("button")).toHaveLength(0);
  });

  it("rend une puce par suggestion et transmet la suggestion cliquée", async () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: [
        { id: "a", label: "Tomate" },
        { id: "b", label: "Oignon" },
      ],
      onSuggestionClick,
    });
    await user.click(getByText(target, "button", "Tomate"));
    expect(onSuggestionClick).toHaveBeenCalledTimes(1);
    expect(onSuggestionClick).toHaveBeenCalledWith({
      id: "a",
      label: "Tomate",
    });
  });

  it("une suggestion désactivée ne déclenche pas le callback", async () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: [{ id: "a", label: "Tomate", disabled: true }],
      onSuggestionClick,
    });
    const btn = getByText(target, "button", "Tomate");
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(onSuggestionClick).not.toHaveBeenCalled();
  });

  it("maxSuggestions borne la liste affichée", () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: makeSuggestions(5),
      maxSuggestions: 2,
      onSuggestionClick,
    });
    expect(target.querySelectorAll("button")).toHaveLength(2);
  });

  it("disabled global désactive toutes les puces", () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: makeSuggestions(2),
      onSuggestionClick,
      disabled: true,
    });
    for (const btn of target.querySelectorAll("button")) {
      expect(btn.disabled).toBe(true);
    }
  });

  it("affiche le titre fourni", () => {
    const onSuggestionClick = vi.fn();
    const target = mountSvelte(Suggestions, {
      suggestions: makeSuggestions(1),
      title: "Ajouts rapides",
      onSuggestionClick,
    });
    getByText(target, "div", "Ajouts rapides");
    expect(queryByText(target, "div", "Autre titre")).toBeNull();
  });
});
