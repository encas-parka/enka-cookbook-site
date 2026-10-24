/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielBadgeStatus — les compteurs dérivés d'un groupe besoin +
 * allocations, portés par les badges cliquables (ADR 0004).
 *
 * Seam : vrai composant, fixture MaterielGroup minimale locale (patron
 * MaterielCard.test). `resolveStatus` vient du vrai store singleton :
 * vi.mock("pocketbase") suffit à l'instancier, aucune écriture n'est
 * attendue (les badges remontent au parent).
 *
 * Comportement épinglé : le libellé long (« Manque : N ») vit dans un
 * span masqué sur mobile — en jsdom les deux variantes sont rendues,
 * l'assert porte le span libellé.
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
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import {
  makeEventMaterielRecord,
  TEST_EM_HEADER_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import type { MaterielGroup } from "$lib/types/event-materiel.types";
import EventMaterielBadgeStatus from "../EventMaterielBadgeStatus.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";

function makeGroup(overrides: Partial<MaterielGroup> = {}): MaterielGroup {
  return {
    header: makeEventMaterielRecord({
      id: TEST_EM_HEADER_ID,
      name: "Tables pliantes",
      quantity: 5,
    }),
    allocations: [],
    remainingQty: 5,
    totalAllocated: 0,
    ...overrides,
  };
}

function mountBadgeStatus(group: MaterielGroup) {
  const onEditHeader = vi.fn();
  const onAddAllocation = vi.fn();
  const target = mountSvelte(EventMaterielBadgeStatus, {
    group,
    onEditHeader,
    onAddAllocation,
  });
  return { target, onEditHeader, onAddAllocation };
}

/** Le bouton badge porté par son libellé long (span masqué sur mobile). */
function badgeButton(target: HTMLElement, label: string): HTMLButtonElement {
  return getByText(target, "span", label).closest(
    "button",
  ) as HTMLButtonElement;
}

describe("EventMaterielBadgeStatus — compteurs dérivés", () => {
  afterEach(() => cleanupSvelte());

  it("Manque = remainingQty, vérifier/Ok somment les allocations par statut résolu", () => {
    const { target } = mountBadgeStatus(
      makeGroup({
        allocations: [
          makeEventMaterielRecord({
            id: "t12evem00000003",
            status: "to_check",
            quantity: 2,
            groupId: TEST_EM_HEADER_ID,
            who: "Jean",
          }),
          makeEventMaterielRecord({
            id: "t12evem00000004",
            status: "confirmed",
            quantity: 3,
            groupId: TEST_EM_HEADER_ID,
            where: "Réserve",
          }),
        ],
        remainingQty: 0,
        totalAllocated: 5,
      }),
    );

    expect(getByText(target, "span", "Manque: 0")).toBeTruthy();
    expect(getByText(target, "span", "vérifier: 2")).toBeTruthy();
    expect(getByText(target, "span", "Ok: 3")).toBeTruthy();
  });

  it("un statut inconnu (migration) est résolu depuis where : Ok avec lieu, à trouver sans", () => {
    const { target } = mountBadgeStatus(
      makeGroup({
        allocations: [
          makeEventMaterielRecord({
            id: "t12evem00000003",
            status: null,
            quantity: 2,
            groupId: TEST_EM_HEADER_ID,
            where: "Réserve",
          }),
        ],
        remainingQty: 3,
        totalAllocated: 2,
      }),
    );

    // status null + where → confirmé ; le manque lit la prop du groupe
    expect(getByText(target, "span", "Ok: 2")).toBeTruthy();
    expect(getByText(target, "span", "Manque: 3")).toBeTruthy();
  });

  it("le badge Manque porte la classe d'alerte seulement s'il reste un manque", () => {
    const { target } = mountBadgeStatus(makeGroup({ remainingQty: 3 }));
    expect(
      badgeButton(target, "Manque: 3").classList.contains("btn-error"),
    ).toBe(true);

    cleanupSvelte();
    const { target: filled } = mountBadgeStatus(makeGroup({ remainingQty: 0 }));
    expect(
      badgeButton(filled, "Manque: 0").classList.contains("btn-error"),
    ).toBe(false);
  });
});

describe("EventMaterielBadgeStatus — clics remontés au parent", () => {
  afterEach(() => cleanupSvelte());

  it("Manque → éditer le besoin ; vérifier/Ok → ajouter l'allocation du statut", () => {
    const { target, onEditHeader, onAddAllocation } = mountBadgeStatus(
      makeGroup({ remainingQty: 3 }),
    );

    badgeButton(target, "Manque: 3").click();
    badgeButton(target, "vérifier: 0").click();
    badgeButton(target, "Ok: 0").click();
    flushSync();

    expect(onEditHeader).toHaveBeenCalledWith(TEST_EM_HEADER_ID);
    expect(onAddAllocation).toHaveBeenNthCalledWith(
      1,
      TEST_EM_HEADER_ID,
      "to_check",
    );
    expect(onAddAllocation).toHaveBeenNthCalledWith(
      2,
      TEST_EM_HEADER_ID,
      "confirmed",
    );
  });

  it("les clics des badges n'écrivent jamais directement (zéro écriture au transport)", () => {
    const fakePb = currentFakePb();
    const { target } = mountBadgeStatus(makeGroup({ remainingQty: 3 }));
    const spy = vi.spyOn(fakePb, "collection");

    badgeButton(target, "Manque: 3").click();
    badgeButton(target, "vérifier: 0").click();
    badgeButton(target, "Ok: 0").click();
    flushSync();

    expect(spy).not.toHaveBeenCalled();
  });
});
