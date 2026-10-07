import { describe, it, expect } from "vitest";

import { safeJsonParse } from "../productsUtils";

/**
 * Boucle de diagnostic P1 (handoff click-through 26-10-07) — shape JSON du
 * champ json `products.*` après le re-import T17.
 *
 * Le re-import écrit du JSON natif (objets/arrays), l'ancien import écrivait
 * du JSON double-encodé (chaînes). Le lecteur `safeJsonParse` doit tolérer
 * les deux shapes sans lever (son garde `jsonString?.trim()` est hors du
 * try/catch : un objet natif lève un TypeError qui remonte à l'enrichissement
 * et casse les pages products).
 */
describe("safeJsonParse — double shape (natif PB + legacy double-encodé)", () => {
  it("parse une chaîne JSON (legacy double-encodé)", () => {
    expect(safeJsonParse('{"storeName":"asf"}')).toEqual({ storeName: "asf" });
  });

  it("parse un tableau JSON stringifié (legacy)", () => {
    expect(safeJsonParse('[{"q":2,"u":"l"}]')).toEqual([{ q: 2, u: "l" }]);
  });

  it("retourne null pour null / vide / whitespace", () => {
    expect(safeJsonParse(null)).toBeNull();
    expect(safeJsonParse("")).toBeNull();
    expect(safeJsonParse("   ")).toBeNull();
  });

  it("retourne null pour une chaîne invalide (sans lever)", () => {
    expect(safeJsonParse("{not json")).toBeNull();
  });

  it("accepte un objet natif PB tel quel (shape post re-import T17)", () => {
    expect(safeJsonParse({ storeName: "asf" })).toEqual({ storeName: "asf" });
  });

  it("accepte un array natif PB tel quel (shape post re-import T17)", () => {
    const native = [{ allergens: [], name: "Ail" }];
    expect(safeJsonParse(native)).toEqual(native);
  });

  it("retourne null pour undefined", () => {
    expect(safeJsonParse(undefined)).toBeNull();
  });
});
