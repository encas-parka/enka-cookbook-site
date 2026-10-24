/**
 * @vitest-environment jsdom
 */

/**
 * StatusSelect — le couple statut d'achat / date de livraison (achats).
 *
 * Contrats de données (ADR 0004) :
 *  - `status` et `deliveryDate` sont des props $bindable : la sélection
 *    utilisateur doit remonter au parent ;
 *  - l'input date n'existe que si status === "ordered" (rendu conditionnel
 *    porteur de sens : une livraison ne se planifie que sur commande) ;
 *  - l'aide « Modifiez s'il s'agit d'une commande » n'est visible que sur
 *    « Acheté ».
 *
 * Seam : vrai composant monté en jsdom, une interaction par montage
 * (réassignation de props $bindable, voir ADR 0004) — l'état initial passe
 * par les props. La remontée au parent passe par `bindableProps` (proxy
 * `$state` — `mount()` seul n'écrit pas en retour).
 */

import { describe, it, expect, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import StatusSelect from "../StatusSelect.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";

const user = userEvent.setup();

interface Holder {
  status: "delivered" | "ordered" | null;
  deliveryDate: string | null;
  disabled?: boolean;
}

function mountStatusSelect(initial: Partial<Holder> = {}) {
  const holder = bindableProps<Holder>({
    status: "delivered",
    deliveryDate: null,
    disabled: false,
    ...initial,
  });
  const target = mountSvelte(StatusSelect, holder);
  return { target, holder };
}

function statusSelect(target: HTMLElement): HTMLSelectElement {
  const select = target.querySelector("select");
  if (!select) throw new Error("Select de statut introuvable");
  return select;
}

function deliveryInput(target: HTMLElement): HTMLInputElement | null {
  return target.querySelector<HTMLInputElement>('input[type="date"]');
}

const HINT = "Modifiez s'il s'agit d'une commande";

describe("StatusSelect — statut et date de livraison", () => {
  afterEach(() => cleanupSvelte());

  it("sur « Acheté » : pas de date de livraison, aide visible", () => {
    const { target } = mountStatusSelect({ status: "delivered" });
    expect(statusSelect(target).value).toBe("delivered");
    expect(deliveryInput(target)).toBeNull();
    const hint = getByText(target, ".label", HINT);
    expect(hint.className).not.toContain("hidden");
  });

  it("sur « Commandé » : champ date rendu et lié, aide masquée", () => {
    const { target } = mountStatusSelect({
      status: "ordered",
      deliveryDate: "2026-11-01",
    });
    expect(statusSelect(target).value).toBe("ordered");
    expect(deliveryInput(target)).not.toBeNull();
    expect(deliveryInput(target)!.value).toBe("2026-11-01");
    const hint = queryByText(target, ".label", HINT);
    expect(hint?.className).toContain("hidden");
  });

  it("passer à « Commandé » fait apparaître le champ date", async () => {
    const { target, holder } = mountStatusSelect({ status: "delivered" });
    await user.selectOptions(statusSelect(target), "ordered");
    expect(holder.status).toBe("ordered");
    expect(deliveryInput(target)).not.toBeNull();
  });

  it("la date saisie remonte au parent", () => {
    const { target, holder } = mountStatusSelect({ status: "ordered" });
    const input = deliveryInput(target);
    if (!input) throw new Error("Champ date introuvable sur « Commandé »");
    input.value = "2026-12-25";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(holder.deliveryDate).toBe("2026-12-25");
  });

  it("disabled gèle le select", () => {
    const { target } = mountStatusSelect({
      status: "delivered",
      disabled: true,
    });
    expect(statusSelect(target).disabled).toBe(true);
  });
});
