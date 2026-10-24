/**
 * @vitest-environment jsdom
 */

/**
 * RadioBadgeGroup — groupe de RadioBadge (un choix parmi n).
 *
 * Contrat de données (ADR 0004) : `selected` est $bindable au niveau du
 * groupe — cliquer un item du groupe sélectionne son id ; tous les items
 * sont rendus sous leur libellé.
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage.
 * Remontée via `bindableProps`.
 */

import { describe, it, expect, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import RadioBadgeGroup from "../RadioBadgeGroup.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const user = userEvent.setup();

const ITEMS = [
  { id: "avant", label: "Avant" },
  { id: "pendant", label: "Pendant" },
  { id: "apres", label: "Après" },
];

interface Holder {
  selected: string;
  items: typeof ITEMS;
  disabled?: boolean;
}

function mountGroup(selected: string, extra: Record<string, unknown> = {}) {
  // Même principe que RadioBadge : tout dans l'objet $state, jamais
  // `{...holder}` dans un littéral.
  const holder = bindableProps<Holder>({ selected, items: ITEMS, ...extra });
  const target = mountSvelte(RadioBadgeGroup, holder);
  return { target, holder };
}

describe("RadioBadgeGroup — un choix parmi n", () => {
  afterEach(() => cleanupSvelte());

  it("rend tous les items sous leur libellé", () => {
    const { target } = mountGroup("avant");
    for (const item of ITEMS) {
      getByText(target, "button", item.label);
    }
  });

  it("un clic sur un item sélectionne son id (remontée $bindable)", async () => {
    const { target, holder } = mountGroup("avant");
    await user.click(getByText(target, "button", "Après"));
    expect(holder.selected).toBe("apres");
  });

  it("disabled : aucun item ne change la sélection", async () => {
    const { target, holder } = mountGroup("avant", { disabled: true });
    const btn = getByText(target, "button", "Pendant");
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(holder.selected).toBe("avant");
  });
});
