/**
 * @vitest-environment jsdom
 */

/**
 * EventsStore — modèle RSVP : invitation virtuelle dérivée, upsert de la
 * réponse, sémantique d'édition.
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. L'event seedé en Dexie alimente
 * #enrichedMap via le bridge liveQuery — la 3-phase init n'est pas
 * nécessaire. Même machinerie que events-store-invitation.
 *
 * Le modèle : toute personne rendue visible sur un event (équipe invitée,
 * guestUsers) sans entrée au registre est une invitation VIRTUELLE — sa
 * réponse crée l'entrée (upsert, email/nom de la session), aucune écriture
 * avant. L'édition est la récompense de la confirmation : créateur ou
 * entrée accepted ; une équipe invitée n'ouvre que la visibilité.
 */

const session = vi.hoisted(() => ({
  userId: "userghald00001",
  userName: "ghald",
  userEmail: "ghald@enka-dev.local",
  userTeams: ["t12team00000001"],
}));

vi.mock("$lib/services/pb-users", () => ({
  lookupUsersByEmails: vi.fn(),
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: session,
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { waitForTick } from "./harness/wait-for-tick";
import { makeEvent, T0, TEST_EVENT_ID, TEST_TEAM_ID } from "./harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db, pb } from "$lib/db-sync/pb-sync";

const OTHER_USER = "userother000001";

/** Entrée de registre pour l'utilisateur de session. */
function sessionEntry(status: "invited" | "accepted" | "declined") {
  return {
    id: session.userId,
    email: session.userEmail,
    name: session.userName,
    status,
    invitedAt: "2026-10-12T10:00:00.000Z",
  };
}

let seedSeq = 0;

/** Seed the event in Dexie (bridge → #enrichedMap) AND on the fake server
 * (the optimistic update path PATCHes the server record). Chaque seed bump
 * `updated` : le bridge compare sur ce champ et ignorerait un record
 * identique (contrat réel — une écriture serveur le bump toujours). */
async function seedEvent(overrides: Record<string, unknown> = {}) {
  const record = makeEvent({
    updated: pbDate(new Date(T0.getTime() + ++seedSeq * 60_000)),
    ...overrides,
  } as never);
  currentFakePb().seed("events", [record]);
  await db.events.clear();
  await db.events.put(record);
  await waitForTick(3); // liveQuery → SvelteMap
}

beforeEach(() => {
  currentFakePb().reset();
});

describe("getRsvpStatus — invitation virtuelle dérivée", () => {
  it("un membre d'une équipe invitée sans entrée est invité (virtuel)", async () => {
    await seedEvent({ teams: [TEST_TEAM_ID] });

    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBe("invited");
  });

  it("une personne rendue visible (guestUsers) sans entrée est invitée", async () => {
    await seedEvent({ guestUsers: [session.userId] });

    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBe("invited");
  });

  it("le créateur sans entrée n'est pas une invitation", async () => {
    await seedEvent({ createdBy: session.userId, teams: [TEST_TEAM_ID] });

    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBeNull();
  });

  it("le créateur avec une entrée de registre résiduelle non plus", async () => {
    await seedEvent({
      createdBy: session.userId,
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("declined")],
    });

    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBeNull();
  });

  it("hors canaux de visibilité, pas de statut", async () => {
    await seedEvent({ teams: ["otherteam0000001"], guestUsers: [OTHER_USER] });

    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBeNull();
  });

  it("l'entrée au registre gagne sur le dérivé", async () => {
    await seedEvent({
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("declined")],
    });
    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBe("declined");

    await seedEvent({
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("invited")],
    });
    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBe("invited");

    await seedEvent({
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("accepted")],
    });
    expect(eventsStore.getRsvpStatus(TEST_EVENT_ID)).toBe("accepted");
  });
});

describe("respondToInvitation — upsert de la réponse", () => {
  it("accepter sans entrée crée l'entrée accepted (email/nom de session)", async () => {
    await seedEvent({ teams: [TEST_TEAM_ID] });

    const updated = await eventsStore.respondToInvitation(TEST_EVENT_ID, true);

    const entry = updated.contributors.find((c) => c.id === session.userId);
    expect(entry?.status).toBe("accepted");
    expect(entry?.email).toBe(session.userEmail);
    expect(entry?.name).toBe(session.userName);
    expect(entry?.respondedAt).toBeTruthy();

    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    const serverContributors = server.contributors as Array<
      Record<string, unknown>
    >;
    expect(serverContributors).toHaveLength(1);
    expect(serverContributors[0].status).toBe("accepted");
  });

  it("refuser sans entrée crée l'entrée declined", async () => {
    await seedEvent({ teams: [TEST_TEAM_ID] });

    const updated = await eventsStore.respondToInvitation(TEST_EVENT_ID, false);

    expect(updated.contributors[0].status).toBe("declined");
    expect(updated.contributors[0].respondedAt).toBeTruthy();
  });

  it("répondre sur une entrée existante met à jour le statut sans dupliquer", async () => {
    await seedEvent({
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("invited")],
    });

    const updated = await eventsStore.respondToInvitation(TEST_EVENT_ID, true);

    expect(updated.contributors).toHaveLength(1);
    expect(updated.contributors[0].status).toBe("accepted");
    expect(updated.contributors[0].invitedAt).toBe("2026-10-12T10:00:00.000Z");
    expect(updated.contributors[0].respondedAt).toBeTruthy();
  });

  it("la réponse ne touche à aucun canal de visibilité", async () => {
    await seedEvent({
      teams: [TEST_TEAM_ID],
      guestUsers: [OTHER_USER],
    });

    await eventsStore.respondToInvitation(TEST_EVENT_ID, true);

    const server = await pb.collection("events").getOne(TEST_EVENT_ID);
    expect(server.teams).toEqual([TEST_TEAM_ID]);
    expect(server.guestUsers).toEqual([OTHER_USER]);
  });
});

describe("canUserEditEvent — l'édition est la récompense de la confirmation", () => {
  it("le créateur édite", async () => {
    await seedEvent({ createdBy: session.userId });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      true,
    );
  });

  it("le participant confirmé édite", async () => {
    await seedEvent({ contributors: [sessionEntry("accepted")] });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      true,
    );
  });

  it("le membre d'une équipe invitée sans entrée ne peut PAS éditer", async () => {
    await seedEvent({ teams: [TEST_TEAM_ID] });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      false,
    );
  });

  it("la personne rendue visible (guestUsers) sans entrée ne peut PAS éditer", async () => {
    await seedEvent({ guestUsers: [session.userId] });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      false,
    );
  });

  it("l'invité réel (entrée invited) ne peut PAS éditer", async () => {
    await seedEvent({
      guestUsers: [session.userId],
      contributors: [sessionEntry("invited")],
    });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      false,
    );
  });

  it("le décliné ne peut PAS éditer", async () => {
    await seedEvent({
      teams: [TEST_TEAM_ID],
      contributors: [sessionEntry("declined")],
    });

    expect(eventsStore.canUserEditEvent(TEST_EVENT_ID, session.userId)).toBe(
      false,
    );
  });
});
