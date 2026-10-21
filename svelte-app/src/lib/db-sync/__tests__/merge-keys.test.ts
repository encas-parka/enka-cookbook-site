/**
 * mergeByKey — stratégie de merge concurrent pour les champs tableau.
 *
 * Sémantique (fonction pure, sans réseau) : les entrées distantes posent la
 * base, les locales écrasent par clé — le device garde SES modifications en
 * cours sans perdre les lignes arrivées du serveur entre-temps. Testé à part :
 * aucun autre fichier de la suite ne nomme la stratégie.
 */
import { describe, it, expect } from "vitest";
import { mergeByKey } from "$lib/db-sync/pb-collection";

interface Participant {
  id: string;
  name: string;
}

describe("mergeByKey", () => {
  const strategy = mergeByKey<Participant>("id");

  it("les entrées distantes nouvelles s'ajoutent aux locales", () => {
    const local = [{ id: "a", name: "Alice" }];
    const remote = [{ id: "b", name: "Bob" }];

    const merged = strategy(local, remote);

    expect(merged.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("sur collision, la version locale gagne (le device garde sa modification)", () => {
    const local = [{ id: "a", name: "Alice (éditée localement)" }];
    const remote = [{ id: "a", name: "Alice (serveur)" }];

    const merged = strategy(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("Alice (éditée localement)");
  });

  it("les lignes supprimées côté serveur n'apparaissent plus si absentes du local", () => {
    const local = [{ id: "a", name: "Alice" }];
    const remote = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ];

    const merged = strategy(local, remote);

    expect(merged.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
});
