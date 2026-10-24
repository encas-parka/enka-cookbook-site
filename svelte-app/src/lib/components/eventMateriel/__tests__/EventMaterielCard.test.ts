/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielCard — la carte de lecture d'un item : statut résolu
 * (resolveStatus du store, jamais persisté), compteur xN, notes
 * tronquées, actions conditionnelles (ADR 0004).
 *
 * Seam : vrai composant, fixture EventMateriel du harness. Le statut
 * migrate : un ancien item sans statut est résolu depuis `where` —
 * confirmé avec lieu, à trouver sans.
 */

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "testuser12345678",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("$lib/stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import {
  makeEventMaterielRecord,
  TEST_LOAN_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import type { EventMateriel } from "$lib/types/pb";
import EventMaterielCard from "../EventMaterielCard.svelte";
import { mountSvelte, cleanupSvelte } from "$lib/test/mount-svelte";

function mountCard(
  itemOverrides: Partial<EventMateriel> = {},
  props: Record<string, unknown> = {},
) {
  const onEdit = vi.fn();
  const onEditLoan = vi.fn();
  const target = mountSvelte(EventMaterielCard, {
    item: makeEventMaterielRecord(itemOverrides),
    onEdit,
    onEditLoan,
    ...props,
  });
  return { target, onEdit, onEditLoan };
}

/** Le badge de statut, dans la zone d'actions (après le badge de type). */
function statusBadge(target: HTMLElement): HTMLElement {
  const badge = target.querySelector<HTMLElement>(".ms-auto .badge");
  if (!badge) throw new Error("Badge de statut introuvable");
  return badge;
}

describe("EventMaterielCard — statut dérivé et affichage", () => {
  afterEach(() => cleanupSvelte());

  it("affiche le libellé du statut et le compteur xN au-delà de 1", () => {
    const { target } = mountCard({ status: "to_find", quantity: 5 });
    const badge = statusBadge(target);
    expect(badge.textContent).toContain("À trouver");
    expect(badge.textContent).toContain("x5");
  });

  it("pas de compteur pour une quantité 1", () => {
    const { target } = mountCard({ status: "confirmed", quantity: 1 });
    expect(statusBadge(target).textContent).toContain("Ok");
    expect(statusBadge(target).textContent).not.toContain("x1");
  });

  it("statut absent (migration) : résolu confirmé avec lieu, à trouver sans", () => {
    const withWhere = mountCard({ status: null, where: "Réserve" });
    expect(statusBadge(withWhere.target).textContent).toContain("Ok");

    const withoutWhere = mountCard({ status: null, where: null });
    expect(statusBadge(withoutWhere.target).textContent).toContain("À trouver");
  });

  it("lieu, qui et notes tronquées sont affichés ; un clic développe la note", () => {
    const longNote =
      "Une note volontairement longue au-delà de trente caractères.";
    const { target } = mountCard({
      who: "Jean",
      where: "Réserve cuisson",
      notes: longNote,
    });

    expect(target.textContent).toContain("Jean");
    expect(target.textContent).toContain("Réserve cuisson");
    // Tronquée à 30 caractères + ellipse
    expect(target.textContent).toContain(longNote.slice(0, 30) + "…");
    expect(target.textContent).not.toContain(longNote);

    target
      .querySelector<HTMLButtonElement>('button[title="Afficher la note"]')!
      .click();
    flushSync();
    expect(target.textContent).toContain(longNote);
  });
});

describe("EventMaterielCard — actions conditionnelles", () => {
  afterEach(() => cleanupSvelte());

  it("le clic carte édite, le bouton Éditer édite sans double déclenchement", () => {
    const item = makeEventMaterielRecord();
    const { target, onEdit } = mountCard({}, { item });

    target.querySelector<HTMLElement>('[role="button"]')!.click();
    flushSync();
    expect(onEdit).toHaveBeenCalledTimes(1);

    target
      .querySelector<HTMLButtonElement>('button[aria-label="Éditer"]')!
      .click();
    flushSync();
    // Le stopPropagation du bouton évite la remontée vers la carte
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  it("canEdit=false : pas de bouton Éditer et le clic carte est inerte", () => {
    const { target, onEdit } = mountCard({}, { canEdit: false });
    expect(target.querySelector('button[aria-label="Éditer"]')).toBeNull();
    target.querySelector<HTMLElement>('[role="button"]')!.click();
    flushSync();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("un item venu d'un emprunt propose la bascule vers la réservation", () => {
    const { target, onEditLoan } = mountCard(
      { loanId: TEST_LOAN_ID },
      { canUserEditLoan: true },
    );

    const loanButton = target.querySelector<HTMLButtonElement>(
      'button[aria-label="Modifier la réservation"]',
    );
    expect(loanButton).toBeTruthy();
    loanButton!.click();
    flushSync();
    expect(onEditLoan).toHaveBeenCalledWith(TEST_LOAN_ID);
  });

  it("sans l'accès à la réservation, pas de bouton de bascule", () => {
    const { target } = mountCard(
      { loanId: TEST_LOAN_ID },
      { canUserEditLoan: false },
    );
    expect(
      target.querySelector('button[aria-label="Modifier la réservation"]'),
    ).toBeNull();
  });
});
