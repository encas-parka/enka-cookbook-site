/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielGroupCard — la carte d'un groupe besoin + allocations
 * (ADR 0004). Le statut de chaque allocation est résolu côté affichage
 * (resolveStatus du store, migration incluse) ; les badges de synthèse
 * sont portés par EventMaterielBadgeStatus imbriqué.
 *
 * Seam : vrai composant, fixture MaterielGroup minimale locale (patron
 * MaterielCard.test).
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
  TEST_EM_HEADER_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import type { MaterielGroup } from "$lib/types/event-materiel.types";
import EventMaterielGroupCard from "../EventMaterielGroupCard.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";

const ALLOC_ID = "t12evem00000003";

function makeGroup(overrides: Partial<MaterielGroup> = {}): MaterielGroup {
  return {
    header: makeEventMaterielRecord({
      id: TEST_EM_HEADER_ID,
      name: "Tables pliantes",
      quantity: 5,
      notes:
        "Penser aux rallonges électriques pour les tables du fond de la salle et aux nappes.",
    }),
    allocations: [
      makeEventMaterielRecord({
        id: ALLOC_ID,
        name: "Tables pliantes",
        status: "confirmed",
        quantity: 2,
        groupId: TEST_EM_HEADER_ID,
        who: "Jean",
        where: "Réserve",
      }),
    ],
    remainingQty: 3,
    totalAllocated: 2,
    ...overrides,
  };
}

function mountGroupCard(
  group: MaterielGroup,
  props: Record<string, unknown> = {},
) {
  const onEditItem = vi.fn();
  const onAddAllocation = vi.fn();
  const target = mountSvelte(EventMaterielGroupCard, {
    group,
    onEditItem,
    onAddAllocation,
    ...props,
  });
  return { target, onEditItem, onAddAllocation };
}

describe("EventMaterielGroupCard — affichage du groupe", () => {
  afterEach(() => cleanupSvelte());

  it("affiche le besoin (nom, quantité xN), les allocations et la synthèse", () => {
    const { target } = mountGroupCard(makeGroup());

    expect(target.textContent).toContain("Tables pliantes");
    expect(target.textContent).toContain("x5");
    // L'allocation : source + statut résolu + quantité
    expect(target.textContent).toContain("Jean");
    expect(target.textContent).toContain("Réserve");
    expect(target.textContent).toContain("Ok x2");
    // Les badges de synthèse (composant imbriqué)
    expect(getByText(target, "span", "Manque: 3")).toBeTruthy();
    expect(getByText(target, "span", "Ok: 2")).toBeTruthy();
  });

  it("le statut d'une allocation sans statut (migration) est résolu depuis where", () => {
    const { target } = mountGroupCard(
      makeGroup({
        allocations: [
          makeEventMaterielRecord({
            id: ALLOC_ID,
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

    // status null + where → confirmé → libellé « Ok »
    expect(target.textContent).toContain("Ok x2");
  });

  it("les notes longues du besoin sont tronquées à 80 caractères", () => {
    const { target } = mountGroupCard(makeGroup());
    const notes = makeGroup().header.notes!;
    expect(notes.length).toBeGreaterThan(80);
    expect(target.textContent).toContain(notes.slice(0, 80) + "...");
    expect(target.textContent).not.toContain(notes);
  });
});

describe("EventMaterielGroupCard — actions remontées", () => {
  afterEach(() => cleanupSvelte());

  it("cliquer une allocation édite l'allocation, le crayon édite le besoin", () => {
    const group = makeGroup();
    const { target, onEditItem } = mountGroupCard(group);

    target
      .querySelector<HTMLElement>('button[aria-label="Éditer l\'allocation"]')!
      .click();
    flushSync();
    expect(onEditItem).toHaveBeenCalledWith(group.allocations[0]);

    target.querySelector<HTMLButtonElement>('button[title="Editer"]')!.click();
    flushSync();
    expect(onEditItem).toHaveBeenCalledWith(group.header);
  });

  it("canEdit=false : ni crayon de besoin ni crayon d'allocation", () => {
    const { target } = mountGroupCard(makeGroup(), { canEdit: false });
    expect(target.querySelector('button[title="Editer"]')).toBeNull();
    // Le crayon d'allocation est rendu seulement si canEdit && onEditItem —
    // les autres icônes d'info (MapPin…) restent
    expect(
      target.querySelector(
        'button[aria-label="Éditer l\'allocation"] svg.lucide-pencil',
      ),
    ).toBeNull();
  });

  it("les badges de synthèse remontent l'ajout d'allocation avec le statut", () => {
    const { target, onAddAllocation } = mountGroupCard(makeGroup());
    getByText(target, "span", "Ok: 2").closest("button")!.click();
    flushSync();
    expect(onAddAllocation).toHaveBeenCalledWith(
      TEST_EM_HEADER_ID,
      "confirmed",
    );
  });
});
