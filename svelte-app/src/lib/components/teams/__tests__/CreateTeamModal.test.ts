/**
 * @vitest-environment jsdom
 */

/**
 * CreateTeamModal — création d'équipe en deux pas (ADR 0004, W).
 *
 * Seam : vraie modale (avec ses enfants TeamFormFields et InviteMembersForm)
 * montée en jsdom ; `nativeTeamsStore` est remplacé par des espions — le
 * contrat du composant est l'appel store (nom + prefs, emails + message),
 * la bascule d'étape, la fermeture AVANT l'envoi des invitations et la
 * remontée `onSuccess`.
 *
 * Contrats épinglés :
 *  - nom requis : bouton désactivé à vide, Entrée sur champ vide → erreur
 *    locale, zéro write
 *  - « Créer l'équipe » → createTeam(nom, prefs) puis étape invitation
 *  - « Passer cette étape » → onSuccess(teamId) + fermeture, zéro invitation
 *  - invitations : la modale ferme D'ABORD, puis inviteTeamMember (emails,
 *    message éventuel) et fetchTeam en arrière-plan
 */

const teamsStoreMock = vi.hoisted(() => ({
  createTeam: vi.fn(),
  inviteTeamMember: vi.fn(() => Promise.resolve()),
  fetchTeam: vi.fn(() => Promise.resolve()),
  getTeamById: vi.fn(),
}));

vi.mock("$lib/stores/NativeTeamsStore.svelte", () => ({
  nativeTeamsStore: teamsStoreMock,
}));

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userId: "user0000000001",
    userName: "Test",
    isAuthenticated: true,
    isTeamOwner: () => true,
    isMobile: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import CreateTeamModal from "../CreateTeamModal.svelte";
import {
  modalDialog,
  expectModalClosed,
} from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";

const CREATED_TEAM = { id: "t12team00000001", name: "Équipe Test" };

function mountModal(extra: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const holder = bindableProps({
    isOpen: true,
    onClose,
    onSuccess,
    ...extra,
  });
  const anyHolder = holder as unknown as { isOpen: boolean };
  anyHolder.onClose = () => {
    onClose();
    anyHolder.isOpen = false;
  };
  const target = mountSvelte(CreateTeamModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, onClose, onSuccess };
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>(
    'input[placeholder^="Ex: Équipe"]',
  );
  if (!input) throw new Error("Champ nom d'équipe introuvable");
  return input;
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  teamsStoreMock.createTeam.mockReset().mockResolvedValue(CREATED_TEAM);
  teamsStoreMock.inviteTeamMember.mockClear();
  teamsStoreMock.fetchTeam.mockClear();
  teamsStoreMock.getTeamById.mockReset().mockReturnValue(CREATED_TEAM);
});
afterEach(() => cleanupSvelte());

describe("CreateTeamModal — création", () => {
  it("nom vide : bouton désactivé, Entrée → erreur locale et zéro write", () => {
    const { target } = mountModal();

    expect(getByText(target, "button", "Créer l'équipe").disabled).toBe(true);
    nameInput(target).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();

    expect(target.textContent).toContain("Le nom de l'équipe est requis");
    expect(teamsStoreMock.createTeam).not.toHaveBeenCalled();
  });

  it("« Créer l'équipe » appelle createTeam(nom, prefs) puis passe à l'invitation", async () => {
    const { target } = mountModal();

    setInputValue(nameInput(target), "Équipe Test");
    getByText(target, "button", "Créer l'équipe").click();

    await waitForCondition(
      () => target.textContent?.includes("créée avec succès") ?? false,
      "l'étape invitation s'affiche",
      100,
      flushSync,
    );
    expect(teamsStoreMock.createTeam).toHaveBeenCalledWith(
      "Équipe Test",
      expect.objectContaining({ isPublic: false }),
    );
    expect(modalDialog(target)).not.toBeNull();
  });

  it("« Passer cette étape » remonte onSuccess et ferme sans inviter", async () => {
    const { target, onSuccess, onClose } = mountModal();

    setInputValue(nameInput(target), "Équipe Test");
    getByText(target, "button", "Créer l'équipe").click();
    await waitForCondition(
      () => target.textContent?.includes("créée avec succès") ?? false,
      "l'étape invitation s'affiche",
      100,
      flushSync,
    );

    getByText(target, "button", "Passer cette étape").click();
    await expectModalClosed(target, "la modale de création d'équipe");

    expect(onSuccess).toHaveBeenCalledWith(CREATED_TEAM.id);
    expect(onClose).toHaveBeenCalled();
    expect(teamsStoreMock.inviteTeamMember).not.toHaveBeenCalled();
  });
});

describe("CreateTeamModal — invitations", () => {
  async function reachInviteStep(target: HTMLElement): Promise<void> {
    setInputValue(nameInput(target), "Équipe Test");
    getByText(target, "button", "Créer l'équipe").click();
    await waitForCondition(
      () => target.textContent?.includes("créée avec succès") ?? false,
      "l'étape invitation s'affiche",
      100,
      flushSync,
    );
  }

  it("la modale ferme d'abord, invitations et fetchTeam en arrière-plan", async () => {
    const { target, onSuccess } = mountModal();
    await reachInviteStep(target);

    const emailInput = target.querySelector<HTMLInputElement>(
      'input[type="email"]',
    );
    if (!emailInput) throw new Error("Champ email introuvable");
    setInputValue(emailInput, "marion@example.test");
    getByText(target, "button", "Ajouter").click();
    flushSync();

    getByText(target, "button", "Envoyer 1 invitation").click();
    await expectModalClosed(target, "la modale d'invitation");

    expect(onSuccess).toHaveBeenCalledWith(CREATED_TEAM.id);
    await vi.waitFor(() => {
      expect(teamsStoreMock.inviteTeamMember).toHaveBeenCalledWith(
        CREATED_TEAM.id,
        ["marion@example.test"],
        undefined,
      );
      expect(teamsStoreMock.fetchTeam).toHaveBeenCalledWith(CREATED_TEAM.id);
    });
  });

  it("le message personnalisé accompagne les invitations", async () => {
    const { target } = mountModal();
    await reachInviteStep(target);

    const emailInput = target.querySelector<HTMLInputElement>(
      'input[type="email"]',
    );
    if (!emailInput) throw new Error("Champ email introuvable");
    setInputValue(emailInput, "marion@example.test");
    getByText(target, "button", "Ajouter").click();
    flushSync();

    const message = target.querySelector<HTMLTextAreaElement>("textarea");
    if (!message) throw new Error("Zone de message introuvable");
    setInputValue(message, "Bienvenue dans la cantine !");

    getByText(target, "button", "Envoyer 1 invitation").click();
    await expectModalClosed(target, "la modale d'invitation");

    await vi.waitFor(() => {
      expect(teamsStoreMock.inviteTeamMember).toHaveBeenCalledWith(
        CREATED_TEAM.id,
        ["marion@example.test"],
        "Bienvenue dans la cantine !",
      );
    });
  });
});
