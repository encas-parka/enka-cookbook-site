/**
 * @vitest-environment jsdom
 */

/**
 * EventDocumentsFieldset — les documents d'un événement (ADR 0004, D).
 *
 * Seam : vrai composant monté en jsdom ; `teamdocsStore` est remplacé par
 * une liste pilotée par le test et `navigate` est espionné (aucun routage
 * réel n'est en jeu).
 *
 * Contrats épinglés :
 *  - chaque document rend un lien vers son éditeur
 *  - sans document : « Aucun document »
 *  - canEdit : bouton de création qui route vers /event/:id/document/create
 *  - hors édition : pas de bouton de création
 */

const h = vi.hoisted(() => ({
  docs: [] as Array<{ id: string; title: string }>,
}));

vi.mock("$lib/stores/TeamdocsStore.svelte", () => ({
  teamdocsStore: {
    getEventDocuments: () => h.docs,
  },
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock("$lib/router", () => ({ navigate }));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import EventDocumentsFieldset from "../EventDocumentsFieldset.svelte";
import { mountSvelte, cleanupSvelte, getByText } from "$lib/test/mount-svelte";

function mountFieldset(canEdit = true) {
  return mountSvelte(EventDocumentsFieldset, {
    eventId: "event000000001",
    canEdit,
  });
}

beforeEach(() => {
  h.docs = [];
  navigate.mockReset();
});
afterEach(() => cleanupSvelte());

describe("EventDocumentsFieldset", () => {
  it("chaque document rend un lien vers son éditeur", () => {
    h.docs = [
      { id: "docA", title: "Menus du samedi" },
      { id: "docB", title: "Liste de courses" },
    ];
    const target = mountFieldset();

    const links = target.querySelectorAll<HTMLAnchorElement>('a[href^="/"]');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(
      "/event/event000000001/document/docA/edit",
    );
    expect(links[0].textContent).toContain("Menus du samedi");
    expect(links[1].textContent).toContain("Liste de courses");
  });

  it("sans document : « Aucun document »", () => {
    const target = mountFieldset();

    expect(target.textContent).toContain("Aucun document");
    expect(target.querySelector('a[href^="/"]')).toBeNull();
  });

  it("canEdit : le bouton de création route vers l'éditeur de document", () => {
    const target = mountFieldset(true);

    getByText(target, "button", "Créer un document").click();

    expect(navigate).toHaveBeenCalledWith(
      "/event/event000000001/document/create",
    );
  });

  it("hors édition : pas de bouton de création", () => {
    const target = mountFieldset(false);

    expect(target.textContent).not.toContain("Créer un document");
  });
});
