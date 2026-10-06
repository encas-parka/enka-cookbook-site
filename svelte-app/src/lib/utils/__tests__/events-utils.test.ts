import { describe, it, expect, vi } from "vitest";
import { getEventDates } from "../events.utils";

// La chaîne d'imports d'events.utils (safe-operation) tire le service runes,
// non compilé par vitest — même mock que productEnrichment.test.ts
vi.mock("$lib/services/toast.service.svelte", () => ({
  toastService: { track: vi.fn() },
}));

describe("getEventDates", () => {
  it("retourne les dates stockées dans le JSON `date` (triées, dédupliquées)", () => {
    const result = getEventDates({
      date: ["2026-10-14T20:00:00.000Z", "2026-10-12T12:00:00.000Z", "2026-10-14T20:00:00.000Z"],
      meals: [],
    });
    expect(result).toEqual([
      "2026-10-12T12:00:00.000Z",
      "2026-10-14T20:00:00.000Z",
    ]);
  });

  it("retombe sur les dates des repas quand `date` est vide", () => {
    const result = getEventDates({
      date: null,
      meals: [
        { date: "2026-11-01T19:00:00.000Z" },
        { date: "2026-10-30T12:00:00.000Z" },
      ],
    });
    expect(result).toEqual([
      "2026-10-30T12:00:00.000Z",
      "2026-11-01T19:00:00.000Z",
    ]);
  });

  it("retombe sur les repas quand `date` est absent ou non-tableau", () => {
    expect(getEventDates({ meals: [{ date: "2026-12-24T20:00:00.000Z" }] })).toEqual([
      "2026-12-24T20:00:00.000Z",
    ]);
    expect(getEventDates({ date: "n'est pas un tableau", meals: [] })).toEqual([]);
  });

  it("ignore les dates de repas vides", () => {
    const result = getEventDates({
      date: null,
      meals: [{ date: "" }, { date: "2026-10-20T12:00:00.000Z" }],
    });
    expect(result).toEqual(["2026-10-20T12:00:00.000Z"]);
  });

  it("retourne un tableau vide sans date ni repas", () => {
    expect(getEventDates({ date: null, meals: [] })).toEqual([]);
    expect(getEventDates({})).toEqual([]);
  });
});
