/**
 * @vitest-environment jsdom
 */

/**
 * EventsStore — chemin de création d'event + garde d'idempotence réseau.
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * events-store-invitation / products-store-create.
 *
 * Contrat serveur mesuré par la sonde HTTP T10 (probe-t10-event-idempotency,
 * PB dev 0.37.5) : create accepte un id client (préservé tel quel) et rejette
 * un second create portant le même id (400, validation_not_unique sur `id`).
 * C'est ce qui transforme un id client en clé d'idempotence : après un échec
 * ambigu (requête partie, réponse perdue), la re-soumission avec la même clé
 * ne peut pas dupliquer — l'event déjà créé est réconcilié par relecture.
 *
 * Couvre :
 *  - le chemin create simple (payload, miroir Dexie, createdBy posé) ;
 *  - la clé de soumission est préservée comme id serveur ;
 *  - re-soumission après échec ambigu → l'event existant est retourné,
 *    aucun doublon n'est créé (le record est rendu visible en local :
 *    le SSE a pu manquer pendant la panne) ;
 *  - échec réel sans ambiguïté (rien côté serveur) → l'erreur d'origine
 *    est relancée, rien n'est créé.
 */

vi.mock("$lib/services/pb-users", () => ({
  lookupUsersByEmails: vi.fn(),
}));

vi.mock("$lib/services/pb-invitations", () => ({
  getOrCreateShareLink: vi.fn(async () => ({
    id: "sharelinknew00001",
    created: true,
  })),
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
import { makeEvent } from "./harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { getOrCreateShareLink } from "$lib/services/pb-invitations";
import { db, pb } from "$lib/db-sync/pb-sync";

const ORGANIZER_ID = "userorganizer01";
/** 15 chars, PB-id shaped — the form-session submission key. */
const SUBMISSION_KEY = "t10submit0000001";

describe("EventsStore — création d'event + idempotence réseau", () => {
  beforeEach(() => {
    currentFakePb().reset();
    db.events.clear();
  });

  it("createEventWithTeams crée l'event serveur, pose createdBy et miroite en Dexie", async () => {
    const enriched = await eventsStore.createEventWithTeams({
      name: "Fête du village",
      description: "Édition annuelle",
    });

    const server = await pb.collection("events").getOne(enriched.id);
    expect(server.name).toBe("Fête du village");
    expect(server.createdBy).toBe(ORGANIZER_ID);
    expect(server.status).toBe("proposition");
    // Le miroir Dexie alimente les vues (liveQuery) sans attendre le SSE
    await waitForTick(2);
    const local = await db.events.get(enriched.id);
    expect(local?.name).toBe("Fête du village");
  });

  it("un event créé naît avec son lien de partage (get-or-create)", async () => {
    vi.mocked(getOrCreateShareLink).mockClear();

    const enriched = await eventsStore.createEventWithTeams({
      name: "Naissance du lien",
    });

    // Le lien naît en fire-and-forget, juste après le create
    await waitForTick(2);
    expect(vi.mocked(getOrCreateShareLink)).toHaveBeenCalledWith(
      enriched.id,
      ORGANIZER_ID,
    );
  });

  it("la clé de soumission est préservée comme id serveur", async () => {
    const enriched = await eventsStore.createEventWithTeams(
      { name: "Camp d'été" },
      [],
      SUBMISSION_KEY,
    );

    expect(enriched.id).toBe(SUBMISSION_KEY);
    const server = await pb.collection("events").getOne(SUBMISSION_KEY);
    expect(server.name).toBe("Camp d'été");
  });

  it("re-soumission après échec ambigu : réconcilie l'event déjà créé au lieu de dupliquer", async () => {
    // La première tentative a abouti côté serveur mais la réponse a été
    // perdue : le record existe sur le serveur, jamais en Dexie.
    const landed = makeEvent({
      id: SUBMISSION_KEY,
      name: "Camp d'été",
      createdBy: ORGANIZER_ID,
    });
    currentFakePb().seed("events", [landed]);

    const enriched = await eventsStore.createEventWithTeams(
      { name: "Camp d'été" },
      [],
      SUBMISSION_KEY,
    );

    // L'event préexistant est retourné — pas un second record
    expect(enriched.id).toBe(SUBMISSION_KEY);
    const records = currentFakePb().records("events");
    expect(records.filter((r) => r.id === SUBMISSION_KEY)).toHaveLength(1);
    // Visible localement malgré la panne : miroir Dexie posé par la réconciliation
    await waitForTick(2);
    const local = await db.events.get(SUBMISSION_KEY);
    expect(local?.id).toBe(SUBMISSION_KEY);
  });

  it("échec réel sans ambiguïté : l'erreur d'origine est relancée, rien n'est créé", async () => {
    const fake = currentFakePb();
    const originalCollection = fake.collection.bind(fake);
    vi.spyOn(fake, "collection").mockImplementation((collName: string) => {
      const coll = originalCollection(collName);
      if (collName !== "events") return coll;
      return {
        ...coll,
        create: async () => {
          throw new Error("network unreachable");
        },
      };
    });

    await expect(
      eventsStore.createEventWithTeams({ name: "Annulé" }, [], SUBMISSION_KEY),
    ).rejects.toThrow("network unreachable");

    // Rien côté serveur : la réconciliation a 404, l'erreur de create prévaut
    expect(currentFakePb().records("events")).toHaveLength(0);
    expect(await db.events.get(SUBMISSION_KEY)).toBeUndefined();
  });
});
