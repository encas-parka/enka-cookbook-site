/**
 * @vitest-environment jsdom
 */

/**
 * TeamFormFields — les champs partagés des formulaires d'équipe (ADR 0004, V).
 *
 * Seam : vrai composant monté en jsdom, props $bindable portées par un
 * proxy holder (canon lot 1 — le compteur de caractères exige le re-rendu).
 *
 * Contrats épinglés :
 *  - saisies remontées au parent (nom, description, département, ville)
 *  - compteurs de caractères suivant la saisie (bornes maxlength 50 / 350)
 *  - showLocation : Département/Ville rendus seulement si demandés
 *  - disabled : saisies verrouillées
 *  - onNameKeydown remonté (canal Entrée des parents)
 *  - bandeau « admins » affiché au montage quand le nom est prérempli
 *    (variable figée à l'initialisation — comportement actuel épinglé, la
 *    frappe ultérieure ne le fait pas apparaître)
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import TeamFormFields from "../TeamFormFields.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
} from "$lib/test/mount-svelte";

interface Holder {
  name: string;
  description: string;
  location: string;
  city: string;
}

function mountFields(
  initial: Partial<{
    name: string;
    showLocation: boolean;
    disabled: boolean;
  }> = {},
) {
  const onNameKeydown = vi.fn();
  const holder = bindableProps({
    name: initial.name ?? "",
    description: "",
    location: "",
    city: "",
    showLocation: initial.showLocation ?? true,
    disabled: initial.disabled ?? false,
    onNameKeydown,
  });
  const target = mountSvelte(TeamFormFields, holder as never);
  return {
    target,
    holder: holder as unknown as Holder,
    onNameKeydown,
  };
}

afterEach(() => cleanupSvelte());

describe("TeamFormFields", () => {
  it("les saisies remontent au parent et les compteurs suivent", () => {
    const { target, holder } = mountFields();

    const name = target.querySelector<HTMLInputElement>('input[type="text"]');
    if (!name) throw new Error("Champ nom introuvable");
    setInputValue(name, "Équipe Cantine");

    expect(holder.name).toBe("Équipe Cantine");
    expect(target.textContent).toContain("14/50 caractères");

    const description = target.querySelector<HTMLTextAreaElement>("textarea");
    if (!description) throw new Error("Zone description introuvable");
    setInputValue(description, "Les marmitons");

    expect(holder.description).toBe("Les marmitons");
    expect(target.textContent).toContain("13/350 caractères");
  });

  it("showLocation : Département et Ville remontent ; masqués sinon", () => {
    const withLocation = mountFields({ showLocation: true });
    const inputs = withLocation.target.querySelectorAll<HTMLInputElement>(
      'input[placeholder^="Ex:"]',
    );
    expect(inputs).toHaveLength(3); // nom + département + ville
    setInputValue(inputs[1], "Île-de-France");
    setInputValue(inputs[2], "Paris");
    expect(withLocation.holder.location).toBe("Île-de-France");
    expect(withLocation.holder.city).toBe("Paris");

    const withoutLocation = mountFields({ showLocation: false });
    expect(
      withoutLocation.target.querySelectorAll('input[placeholder^="Ex:"]'),
    ).toHaveLength(1); // nom seul
    expect(withoutLocation.target.textContent).not.toContain("Département");
  });

  it("disabled : les saisies sont verrouillées", () => {
    const { target } = mountFields({ disabled: true });

    const inputs = target.querySelectorAll<HTMLInputElement>("input, textarea");
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.disabled).toBe(true);
    }
  });

  it("onNameKeydown remonte les touches du champ nom", () => {
    const { target, onNameKeydown } = mountFields();

    const name = target.querySelector<HTMLInputElement>('input[type="text"]');
    if (!name) throw new Error("Champ nom introuvable");
    name.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(onNameKeydown).toHaveBeenCalledTimes(1);
  });

  it("nom prérempli : bandeau admins affiché au montage (variable d'init)", () => {
    const { target } = mountFields({ name: "Équipe existante" });

    expect(target.textContent).toContain("Seul·es les admins peuvent modifier");
  });
});
