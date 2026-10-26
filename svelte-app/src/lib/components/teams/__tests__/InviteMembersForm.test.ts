/**
 * @vitest-environment jsdom
 */

/**
 * InviteMembersForm — la liste d'emails à inviter (ADR 0004, W/V).
 *
 * Seam : vrai composant monté en jsdom sur un team fixture ; le store n'est
 * pas en jeu ici (l'envoi appartient aux parents) — le contrat est la
 * constitution de la liste ($bindable invitedEmails) et ses validations.
 *
 * Contrats épinglés :
 *  - ajout valide : badge « Personnes à inviter (N) », champ vidé, email
 *    écrit dans invitedEmails (normalisé en minuscules)
 *  - refus : vide, email invalide, doublon — message d'erreur, liste intacte
 *  - retrait d'un badge
 *  - compteur du message personnalisé /200
 *  - sélecteur de rôle réservé au propriétaire de l'équipe
 */

const h = vi.hoisted(() => ({
  isTeamOwner: vi.fn((): boolean => true),
}));

vi.mock("$lib/stores/NativeTeamsStore.svelte", () => ({
  nativeTeamsStore: {},
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userId: "user0000000001",
    userName: "Test",
    isAuthenticated: true,
    isTeamOwner: h.isTeamOwner,
    isMobile: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import InviteMembersForm from "../InviteMembersForm.svelte";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";
import { makeTeam } from "$lib/stores/__tests__/harness/fixtures";

function mountForm(props: { invitedEmails?: string[] } = {}) {
  const holder = bindableProps({
    team: makeTeam(),
    invitedEmails: props.invitedEmails ?? [],
    customMessage: "",
  });
  const target = mountSvelte(InviteMembersForm, holder as never);
  return {
    target,
    holder: holder as unknown as {
      invitedEmails: string[];
      customMessage: string;
    },
  };
}

function emailInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>('input[type="email"]');
  if (!input) throw new Error("Champ email introuvable");
  return input;
}

function addEmail(target: HTMLElement, value: string): void {
  setInputValue(emailInput(target), value);
  getByText(target, "button", "Ajouter").click();
  flushSync();
}

beforeEach(() => {
  vi.restoreAllMocks();
  h.isTeamOwner.mockReturnValue(true);
});
afterEach(() => cleanupSvelte());

describe("InviteMembersForm — constitution de la liste", () => {
  it("ajout valide : badge compté, champ vidé, email normalisé dans invitedEmails", () => {
    const { target, holder } = mountForm();

    addEmail(target, "Marion@Example.test");

    expect(target.textContent).toContain("Personnes à inviter (1)");
    expect(target.textContent).toContain("marion@example.test");
    expect(emailInput(target).value).toBe("");
    expect(holder.invitedEmails).toEqual(["marion@example.test"]);
  });

  it("email invalide : refusé, liste intacte", () => {
    const { target, holder } = mountForm();

    addEmail(target, "pas-un-email");

    expect(target.textContent).toContain("Adresse email invalide");
    expect(holder.invitedEmails).toEqual([]);
  });

  it("doublon : refusé avec message dédié", () => {
    const { target, holder } = mountForm({
      invitedEmails: ["marion@example.test"],
    });

    addEmail(target, "marion@example.test");

    expect(target.textContent).toContain("Cet email est déjà dans la liste");
    expect(holder.invitedEmails).toEqual(["marion@example.test"]);
  });

  it("champ vide via Entrée : refusé", () => {
    const { target, holder } = mountForm();

    emailInput(target).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();

    expect(target.textContent).toContain("Veuillez entrer une adresse email");
    expect(holder.invitedEmails).toEqual([]);
  });

  it("le bouton de retrait retire l'email de la liste", () => {
    const { target, holder } = mountForm({
      invitedEmails: ["marion@example.test"],
    });

    target.querySelector<HTMLButtonElement>('button[title="Retirer"]')?.click();
    flushSync();

    expect(holder.invitedEmails).toEqual([]);
    expect(target.textContent).not.toContain("Personnes à inviter");
  });
});

describe("InviteMembersForm — message et rôle", () => {
  it("le compteur du message personnalisé suit la saisie", () => {
    const { target, holder } = mountForm();

    const message = target.querySelector<HTMLTextAreaElement>("textarea");
    if (!message) throw new Error("Zone de message introuvable");
    setInputValue(message, "Bienvenue");

    expect(target.textContent).toContain("9/200 caractères");
    expect(holder.customMessage).toBe("Bienvenue");
  });

  it("propriétaire : sélecteur de rôle affiché ; sinon masqué", () => {
    const ownerView = mountForm();
    expect(ownerView.target.querySelector("select")).not.toBeNull();

    h.isTeamOwner.mockReturnValue(false);
    const memberView = mountForm();
    expect(memberView.target.querySelector("select")).toBeNull();
  });
});
