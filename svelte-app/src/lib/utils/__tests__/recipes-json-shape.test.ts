import { describe, it, expect } from "vitest";

import { parseIngredients } from "../ingredientUtils";
import { parseAstuces } from "../recipeUtils";

/**
 * Boucle de diagnostic P1-recipes (handoff click-through 26-10-07).
 *
 * Vérifie que les lecteurs de json recette tolèrent le shape natif PB
 * (post re-import T17) ET le legacy Appwrite (string[] double-encodé).
 * Attendu : VERT — ces parsers ont déjà été rendus tolérants ; ce test
 * verrouille le contrat et écarte les parsers de la liste des suspects.
 */
const NATIVE_INGREDIENT = {
  ref: "ail",
  name: "Ail",
  originalQuantity: 2,
  originalUnit: "g",
  normalizedQuantity: 2,
  normalizedUnit: "g",
  comment: "",
  allergens: [],
  type: "ingredient",
};

/** Shape natif réellement en DB post re-import T17 : identifiant `uuid`, pas `ref`. */
const T17_NATIVE_INGREDIENT = {
  allergens: [],
  comment: "",
  name: "Ail",
  normalizedQuantity: 39,
  normalizedUnit: "gr.",
  originalQuantity: 6,
  originalUnit: "gousse·s",
  pF: true,
  pS: false,
  type: "legumes",
  uuid: "u2m28w",
};

describe("parseIngredients — double shape (natif PB + legacy)", () => {
  it("accepte un array natif PB (objets avec ref)", () => {
    expect(parseIngredients([NATIVE_INGREDIENT] as any)).toEqual([
      NATIVE_INGREDIENT,
    ]);
  });

  it("accepte le natif re-import T17 (identifiant uuid) et normalise vers ref", () => {
    expect(parseIngredients([T17_NATIVE_INGREDIENT] as any)).toEqual([
      { ...T17_NATIVE_INGREDIENT, ref: "u2m28w" },
    ]);
  });

  it("accepte le legacy string[] contenant du uuid-shape (double normalisation)", () => {
    expect(
      parseIngredients([JSON.stringify(T17_NATIVE_INGREDIENT)] as any),
    ).toEqual([{ ...T17_NATIVE_INGREDIENT, ref: "u2m28w" }]);
  });

  it("retourne [] pour un objet sans ref ni uuid (filtre silencieux)", () => {
    expect(parseIngredients([{ name: "Mystère" }] as any)).toEqual([]);
  });

  it("accepte le legacy Appwrite string[] (chaque item est un JSON string)", () => {
    expect(
      parseIngredients([JSON.stringify(NATIVE_INGREDIENT)] as any),
    ).toEqual([NATIVE_INGREDIENT]);
  });

  it("retourne [] pour null/undefined/champ string (sans lever)", () => {
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients(undefined)).toEqual([]);
    expect(parseIngredients('["x"]' as any)).toEqual([]);
  });
});

describe("parseAstuces — double shape (natif PB + legacy)", () => {
  it("accepte un array natif PB (objets avec astuce)", () => {
    expect(parseAstuces([{ astuce: "Saler à froid" }] as any)).toEqual([
      { astuce: "Saler à froid" },
    ]);
  });

  it("accepte le legacy string[] (chaque string devient une astuce)", () => {
    expect(parseAstuces(["Saler à froid"] as any)).toEqual([
      { astuce: "Saler à froid" },
    ]);
  });

  it("décode le legacy double-encodé par item (string JSON {astuce})", () => {
    expect(
      parseAstuces(['{"astuce":"Servir avec de la sauce chili"}'] as any),
    ).toEqual([{ astuce: "Servir avec de la sauce chili" }]);
  });

  it("fallback texte brut pour une string { non-JSON ou sans astuce", () => {
    expect(parseAstuces(["{not json"] as any)).toEqual([
      { astuce: "{not json" },
    ]);
    expect(parseAstuces(['{"foo":"bar"}'] as any)).toEqual([
      { astuce: '{"foo":"bar"}' },
    ]);
  });

  it("retourne [] pour null/undefined (sans lever)", () => {
    expect(parseAstuces(null)).toEqual([]);
    expect(parseAstuces(undefined)).toEqual([]);
  });
});
