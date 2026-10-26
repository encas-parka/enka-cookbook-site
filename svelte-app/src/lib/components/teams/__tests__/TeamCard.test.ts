/**
 * @vitest-environment jsdom
 */

/**
 * TeamCard — la carte d'une équipe (ADR 0004, D + W légère).
 *
 * Seam : vrai composant monté en jsdom sur un team fixture ;
 * `nativeTeamsStore` est espionné (retrait de membre) et `globalState`
 * fixe l'utilisateur courant.
 *
 * Contrats épinglés :
 *  - nom, description (prefs), compte de membres confirmés (singulier/pluriel)
 *  - les invitations en attente ne comptent pas dans les membres ; badge
 *    d'invitations réservé au propriétaire
 *  - clic carte → onClick(team.id)
 *  - « Quitter » réservé au membre confirmé non-propriétaire : removeMember
 *    appelé sans propager le clic à la carte
 */

const teamsStoreMock = vi.hoisted(() => ({
  removeMember: vi.fn(() => Promise.resolve()),
}));

vi.mock("$lib/stores/NativeTeamsStore.svelte", () => ({
  nativeTeamsStore: teamsStoreMock,
}));

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
import TeamCard from "../TeamCard.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";
import {
  makeTeam,
  makeTeamMember,
  TEST_TEAM_ID,
  TEST_USER_ID,
  TEST_MEMBER_ID,
} from "$lib/stores/__tests__/harness/fixtures";

const ME = makeTeamMember({
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

function mountCard(team = makeTeam({ members: [ME, MARION] })) {
  const onClick = vi.fn();
  const target = mountSvelte(TeamCard, {
    team,
    teamId: TEST_TEAM_ID,
    onClick,
  });
  return { target, onClick };
}

beforeEach(() => {
  vi.restoreAllMocks();
  teamsStoreMock.removeMember.mockClear();
});
afterEach(() => cleanupSvelte());

describe("TeamCard", () => {
  it("rend nom, description (prefs) et le compte des membres confirmés", () => {
    const { target } = mountCard(
      makeTeam({
        members: [ME, MARION, PENDING],
        prefs: {
          description: "Les marmitons",
          location: "",
          city: "",
          isPublic: true,
        },
      }),
    );

    expect(target.textContent).toContain("Team One");
    expect(target.textContent).toContain("Les marmitons");
    expect(target.textContent).toContain("2 membres");
    expect(target.textContent).not.toContain("3 membres");
  });

  it("un seul membre confirmé s'écrit au singulier", () => {
    const { target } = mountCard(makeTeam({ members: [ME] }));

    expect(target.textContent).toContain("1 membre");
    expect(target.textContent).not.toContain("1 membres");
  });

  it("le badge d'invitations en attente est réservé au propriétaire", () => {
    const ownerTeam = makeTeam({
      members: [
        makeTeamMember({
          id: TEST_MEMBER_ID,
          userId: TEST_USER_ID,
          roles: ["owner"],
        }),
        MARION,
        PENDING,
      ],
    });
    const { target } = mountCard(ownerTeam);

    expect(target.textContent).toContain("1 invitation");
  });

  it("membre non-propriétaire : pas de badge invitations", () => {
    const { target } = mountCard(makeTeam({ members: [ME, MARION, PENDING] }));

    expect(target.textContent).not.toContain("invitation");
  });

  it("le clic carte remonte team.id", () => {
    const { target, onClick } = mountCard();

    target.querySelector<HTMLElement>('[role="button"]')?.click();

    expect(onClick).toHaveBeenCalledWith(TEST_TEAM_ID);
  });

  it("« Quitter » (membre non-propriétaire) retire sans propager le clic", async () => {
    const { target, onClick } = mountCard(makeTeam({ members: [ME, MARION] }));

    const leave = target.querySelector<HTMLButtonElement>(
      'button[title="Quitter l\'équipe"]',
    );
    if (!leave) throw new Error("Bouton Quitter introuvable");
    leave.click();
    await vi.waitFor(() => {
      expect(teamsStoreMock.removeMember).toHaveBeenCalledWith(
        TEST_TEAM_ID,
        TEST_MEMBER_ID,
      );
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("propriétaire : pas de bouton Quitter", () => {
    const ownerTeam = makeTeam({
      members: [
        makeTeamMember({
          id: TEST_MEMBER_ID,
          userId: TEST_USER_ID,
          roles: ["owner"],
        }),
      ],
    });
    const { target } = mountCard(ownerTeam);

    expect(
      target.querySelector('button[title="Quitter l\'équipe"]'),
    ).toBeNull();
    expect(teamsStoreMock.removeMember).not.toHaveBeenCalled();
  });
});
