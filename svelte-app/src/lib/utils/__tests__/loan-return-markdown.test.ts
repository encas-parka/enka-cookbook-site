import { describe, it, expect } from "vitest";
import {
  buildLoanReturnMarkdown,
  okQuantity,
  type LoanReturnItem,
} from "../loan-return-markdown";

function makeItem(overrides: Partial<LoanReturnItem> = {}): LoanReturnItem {
  return {
    materielName: "Réchaud",
    quantity: 2,
    lostQuantity: 0,
    brokenQuantity: 0,
    ...overrides,
  };
}

describe("okQuantity", () => {
  it("déduit les unités OK des pertes et cassures", () => {
    expect(okQuantity(makeItem({ quantity: 5 }))).toBe(5);
    expect(
      okQuantity(makeItem({ quantity: 5, lostQuantity: 2, brokenQuantity: 1 })),
    ).toBe(2);
  });

  it("ne descend jamais sous zéro", () => {
    expect(
      okQuantity(makeItem({ quantity: 2, lostQuantity: 3, brokenQuantity: 1 })),
    ).toBe(0);
  });
});

describe("buildLoanReturnMarkdown", () => {
  it("exporte l'état de saisie en cours", () => {
    const md = buildLoanReturnMarkdown({
      responsibleName: "Geo",
      startDate: "2026-06-12T00:00:00Z",
      endDate: "2026-06-15T00:00:00Z",
      items: [makeItem()],
    });

    expect(md).toContain("# Fiche de retour");
    expect(md).toContain("**Responsable** : Geo");
    expect(md).toContain("**État** : saisie en cours");
    expect(md).toContain("| Réchaud | 2 | 2 | 0 | 0 |");
  });

  it("porte les pertes et cassures déclarées", () => {
    const md = buildLoanReturnMarkdown({
      items: [makeItem({ quantity: 4, lostQuantity: 1, brokenQuantity: 2 })],
    });

    expect(md).toContain("| Réchaud | 4 | 1 | 2 | 1 |");
  });

  it("annonce un retour enregistré et ses notes", () => {
    const md = buildLoanReturnMarkdown({
      items: [makeItem()],
      notes: "Réchaud fendu,Angle cassé.",
      returnedAt: "2026-06-16T10:00:00Z",
    });

    expect(md).toContain("**État** : retour enregistré le");
    expect(md).toContain("## Notes");
    expect(md).toContain("Réchaud fendu");
  });

  it("n'ajoute pas de section notes quand il n'y en a pas", () => {
    const md = buildLoanReturnMarkdown({
      items: [makeItem()],
      notes: "   ",
    });

    expect(md).not.toContain("## Notes");
  });

  it("signale une liste de matériels vide", () => {
    const md = buildLoanReturnMarkdown({ items: [] });

    expect(md).toContain("_Aucun matériel._");
  });
});
