/**
 * @vitest-environment jsdom
 */

/**
 * EventInvitationBanner — le bandeau RSVP (ADR 0002, D/W).
 *
 * Seam : vrai composant monté en jsdom ; `route.params.id` est figé par le
 * mock du routeur et `eventsStore.getRsvpStatus`/`respondToInvitation` sont
 * des espions — le contrat du composant est sa décision d'occupation
 * (invité / décliné / rien) et l'appel RSVP avec le bon verdict ; le flux
 * store est couvert par les tests store (`events-store-rsvp`).
 *
 * Contrats épinglés :
 *  - invité : bandeau « Invitation à participer » avec Refuser / Accepter
 *  - Accepter → respondToInvitation(id, true), succès tracké
 *  - Refuser → respondToInvitation(id, false), message de réversibilité
 *  - décliné : bandeau « Invitation déclinée » avec reprise possible
 *  - créateur / participant confirmé / hors canaux : rien n'est rendu
 */

const eventsStoreMock = vi.hoisted(() => ({
  getRsvpStatus: vi.fn((): string | null => "invited"),
  respondToInvitation: vi.fn(() => Promise.resolve()),
}));

vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: eventsStoreMock,
}));

vi.mock("$lib/router", () => ({
  route: { params: { id: "event000000001" } },
}));

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toastStub } from "$lib/test/toast-stub";
import EventInvitationBanner from "../EventInvitationBanner.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";

function mountBanner() {
  return mountSvelte(EventInvitationBanner, {});
}

beforeEach(() => {
  vi.restoreAllMocks();
  toastStub.reset();
  eventsStoreMock.getRsvpStatus.mockClear();
  eventsStoreMock.respondToInvitation.mockClear();
  eventsStoreMock.getRsvpStatus.mockReturnValue("invited");
});
afterEach(() => cleanupSvelte());

describe("EventInvitationBanner", () => {
  it("invité : bandeau avec Refuser et Accepter", () => {
    const target = mountBanner();

    expect(target.textContent).toContain("Invitation à participer");
    expect(target.textContent).toContain("menus, repas, tâches");
    getByText(target, "button", "Accepter");
    getByText(target, "button", "Refuser");
  });

  it("Accepter : respondToInvitation(id, true), succès tracké", async () => {
    const target = mountBanner();

    getByText(target, "button", "Accepter").click();
    await vi.waitFor(() => {
      expect(eventsStoreMock.respondToInvitation).toHaveBeenCalledWith(
        "event000000001",
        true,
      );
    });
    expect(toastStub.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: "Vous participez à cet événement",
      }),
    );
  });

  it("Refuser : respondToInvitation(id, false), message de réversibilité", async () => {
    const target = mountBanner();

    getByText(target, "button", "Refuser").click();
    await vi.waitFor(() => {
      expect(eventsStoreMock.respondToInvitation).toHaveBeenCalledWith(
        "event000000001",
        false,
      );
    });
    expect(toastStub.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        success: "Réponse enregistrée — vous pourrez changer d'avis",
      }),
    );
  });

  it("décliné : bandeau de reprise (« Je participe finalement »)", async () => {
    eventsStoreMock.getRsvpStatus.mockReturnValue("declined");
    const target = mountBanner();

    expect(target.textContent).toContain("Invitation déclinée");
    getByText(target, "button", "Je participe finalement").click();
    await vi.waitFor(() => {
      expect(eventsStoreMock.respondToInvitation).toHaveBeenCalledWith(
        "event000000001",
        true,
      );
    });
  });

  it("créateur ou participant confirmé : rien n'est rendu", () => {
    eventsStoreMock.getRsvpStatus.mockReturnValue(null);
    const target = mountBanner();

    expect(target.querySelector('[role="status"]')).toBeNull();
  });
});
