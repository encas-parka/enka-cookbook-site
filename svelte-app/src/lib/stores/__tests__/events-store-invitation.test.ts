/**
 * @vitest-environment jsdom
 */

/**
 * EventsStore — chemin d'invitation RSVP (write path).
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Le bridge liveQuery (actif dès la
 * construction) alimente #enrichedMap depuis db.events seedée — la 3-phase
 * init n'est pas nécessaire. Même machinerie que products-store-create.
 *
 * Couvre (cause racine mesurée par la sonde HTTP T06 : les règles events
 * list/view/update filtrent sur guestUsers — relation — jamais sur
 * contributors, json non traversable) :
 *  - inviteParticipants écrit guestUsers pour les emails résolus vers un
 *    compte PB — sans cette écriture l'event n'est jamais livré à l'invité
 *    (sync sans filtre → listRule) et son RSVP est rejeté (updateRule) ;
 *  - les emails inconnus (fallback nanoid) restent hors guestUsers — le hook
 *    join-event les y ajoutera au premier join, id réel à l'appui ;
 *  - updateContributorStatus (accept RSVP) ne touche pas guestUsers : le
 *    champ de visibilité n'est pas écrasé par un changement d'état RSVP ;
 *  - ré-inviter un invité déjà présent ne duplique pas guestUsers ;
 *  - règle d'écriture actée (ticket 02) : teamIds porte uniquement les
 *    équipes entièrement cochées (grant vivant, membres non individualisés) ;
 *    une équipe partielle passe en individus ; le champ de tracking
 *    guestEmails n'est plus écrit par le client.
 */

vi.mock("$lib/services/pb-users", () => ({
  lookupUsersByEmails: vi.fn(),
}));

vi.mock("$lib/services/pb-invitations", () => ({
  // Le step share-link/email reste non bloquant : lever ici reproduit un
  // échec et doit laisser l'invitation (guestUsers inclus) déjà appliquée.
  getOrCreateShareLink: vi.fn(async () => {
    throw new Error("no share links in unit test");
  }),
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "organizer",
    userId: "userorganizer01",
    isAuthenticated: true,
    userTeams: [],
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb } from "./harness/stub-pb";
import { waitForTick } from "./harness/wait-for-tick";
import { makeEvent, TEST_EVENT_ID } from "./harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { lookupUsersByEmails } from "$lib/services/pb-users";
import { db, pb } from "$lib/db-sync/pb-sync";

const GHALD = { id: "userghald00001", name: "ghald" };
const GHALD_EMAIL = "ghald@enka-dev.local";

/** Seed the event in Dexie (bridge → #enrichedMap) AND on the fake server
 * (the optimistic update path PATCHes the server record). */
async function seedEvent(overrides: Record<string, unknown> = {}) {
  const record = makeEvent(overrides as never);
  currentFakePb().seed("events", [record]);
  await db.events.clear();
  await db.events.put(record);
  await waitForTick(3); // liveQuery → SvelteMap
}

describe("EventsStore — invitation RSVP (write path)", () => {
  beforeEach(() => {
    currentFakePb().reset();
    vi.mocked(lookupUsersByEmails).mockReset();
  });

  it("inviteParticipants écrit guestUsers pour un email résolu vers un compte PB", async () => {
    await seedEvent({ contributors: [], guestUsers: null, guestEmails: null });
    vi.mocked(lookupUsersByEmails).mockResolvedValue(
      new Map([[GHALD_EMAIL, GHALD]]),
    );

    const updated = await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      emails: [GHALD_EMAIL],
    });

    // La relation filtrée par les règles events porte l'invité
    expect(updated.guestUsers).toContain(GHALD.id);
    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.guestUsers).toEqual([GHALD.id]);
    // L'état RSVP reste porté par contributors (json, pour l'UI)
    const contributors = server.contributors as Array<Record<string, unknown>>;
    expect(contributors).toHaveLength(1);
    expect(contributors[0].id).toBe(GHALD.id);
    expect(contributors[0].status).toBe("invited");
    expect(contributors[0].invitedAt).toBeTruthy();
    // Le champ de tracking n'est plus écrit par le client
    expect(server.guestEmails).toBeNull();
  });

  it("un email inconnu (fallback nanoid) ne touche pas guestUsers", async () => {
    await seedEvent({ contributors: [], guestUsers: null, guestEmails: null });
    vi.mocked(lookupUsersByEmails).mockResolvedValue(new Map());

    const updated = await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      emails: ["inconnu@enka-dev.local"],
    });

    // Aucun id inventé dans la relation serveur : le hook join-event y
    // ajoutera le vrai userId au premier join
    expect(updated.guestUsers ?? []).toEqual([]);
    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.guestUsers).toEqual([]);
    const contributors = server.contributors as Array<Record<string, unknown>>;
    expect(contributors).toHaveLength(1);
    expect(contributors[0].id).not.toBe("inconnu@enka-dev.local");
  });

  it("updateContributorStatus (accept) ne touche pas guestUsers", async () => {
    await seedEvent({
      contributors: [
        {
          id: GHALD.id,
          email: GHALD_EMAIL,
          name: GHALD.name,
          status: "invited",
          invitedAt: "2026-10-12T10:00:00.000Z",
        },
      ],
      guestUsers: [GHALD.id],
    });

    const updated = await eventsStore.updateContributorStatus(
      TEST_EVENT_ID,
      GHALD.id,
      "accepted",
    );

    expect(updated.contributors[0].status).toBe("accepted");
    expect(updated.contributors[0].respondedAt).toBeTruthy();
    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    // Le champ de visibilité serveur n'est pas écrasé par l'état RSVP
    expect(server.guestUsers).toEqual([GHALD.id]);
  });

  it("ré-inviter un invité déjà en guestUsers ne duplique pas la relation", async () => {
    await seedEvent({
      contributors: [
        {
          id: GHALD.id,
          email: GHALD_EMAIL,
          name: GHALD.name,
          status: "invited",
          invitedAt: "2026-10-12T10:00:00.000Z",
        },
      ],
      guestUsers: [GHALD.id],
      guestEmails: [GHALD_EMAIL],
    });
    vi.mocked(lookupUsersByEmails).mockResolvedValue(new Map());

    await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      emails: [GHALD_EMAIL],
    });

    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.guestUsers).toEqual([GHALD.id]);
    expect(server.contributors).toHaveLength(1);
    expect(server.guestEmails).toEqual([GHALD_EMAIL]);
  });

  it("une équipe entière cochée écrit le canal équipe sans individualiser ses membres", async () => {
    await seedEvent({ contributors: [], guestUsers: null, teams: [] });

    const updated = await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      // Équipe entièrement cochée : le grant équipe seul — les membres
      // actuels ne passent ni au registre ni en visibilité individuelle
      // (leur statut invité est dérivé de l'équipe)
      teamIds: ["teamalpha000001"],
      emails: [],
    });

    expect(updated.teams).toContain("teamalpha000001");
    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.teams).toContain("teamalpha000001");
    expect(server.contributors).toHaveLength(0);
    expect(server.guestUsers ?? []).toEqual([]);
  });

  it("une équipe partiellement cochée n'écrit pas le canal équipe, seulement les individus", async () => {
    await seedEvent({ contributors: [], guestUsers: null, teams: [] });
    vi.mocked(lookupUsersByEmails).mockResolvedValue(
      new Map([[GHALD_EMAIL, GHALD]]),
    );

    const updated = await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      // Pas de grant équipe : les seuls cochés passent en individuel
      teamIds: [],
      emails: [GHALD_EMAIL],
    });

    expect(updated.teams ?? []).toEqual([]);
    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.teams).toEqual([]);
    expect(server.guestUsers).toEqual([GHALD.id]);
    const contributors = server.contributors as Array<Record<string, unknown>>;
    expect(contributors).toHaveLength(1);
    expect(contributors[0].status).toBe("invited");
  });

  it("notifyEmails étend l'expédition sans créer d'écriture individuelle", async () => {
    await seedEvent({ contributors: [], guestUsers: null, teams: [] });
    vi.mocked(lookupUsersByEmails).mockResolvedValue(new Map());

    // Les membres d'une équipe entière reçoivent l'email groupé sans être
    // écrits au registre ni en visibilité individuelle
    const updated = await eventsStore.inviteParticipants(TEST_EVENT_ID, {
      teamIds: ["teamalpha000001"],
      emails: [],
      notifyEmails: ["membre-equipe@enka-dev.local"],
    });

    expect(updated.teams).toContain("teamalpha000001");
    expect(updated.contributors).toHaveLength(0);
    expect(updated.guestUsers ?? []).toEqual([]);
  });
});
