/// <reference path="../pb_data/types.d.ts" />

// Ré-application du backfill teams.roles sur les pb_data où 1791500000 a déjà
// tourné avec sa première version : la lecture `get()` du champ JSON renvoyait
// l'export goja du []byte brut (wrapper truthy) → garde fausse → backfill
// skippé silencieusement (les deleteRule, elles, ont bien été appliquées).
//
// Pattern sûr (documenté dans pb_hooks/invite-to-team.pb.js) : getString()
// + JSON.parse. Garde idempotente : map non vide = team déjà backfillée ou
// gérée via le SPA → skip. Sur un deploy à froid, 1791500000 fait déjà le
// job et celle-ci ne fait rien.

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

migrate((app) => {
  for (var teamId in rolesByTeamId) {
    var team;
    try {
      team = app.findRecordById("teams", teamId);
    } catch (err) {
      continue; // setup à froid : records pas encore importés
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
}, (app) => {
  // down : aucun retour arrière (le state NULL d'origine n'est pas
  // distinguable d'une map vidée volontairement via le SPA)
});
