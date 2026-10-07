/**
 * @vitest-environment jsdom
 */

/**
 * TeamdocsStore — documents liés par tag (pb-sync).
 *
 * Validates the tag-filtering layer against the FAKE PocketBase transport:
 * a real `initialFetch` fills Dexie from the seeded server records, then
 * `getEventDocumentsByTag` / `getTeamTags` filter over the liveQuery-fed
 * SvelteMap — the same code path the EventDocumentsBloc renders from.
 *
 * Exercises:
 *  - fake-indexeddb (real Dexie) + real Svelte 5 reactivity
 *  - the fake PocketBase SDK (no network) with contract-faithful records
 *  - mocked GlobalState singleton (auth gate of the 3-phase init)
 */

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb } from "./harness/stub-pb";
import { waitForTick } from "./harness/wait-for-tick";
import { makeTeamdocsRecord, TEST_EVENT_ID } from "./harness/fixtures";
import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";

/** Second event, unrelated to the fixture docs' event. */
const EVENT_B_ID = "t02eventb0000001";
/** Team scope for the getTeamTags test. */
const TEAM_A_ID = "t02team000000001";
const TEAM_B_ID = "t02team000000002";

/** Reseed the fake server records and run a fresh 3-phase init.
 * softReset (never destroy: it would unsubscribe the singleton's liveQuery
 * bridge for good) + ticks — the liveQuery→SvelteMap propagation is async. */
async function seedAndInit(
  records: ReturnType<typeof makeTeamdocsRecord>[],
): Promise<void> {
  const fakePb = currentFakePb();
  fakePb.reset();
  await teamdocsStore.softReset();
  await waitForTick(5); // leave the liveQuery time to see the Dexie clear
  fakePb.seed("teamdocs", records);
  await teamdocsStore.initialize();
  await waitForTick(5);
}

describe("TeamdocsStore — documents liés par tag (pb-sync)", () => {
  beforeEach(async () => {
    // Default dataset: event A docs with tags (one matching "produit"),
    // an event B doc with the same tag, and an event A doc without tags.
    await seedAndInit([
      makeTeamdocsRecord({
        id: "t02doc-a-produit",
        title: "Doc A produit",
        eventId: TEST_EVENT_ID,
        tags: ["produit", "tache"],
      }),
      makeTeamdocsRecord({
        id: "t02doc-a-recette",
        title: "Doc A recette",
        eventId: TEST_EVENT_ID,
        tags: ["recette"],
      }),
      makeTeamdocsRecord({
        id: "t02doc-a-sans-tags",
        title: "Doc A sans tags",
        eventId: TEST_EVENT_ID,
        tags: null,
      }),
      makeTeamdocsRecord({
        id: "t02doc-b-produit",
        title: "Doc B produit",
        eventId: EVENT_B_ID,
        tags: ["produit"],
      }),
    ]);
  });

  it("getEventDocumentsByTag filtre eventId + tag (event B sans rapport exclu)", () => {
    const docs = teamdocsStore.getEventDocumentsByTag(TEST_EVENT_ID, "produit");

    expect(docs.map((d) => d.id)).toEqual(["t02doc-a-produit"]);
  });

  it("un doc sans tags n'est jamais retourné par le filtre par tag", () => {
    const docs = teamdocsStore.getEventDocumentsByTag(TEST_EVENT_ID, "recette");

    expect(docs.map((d) => d.id)).toEqual(["t02doc-a-recette"]);
    expect(
      teamdocsStore.getEventDocumentsByTag(TEST_EVENT_ID, "materiel"),
    ).toEqual([]);
  });

  it("getTeamTags agrège les tags uniques et triés des docs de l'équipe", async () => {
    await seedAndInit([
      makeTeamdocsRecord({
        id: "t02doc-team-1",
        teamId: TEAM_A_ID,
        eventId: null,
        tags: ["produit", "tache"],
      }),
      makeTeamdocsRecord({
        id: "t02doc-team-2",
        teamId: TEAM_A_ID,
        eventId: null,
        tags: ["produit", "recette"],
      }),
      makeTeamdocsRecord({
        id: "t02doc-team-3",
        teamId: TEAM_B_ID,
        eventId: null,
        tags: ["autre-team"],
      }),
      // Doc de l'équipe A sans tags : ignoré par la collecte
      makeTeamdocsRecord({
        id: "t02doc-team-4",
        teamId: TEAM_A_ID,
        eventId: null,
        tags: null,
      }),
    ]);

    expect(teamdocsStore.getTeamTags(TEAM_A_ID)).toEqual([
      "produit",
      "recette",
      "tache",
    ]);
    expect(teamdocsStore.getTeamTags(TEAM_B_ID)).toEqual(["autre-team"]);
  });
});
