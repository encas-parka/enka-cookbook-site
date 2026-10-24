/**
 * @vitest-environment jsdom
 */

/**
 * EventMaterielControls — la barre de tri et les badges de filtres
 * actifs (ADR 0004). L'état sort est possédé par le parent (prop
 * simple) : le composant ne fait que remonter les changements.
 *
 * Comportements épinglés :
 *  - « Réinitialiser » n'apparaît qu'à partir de deux badges actifs
 *    (rendu conditionnel `{#if activeBadges.length > 1}`) — enlever les
 *    badges un à un reste possible, la remise à zéro globale exige
 *    plusieurs filtres
 *  - la prop `hasActiveFilters` est déclarée mais jamais lue dans le
 *    rendu (voir rapport de run, Findings) — non exercée ici
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
import { createRawSnippet } from "svelte";
import type { EventMaterielSort } from "$lib/types/event-materiel.types";
import EventMaterielControls from "../EventMaterielControls.svelte";
import type { ActiveBadge } from "../EventMaterielControls.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

function makeBadges(count: number): ActiveBadge[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `badge-${i + 1}`,
    label: `Filtre ${i + 1}`,
    color: "badge-secondary",
  }));
}

function mountControls(
  sort: EventMaterielSort = { field: "type", direction: "asc" },
  badges: ActiveBadge[] = [],
  props: Record<string, unknown> = {},
) {
  const onSortChange = vi.fn();
  const onRemoveBadge = vi.fn();
  const onResetFilters = vi.fn();
  const target = mountSvelte(EventMaterielControls, {
    sort,
    onSortChange,
    hasActiveFilters: badges.length > 0,
    activeBadges: badges,
    onRemoveBadge,
    onResetFilters,
    ...props,
  });
  return { target, onSortChange, onRemoveBadge, onResetFilters };
}

describe("EventMaterielControls — tri", () => {
  afterEach(() => cleanupSvelte());

  it("chaque bouton de tri remonte field + direction asc", () => {
    const { target, onSortChange } = mountControls();

    getByText(target, "button", "Type").click();
    getByText(target, "button", "Abc").click();
    getByText(target, "button", "Lieu").click();
    flushSync();

    expect(onSortChange).toHaveBeenNthCalledWith(1, {
      field: "type",
      direction: "asc",
    });
    expect(onSortChange).toHaveBeenNthCalledWith(2, {
      field: "name",
      direction: "asc",
    });
    expect(onSortChange).toHaveBeenNthCalledWith(3, {
      field: "where",
      direction: "asc",
    });
  });

  it("le champ de tri courant porte btn-active", () => {
    const { target } = mountControls({ field: "name", direction: "desc" });
    expect(
      getByText(target, "button", "Abc").classList.contains("btn-active"),
    ).toBe(true);
    expect(
      getByText(target, "button", "Type").classList.contains("btn-active"),
    ).toBe(false);
  });
});

describe("EventMaterielControls — badges de filtres actifs", () => {
  afterEach(() => cleanupSvelte());

  it("les badges actifs se retirent un à un", () => {
    const { target, onRemoveBadge } = mountControls(
      { field: "type", direction: "asc" },
      makeBadges(2),
    );

    getByText(target, "button", "Filtre 1").click();
    flushSync();
    expect(onRemoveBadge).toHaveBeenCalledWith("badge-1");
  });

  it("Réinitialiser n'existe qu'à partir de deux badges actifs", () => {
    const single = mountControls(
      { field: "type", direction: "asc" },
      makeBadges(1),
    );
    expect(queryByText(single.target, "button", "Réinitialiser")).toBeNull();

    cleanupSvelte();
    const multiple = mountControls(
      { field: "type", direction: "asc" },
      makeBadges(2),
    );
    expect(getByText(multiple.target, "button", "Réinitialiser")).toBeTruthy();
    getByText(multiple.target, "button", "Réinitialiser").click();
    flushSync();
    expect(multiple.onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("sans filtre actif, aucune rangée de badges", () => {
    const { target } = mountControls();
    expect(target.textContent).not.toContain("Filtres :");
  });

  it("le snippet addAction est rendu", () => {
    const addAction = createRawSnippet(() => ({
      render: () =>
        `<button data-testid="add-action">Ajouter du matériel</button>`,
    }));
    const { target } = mountControls(undefined, [], { addAction });
    expect(target.querySelector('[data-testid="add-action"]')).toBeTruthy();
  });
});
