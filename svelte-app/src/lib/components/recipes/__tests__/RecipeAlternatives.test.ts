/**
 * @vitest-environment jsdom
 */

/**
 * RecipeAlternatives — le renvoi aux préparations alternatives (ADR 0004, D).
 *
 * Seam : composant pur (pas de store) — l'index est passé en prop, une Map
 * minimale `{ n: string }` suffit (c'est le seul champ lu).
 *
 * Le fallback « Recette inconnue » est le symptôme du bug backlogé
 * `.scratch/tracker/backlog/26-10-24_recette-inconnue-recipe-detail.md` :
 * un uuid d'alternative absent de l'index au rendu (cache froid, recette
 * supprimée, ref cassée) affiche ce libellé sur la fiche publique. C'est le
 * COMPORTEMENT ACTUEL qui est épinglé — le fix futur (qualifier la cause et
 * corriger, cf. reco du backlog) mettra ce test à jour, pas l'inverse
 * (patron MaterielCard.test, décision checklist §12-8).
 */

import { describe, it, expect, afterEach } from "vitest";
import RecipeAlternatives from "../RecipeAlternatives.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

const KNOWN_UUID = "banoffee_uw7nq3h3hzob";
const UNKNOWN_UUID = "uuid_manquant_1";
const KNOWN_NAME = "Banoffee Pie";

const index = new Map<string, { n: string }>([[KNOWN_UUID, { n: KNOWN_NAME }]]);

function mountAlternatives(
  alternatives: Array<{ recetteAlt: string }>,
  recipesIndex: Map<string, { n: string }> = index,
) {
  return mountSvelte(RecipeAlternatives, { alternatives, recipesIndex });
}

describe("RecipeAlternatives — renvoi aux alternatives", () => {
  afterEach(() => cleanupSvelte());

  it("sans alternative, rien ne se rend", () => {
    const target = mountAlternatives([]);
    expect(queryByText(target, "*", "Préparation(s) alternative(s) :")).toBe(
      null,
    );
  });

  it("un uuid connu de l'index affiche son nom et pointe vers la fiche", () => {
    const target = mountAlternatives([{ recetteAlt: KNOWN_UUID }]);
    getByText(target, "h4", "Préparation(s) alternative(s) :");
    const link = getByText(target, "a", KNOWN_NAME);
    expect(link.getAttribute("href")).toBe(`/recipe/${KNOWN_UUID}`);
  });

  it("BUG épinglé : un uuid absent de l'index affiche « Recette inconnue »", () => {
    const target = mountAlternatives([{ recetteAlt: UNKNOWN_UUID }]);
    // Comportement actuel (backlog 26-10-24_recette-inconnue-recipe-detail) :
    // le fallback masque le lien réel — l'utilisateur ne sait PAS quelle
    // préparation alternative la fiche propose. Le fix remontera le nom.
    const link = getByText(target, "a", "Recette inconnue");
    expect(link.getAttribute("href")).toBe(`/recipe/${UNKNOWN_UUID}`);
  });

  it("les alternatives mixtes (connue + inconnue) rendent une ligne chacune", () => {
    const target = mountAlternatives([
      { recetteAlt: KNOWN_UUID },
      { recetteAlt: UNKNOWN_UUID },
    ]);
    const links = Array.from(target.querySelectorAll("a"));
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      KNOWN_NAME,
      "Recette inconnue",
    ]);
  });
});
