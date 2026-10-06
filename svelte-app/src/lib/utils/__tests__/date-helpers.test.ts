import { describe, it, expect } from "vitest";
import { toInputDate, extractDate } from "../date-helpers";

describe("toInputDate", () => {
  it("extrait la date du format PocketBase (séparateur espace)", () => {
    expect(toInputDate("2026-05-08 00:00:00.000Z")).toBe("2026-05-08");
    expect(toInputDate("2026-12-31 14:30:00.123Z")).toBe("2026-12-31");
  });

  it("extrait la date du format ISO 8601 (séparateur T)", () => {
    expect(toInputDate("2026-05-08T00:00:00.000Z")).toBe("2026-05-08");
    expect(toInputDate("2026-05-08T22:15:00")).toBe("2026-05-08");
  });

  it("laisse une date YYYY-MM-DD pure inchangée (idempotent)", () => {
    expect(toInputDate("2026-05-08")).toBe("2026-05-08");
  });

  it("renvoie une chaîne vide pour une valeur vide, null ou non-date", () => {
    expect(toInputDate("")).toBe("");
    expect(toInputDate(null)).toBe("");
    expect(toInputDate(undefined)).toBe("");
    expect(toInputDate("pas-une-date")).toBe("");
  });
});

describe("extractDate", () => {
  it("reste compatible avec les datetimes ISO `T` (JSON repas écrit côté client)", () => {
    expect(extractDate("2026-10-14T20:00:00.000Z")).toBe("2026-10-14");
  });

  it("extrait aussi la date des records PocketBase (espace)", () => {
    expect(extractDate("2026-05-08 00:00:00.000Z")).toBe("2026-05-08");
  });
});
