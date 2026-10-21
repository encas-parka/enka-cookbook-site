/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

/**
 * Service share links — get-or-create et régénération.
 *
 * Le service tourne RÉEL contre le fake PocketBase (transport factice) :
 * aucune mock de pb-invitations ici, contrairement aux tests store qui
 * mockent le module. Vérifie le contrat du point de passage unique :
 *  - getOrCreateShareLink retourne le lien actif existant sans créer ;
 *  - il crée un lien pour un événement qui n'en possède pas ;
 *  - regenerateShareLink désactive les liens actifs puis en crée un neuf.
 */

import { currentFakePb, pbDate } from "./harness/stub-pb";
import {
  getOrCreateShareLink,
  regenerateShareLink,
  getEventShareLinks,
} from "$lib/services/pb-invitations";

const TEST_EVENT_ID = "eventsharelink01";

function seedLink(id: string, eventId: string, isActive = true) {
  currentFakePb().putRecord("share_links", {
    id,
    created: pbDate(),
    updated: pbDate(),
    target_id: eventId,
    link_type: "event",
    isActive,
    token: "",
    createdBy: "userorganizer01",
  });
}

describe("pb-invitations — get-or-create du lien de partage", () => {
  beforeEach(() => {
    currentFakePb().reset();
  });

  it("retourne le lien actif existant sans créer", async () => {
    seedLink("linkexisting01", TEST_EVENT_ID);

    const result = await getOrCreateShareLink(TEST_EVENT_ID, "userorganizer01");

    expect(result).toEqual({ id: "linkexisting01", created: false });
    const active = await getEventShareLinks(TEST_EVENT_ID);
    expect(active).toEqual(["linkexisting01"]);
  });

  it("crée un lien pour un événement qui n'en possède pas", async () => {
    const result = await getOrCreateShareLink(TEST_EVENT_ID, "userorg000001");

    expect(result.created).toBe(true);
    const active = await getEventShareLinks(TEST_EVENT_ID);
    expect(active).toEqual([result.id]);
  });

  it("ignore les liens désactivés (régénérés) et en crée un neuf", async () => {
    seedLink("linkdead000001", TEST_EVENT_ID, false);

    const result = await getOrCreateShareLink(TEST_EVENT_ID, "userorg000001");

    expect(result.created).toBe(true);
    const active = await getEventShareLinks(TEST_EVENT_ID);
    expect(active).toEqual([result.id]);
  });
});

describe("pb-invitations — régénération du lien", () => {
  beforeEach(() => {
    currentFakePb().reset();
  });

  it("désactive tous les liens actifs puis crée le remplaçant", async () => {
    seedLink("linkold0000001", TEST_EVENT_ID);
    seedLink("linklegacy0001", TEST_EVENT_ID);

    const regenerated = await regenerateShareLink(
      TEST_EVENT_ID,
      "userorg000001",
    );

    const active = await getEventShareLinks(TEST_EVENT_ID);
    expect(active).toEqual([regenerated.id]);
    expect(active).not.toContain("linkold0000001");
    expect(active).not.toContain("linklegacy0001");
  });
});
