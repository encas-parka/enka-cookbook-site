/// <reference path="../pb_data/types.d.ts" />

// Rôles d'équipe legacy + suppression materiel (décision produit 07-10, plan A).
//
// 1. Backfill teams.roles des 8 teams importées d'Appwrite. Le transform ne
//    mappait pas les _memberships (roles: ["owner"]) → roles = NULL en DB →
//    enrichTeamFromPB attribuait ["member"] à tout le monde : aucun owner,
//    donc aucun droit d'admin (config team, gestion des membres) sur les
//    teams de prod. Clés = ids PB users (résolus depuis l'export via id-map).
//
// 2. deleteRule materiel / materiel_loan : `createdBy = auth` est inapplicable
//    sur le legacy (createdBy et ownerUser vides — la source Appwrite n'a
//    jamais porté ces valeurs, owner.userId = "" sur 110/110). Les
//    permissions Appwrite réelles étaient collectives : delete("team:Enka
//    Parka") sur 80/110, aucun delete sur 30/110. La règle team-scopée
//    rétablit la parité (les owners, membres de l'équipe, peuvent supprimer) :
//    - materiel : créateur OU membres de l'équipe du materiel ;
//    - materiel_loan : créateur OU membres de l'équipe propriétaire (ownerId
//      = team, convention héritée du transform).
//
// JSVM : get() sur un champ JSON renvoie l'export goja du []byte brut —
// lire via getString() + JSON.parse (piège documenté dans pb_hooks).
//
// Idempotent : les teams ayant déjà une map roles non vide ne sont pas
// touchées (teams créées via le SPA post-migration).

const rolesByTeamId = {
  // admins (aucun membership exporté)
  "0q36k20d7n41h5n": {},
  // Enka Parka — owners : ghald, Marion
  "7f7mdvjiq9hduvb": { dilkax2sd57pngb: "owner", mv9t0n73azqugcc: "owner" },
  // Q77 — owner : qaldek
  hbmpe2ja3quxmxe: { entfrelmcb8dp9s: "owner" },
  // Q88 — owners : qaldek, ghald
  oxj3pjbsc7r4zyh: { entfrelmcb8dp9s: "owner", dilkax2sd57pngb: "owner" },
  // meeting alarm phone — owner : Miki
  oynmmkjcffog7o2: { "8l6vjya7gxjh1tm": "owner" },
  // meeting alarmphone — owners : Miki, cantinax26
  "3q3nf86k3mden7e": { "8l6vjya7gxjh1tm": "owner", bi691ijo5njwhy7: "owner" },
  // CSP — owner : vroukapik
  fikx0zmcowy9u54: { h5yjwudp75c0vwh: "owner" },
  // SOEVE — owner : Eve
  "2hm12wl73el9dju": { yp2gozko0dgvt4t: "owner" },
};

function applyRolesBackfill(app) {
  for (const teamId in rolesByTeamId) {
    // setup à froid : les records teams n'existent pas encore (l'import
    // pipeline tourne APRÈS les migrations) — findRecordById lève en JSVM
    // sur id inconnu, ce n'est pas un cas d'erreur ici.
    var team;
    try {
      team = app.findRecordById("teams", teamId);
    } catch (err) {
      continue;
    }
    if (!team) continue;
    var current = {};
    var raw = team.getString("roles");
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed;
        }
      } catch (err) {
        current = {};
      }
    }
    if (Object.keys(current).length > 0) continue;
    team.set("roles", rolesByTeamId[teamId]);
    app.save(team);
  }
}

function revertRoles(app) {
  for (const teamId in rolesByTeamId) {
    var team;
    try {
      team = app.findRecordById("teams", teamId);
    } catch (err) {
      continue;
    }
    if (!team) continue;
    team.set("roles", null);
    app.save(team);
  }
}

function applyDeleteRules(app) {
  var materiel = app.findCollectionByNameOrId("materiel");
  materiel.deleteRule =
    '@request.auth.id != "" && (createdBy = @request.auth.id || teamId.members ~ @request.auth.id)';
  app.save(materiel);

  var loans = app.findCollectionByNameOrId("materiel_loan");
  loans.deleteRule =
    '@request.auth.id != "" && (createdBy = @request.auth.id || ownerId.members ~ @request.auth.id)';
  app.save(loans);
}

function revertDeleteRules(app) {
  var materiel = app.findCollectionByNameOrId("materiel");
  materiel.deleteRule =
    '@request.auth.id != "" && createdBy = @request.auth.id';
  app.save(materiel);

  var loans = app.findCollectionByNameOrId("materiel_loan");
  loans.deleteRule =
    '@request.auth.id != "" && createdBy = @request.auth.id';
  app.save(loans);
}

migrate((app) => {
  applyRolesBackfill(app);
  applyDeleteRules(app);
}, (app) => {
  revertRoles(app);
  revertDeleteRules(app);
});
