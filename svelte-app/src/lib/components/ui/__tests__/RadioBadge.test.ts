/**
 * @vitest-environment jsdom
 */

/**
 * RadioBadge — bouton radio visuel (un choix parmi n).
 *
 * Contrat de données (ADR 0004) : `selectedValue` est $bindable — un clic
 * sur un badge non sélectionné sélectionne sa propre valeur ; la
 * sélection courante est distinguée visuellement (pastille de coche,
 * pas de trait discontinu). Désactivé, le clic ne change rien.
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage
 * (réassignation de prop $bindable). Remontée via `bindableProps`.
 */

import { describe, it, expect, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import RadioBadge from "../RadioBadge.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const user = userEvent.setup();

interface Holder {
  selectedValue: string;
  value: string;
  label: string;
  disabled?: boolean;
}

function mountRadioBadge(
  item: { value: string; label: string },
  selectedValue: string,
  extra: Record<string, unknown> = {},
) {
  // Toutes les props (bindables et statiques) dans le même objet $state :
  // étaler le proxy dans un littéral `{...holder}` en perdrait la nature
  // et donc la remontée.
  const holder = bindableProps<Holder>({
    selectedValue,
    value: item.value,
    label: item.label,
    ...extra,
  });
  const target = mountSvelte(RadioBadge, holder);
  return { target, holder };
}

describe("RadioBadge — sélection unique", () => {
  afterEach(() => cleanupSvelte());

  it("le badge sélectionné porte la coche et pas de trait discontinu", () => {
    const { target } = mountRadioBadge({ value: "a", label: "Oui" }, "a");
    const btn = getByText(target, "button", "Oui");
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.className).not.toContain("btn-dash");
  });

  it("le badge non sélectionné est en trait discontinu, sans coche", () => {
    const { target } = mountRadioBadge({ value: "b", label: "Non" }, "a");
    const btn = getByText(target, "button", "Non");
    expect(btn.querySelector("svg")).toBeNull();
    expect(btn.className).toContain("btn-dash");
  });

  it("un clic sélectionne la valeur du badge (remontée $bindable)", async () => {
    const { target, holder } = mountRadioBadge(
      { value: "b", label: "Non" },
      "a",
    );
    await user.click(getByText(target, "button", "Non"));
    expect(holder.selectedValue).toBe("b");
  });

  it("désactivé, un clic ne change pas la sélection", async () => {
    const { target, holder } = mountRadioBadge(
      { value: "b", label: "Non" },
      "a",
      { disabled: true },
    );
    const btn = getByText(target, "button", "Non");
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(holder.selectedValue).toBe("a");
  });
});
