import { describe, it, expect } from "vitest";
import { resolveRemoteDocUpdate, type DocDraftState } from "../doc-remote-sync";

const draft = (
  title: string,
  content: string,
  tags: string[],
): DocDraftState => ({
  title,
  content,
  tags,
});

describe("resolveRemoteDocUpdate — propagation du contenu distant (T05)", () => {
  it("propage le contenu distant quand l'utilisateur local n'a rien modifié", () => {
    const snapshot = draft("Recette", "Version 1", ["produit"]);
    const local = snapshot;

    const decision = resolveRemoteDocUpdate(
      local,
      snapshot,
      draft("Recette à jour", "Version 2 — modifiée par userA", [
        "produit",
        "tache",
      ]),
    );

    expect(decision).toEqual({
      action: "apply",
      draft: draft("Recette à jour", "Version 2 — modifiée par userA", [
        "produit",
        "tache",
      ]),
    });
  });

  it("n'écrase pas les saisies locales non sauvegardées (anti-écrasement)", () => {
    const snapshot = draft("Recette", "Version 1", []);
    const local = draft("Recette modifiée", "Saisie en cours userB", []);

    const decision = resolveRemoteDocUpdate(
      local,
      snapshot,
      draft("Recette à jour", "Version 2 — modifiée par userA", []),
    );

    expect(decision).toEqual({ action: "skip", reason: "dirty" });
  });

  it("l'utilisateur sale garde ses saisies même si le distant revient à la baseline", () => {
    const snapshot = draft("Recette", "Version 1", []);
    const local = draft("Recette modifiée", "Saisie en cours userB", []);

    const decision = resolveRemoteDocUpdate(local, snapshot, snapshot);

    expect(decision).toEqual({ action: "skip", reason: "dirty" });
  });

  it("ignore l'écho d'une sauvegarde déjà reflétée en local (pas de churn)", () => {
    const saved = draft("Recette enregistrée", "Contenu sauvegardé", [
      "materiel",
    ]);

    const decision = resolveRemoteDocUpdate(saved, saved, saved);

    expect(decision).toEqual({ action: "skip", reason: "unchanged" });
  });

  it("détecte un changement limité aux tags (ordre significatif, champ par champ)", () => {
    const snapshot = draft("Recette", "Contenu", ["produit", "tache"]);
    const local = snapshot;

    // Même contenu texte, tags réordonnés : le contenu distant a changé.
    const reordered = resolveRemoteDocUpdate(local, snapshot, {
      ...snapshot,
      tags: ["tache", "produit"],
    });
    expect(reordered.action).toBe("apply");

    // Même contenu texte, tag ajouté : le contenu distant a changé.
    const added = resolveRemoteDocUpdate(local, snapshot, {
      ...snapshot,
      tags: ["produit", "tache", "recette"],
    });
    expect(added).toEqual({
      action: "apply",
      draft: draft("Recette", "Contenu", ["produit", "tache", "recette"]),
    });
  });
});
