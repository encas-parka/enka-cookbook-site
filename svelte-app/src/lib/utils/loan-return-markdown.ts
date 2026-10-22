/**
 * Export Markdown de la fiche de retour d'un emprunt.
 *
 * Fonction pure : l'export reflète l'état de saisie en cours (quantités
 * déclarées perdues / cassées), pas seulement l'état persisté de l'emprunt —
 * ce qui permet d'exporter la fiche avant validation.
 */

/** Ligne de la fiche de retour : un matériel et son état déclaré. */
export interface LoanReturnItem {
  materielName: string;
  /** Quantité empruntée. */
  quantity: number;
  /** Quantité déclarée perdue. */
  lostQuantity: number;
  /** Quantité déclarée cassée / à réparer. */
  brokenQuantity: number;
}

export interface LoanReturnMarkdownInput {
  responsibleName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  eventName?: string | null;
  items: LoanReturnItem[];
  notes?: string | null;
  /** Retour déjà enregistré ; absent = saisie en cours. */
  returnedAt?: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "?";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "?";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Quantité rendue OK : ce qui reste après pertes et cassures. */
export function okQuantity(item: LoanReturnItem): number {
  return Math.max(0, item.quantity - item.lostQuantity - item.brokenQuantity);
}

export function buildLoanReturnMarkdown(
  input: LoanReturnMarkdownInput,
): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push("# Fiche de retour");
  lines.push("");

  lines.push(`- **Responsable** : ${input.responsibleName || "?"}`);
  lines.push(
    `- **Période** : ${formatDate(input.startDate)} - ${formatDate(input.endDate)}`,
  );

  if (input.eventName) {
    lines.push(`- **Événement** : ${input.eventName}`);
  }

  lines.push(
    input.returnedAt
      ? `- **État** : retour enregistré le ${formatDate(input.returnedAt)}`
      : "- **État** : saisie en cours",
  );

  lines.push("");
  lines.push("## Matériels");
  lines.push("");

  if (input.items.length === 0) {
    lines.push("_Aucun matériel._");
    lines.push("");
  } else {
    lines.push("| Matériel | Emportés | OK | À réparer | Perdus |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const item of input.items) {
      lines.push(
        `| ${item.materielName} | ${item.quantity} | ${okQuantity(item)} | ${item.brokenQuantity} | ${item.lostQuantity} |`,
      );
    }
    lines.push("");
  }

  const notes = input.notes?.trim();
  if (notes) {
    lines.push("## Notes");
    lines.push("");
    lines.push(notes);
    lines.push("");
  }

  return lines.join("\n");
}
