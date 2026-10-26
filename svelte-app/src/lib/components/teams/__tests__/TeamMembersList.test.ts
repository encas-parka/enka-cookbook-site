/**
 * @vitest-environment jsdom
 */

/**
 * TeamMembersList — la liste des membres d'une équipe (ADR 0004, W/D).
 *
 * Seam : vraie liste avec ses enfants réels (ManageMemberModal, ConfirmModal)
 * montée en jsdom ; `nativeTeamsStore` est remplacé par des espions et
 * `globalState` fixe l'utilisateur courant.
 *
 * Contrats épinglés :
 *  - seuls les membres confirmés sont listés, avec initiales et rôle
 *    (« Admin »/« Membre »)
 *  - owner : crayon « Gérer ce membre » et ouverture de la modale de gestion
 *  - renvoi d'invitation : réservé au owner (guard silencieux sinon)
 *
 * BUG ÉPINGLÉ (découvert en testant, lot 6) : `isCurrentUser` compare
 * `member.id` (id du record PB) à `globalState.userId` (l.152) — jamais
 * égaux. Conséquences figées par les tests : aucun « (vous) », bouton
 * « Quitter l'équipe » jamais rendu (le flux confirm + removeMember est
 * inatteignable ici ; le retrait passe par TeamCard, qui compare
 * `member.userId`, correct), et le crayon de gestion s'affiche aussi sur sa
 * propre ligne. Le fix (`member.userId === currentUserId`) fera repasser ces
 * tests au contrat nominal.
 */

const teamsStoreMock = vi.hoisted(() => ({
  removeMember: vi.fn(() => Promise.resolve()),
  inviteTeamMember: vi.fn(() => Promise.resolve()),
  fetchTeam: vi.fn(() => Promise.resolve()),
  updateMemberRole: vi.fn(() => Promise.resolve()),
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
    userId: "t12user00000001",
    userName: "Test User",
    isAuthenticated: true,
    isTeamOwner: vi.fn(() => true),
    isMobile: false,
  },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import TeamMembersList from "../TeamMembersList.svelte";
import { mountSvelte, cleanupSvelte } from "$lib/test/mount-svelte";
import {
  makeTeam,
  makeTeamMember,
  TEST_TEAM_ID,
  TEST_USER_ID,
  TEST_MEMBER_ID,
} from "$lib/stores/__tests__/harness/fixtures";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import type { EnrichedNativeTeam } from "$lib/types/aw_native_team.d";

const ME_MEMBER = makeTeamMember({
  id: TEST_MEMBER_ID,
  userId: TEST_USER_ID,
  name: "Test User",
  roles: ["member"],
});
const MARION = makeTeamMember({
  id: "t12member000002",
  userId: "t12user00000002",
  name: "Marion",
  userEmail: "marion@example.test",
  roles: ["member"],
});
const PENDING = makeTeamMember({
  id: "t12member000003",
  userId: "t12user00000003",
  name: "Invité",
  confirmed: false,
});

function mountList(
  members: EnrichedNativeTeam["members"],
  extra: Record<string, unknown> = {},
) {
  const onMemberRemoved = vi.fn();
  const target = mountSvelte(TeamMembersList, {
    team: makeTeam({ members }),
    onMemberRemoved,
    ...extra,
  });
  return { target, onMemberRemoved };
}

function resendButtons(target: HTMLElement): NodeListOf<HTMLButtonElement> {
  return target.querySelectorAll<HTMLButtonElement>(
    'button[title="Renvoyer l\'invitation par email"]',
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  teamsStoreMock.removeMember.mockClear();
  teamsStoreMock.inviteTeamMember.mockClear();
  teamsStoreMock.fetchTeam.mockClear();
  teamsStoreMock.updateMemberRole.mockClear();
});
afterEach(() => cleanupSvelte());

describe("TeamMembersList — affichage", () => {
  it("liste les membres confirmés avec initiales et rôle ; les invités restent hors liste", () => {
    const { target } = mountList([
      makeTeamMember({
        id: TEST_MEMBER_ID,
        userId: TEST_USER_ID,
        name: "Test User",
        roles: ["owner"],
      }),
      MARION,
      PENDING,
    ]);

    expect(target.textContent).toContain("Test User");
    expect(target.textContent).toContain("Marion");
    expect(target.textContent).toContain("Admin");
    expect(target.textContent).toContain("Membre");
    expect(target.textContent).not.toContain("Invité");
  });

  it("BUG épinglé : aucun « (vous) » (isCurrentUser compare member.id à userId)", () => {
    const { target } = mountList([ME_MEMBER, MARION]);

    expect(target.textContent).not.toContain("(vous)");
  });

  it("équipe sans membre : « Aucun membre »", () => {
    const { target } = mountList([]);

    expect(target.textContent).toContain("Aucun membre");
  });
});

describe("TeamMembersList — gestion (owner)", () => {
  const OWNER_TEAM = [
    makeTeamMember({
      id: TEST_MEMBER_ID,
      userId: TEST_USER_ID,
      name: "Test User",
      roles: ["owner"],
    }),
    MARION,
  ];

  it("BUG épinglé : le crayon s'affiche aussi sur sa propre ligne", () => {
    const { target } = mountList(OWNER_TEAM);

    const pencils = target.querySelectorAll<HTMLButtonElement>(
      'button[title="Gérer ce membre"]',
    );
    expect(pencils).toHaveLength(2);
  });

  it("le crayon d'un autre membre ouvre la modale de gestion", async () => {
    const { target } = mountList(OWNER_TEAM);

    const pencils = target.querySelectorAll<HTMLButtonElement>(
      'button[title="Gérer ce membre"]',
    );
    pencils[1].click();
    flushSync();

    await waitForCondition(
      () => target.textContent?.includes("Gérer le membre") ?? false,
      "la modale de gestion s'ouvre",
      100,
      flushSync,
    );
    expect(target.textContent).toContain("Marion");
  });

  it("renvoi d'invitation : inviteTeamMember avec l'email du membre visé", async () => {
    const { target } = mountList(OWNER_TEAM);

    const buttons = resendButtons(target);
    expect(buttons).toHaveLength(2);
    buttons[1].click();

    await vi.waitFor(() => {
      expect(teamsStoreMock.inviteTeamMember).toHaveBeenCalledWith(
        TEST_TEAM_ID,
        ["marion@example.test"],
      );
    });
  });
});

describe("TeamMembersList — quitter l'équipe (inatteignable, bug épinglé)", () => {
  it("BUG épinglé : le bouton Quitter n'est jamais rendu", () => {
    const { target, onMemberRemoved } = mountList([ME_MEMBER, MARION]);

    expect(
      target.querySelector('button[title="Quitter l\'équipe"]'),
    ).toBeNull();
    expect(teamsStoreMock.removeMember).not.toHaveBeenCalled();
    expect(onMemberRemoved).not.toHaveBeenCalled();
  });
});

describe("TeamMembersList — hors propriétaire", () => {
  it("pas de crayon de gestion ; renvoi d'invitation gardé silencieusement", () => {
    const { target } = mountList([ME_MEMBER, MARION]);

    expect(
      target.querySelectorAll('button[title="Gérer ce membre"]'),
    ).toHaveLength(0);

    const buttons = resendButtons(target);
    if (buttons.length === 0) throw new Error("Bouton de renvoi introuvable");
    buttons[0].click();
    flushSync();

    expect(teamsStoreMock.inviteTeamMember).not.toHaveBeenCalled();
  });
});
