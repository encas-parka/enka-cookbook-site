/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook : cascade delete quand une team est supprimee.
 *
 * onRecordDelete (AVANT le delete) : les relations enfants sont encore
 * intactes a ce stade — PocketBase nullifie les references pendantes
 * apres le delete (et retire l'id des relations multi), un filtre
 * "teamId = ..." ne trouve donc plus rien en
 * onRecordAfterDeleteSuccess (mesure 06-10).
 *
 * IMPORTANT : ne supprime PAS les events (relation many-to-many).
 * Quand une team est supprimee, ce hook nettoie les ressources
 * qui lui appartiennent :
 *   - materiel (teamId reference directe)
 *   - teamdocs (teamId reference directe)
 *   - share_links de type "team" (link_type + target_id texte)
 *   - materiel_loan dont ownerId (= cette team) — un emprunt sans
 *     equipe propriétaire n'a pas de sens (delete, pas de detach)
 *   - events.teams : retrait de l'id de la team des relations events.
 *     PB purgerait l'id lui-meme, mais sans bump de `updated` — le
 *     save explicite resynchronise les clients (delta sync).
 *
 * Les events sont preserves car une team peut etre associee
 * a plusieurs events et un event a plusieurs teams.
 *
 * Fail-closed : pas d'avalage d'erreur — tout echec de cascade
 * propage et ANNULE la suppression de la team (pas de delete partiel,
 * pas d'orphelin silencieux). Limite 999/zone (acceptable).
 */

onRecordDelete(function (e) {
  var team = e.record;
  var teamId = team.id;
  var teamName = team.getString("name") || teamId;

  var totalDeleted = 0;

  // --- 1. Supprimer le materiel de la team ---
  var materielRecords = $app.findRecordsByFilter(
    "materiel",
    "teamId = {:teamId}",
    "",
    999,
    0,
    { teamId: teamId }
  );
  var materielCount = materielRecords.length;
  for (var i = 0; i < materielCount; i++) {
    $app.delete(materielRecords[i]);
  }
  totalDeleted += materielCount;
  $app.logger().info(
    "Cascade delete team: materiel supprimes",
    "teamId", teamId,
    "teamName", teamName,
    "count", String(materielCount)
  );

  // --- 2. Supprimer les teamdocs de la team ---
  var teamdocsRecords = $app.findRecordsByFilter(
    "teamdocs",
    "teamId = {:teamId}",
    "",
    999,
    0,
    { teamId: teamId }
  );
  var teamdocsCount = teamdocsRecords.length;
  for (var j = 0; j < teamdocsCount; j++) {
    $app.delete(teamdocsRecords[j]);
  }
  totalDeleted += teamdocsCount;
  $app.logger().info(
    "Cascade delete team: teamdocs supprimes",
    "teamId", teamId,
    "teamName", teamName,
    "count", String(teamdocsCount)
  );

  // --- 3. Supprimer les share_links de type "team" ciblant cette team ---
  var shareLinksRecords = $app.findRecordsByFilter(
    "share_links",
    "link_type = {:linkType} && target_id = {:targetId}",
    "",
    999,
    0,
    { linkType: "team", targetId: teamId }
  );
  var shareLinksCount = shareLinksRecords.length;
  for (var k = 0; k < shareLinksCount; k++) {
    $app.delete(shareLinksRecords[k]);
  }
  totalDeleted += shareLinksCount;
  $app.logger().info(
    "Cascade delete team: share_links supprimes",
    "teamId", teamId,
    "teamName", teamName,
    "count", String(shareLinksCount)
  );

  // --- 4. Supprimer les materiel_loan dont la team est propriétaire ---
  // Decision : delete (pas de detach sur NULL) — un loan sans equipe
  // propriétaire n'a pas de sens metier.
  var loansRecords = $app.findRecordsByFilter(
    "materiel_loan",
    "ownerId = {:teamId}",
    "",
    999,
    0,
    { teamId: teamId }
  );
  var loansCount = loansRecords.length;
  for (var m = 0; m < loansCount; m++) {
    $app.delete(loansRecords[m]);
  }
  totalDeleted += loansCount;
  $app.logger().info(
    "Cascade delete team: materiel_loan supprimes",
    "teamId", teamId,
    "teamName", teamName,
    "count", String(loansCount)
  );

  // --- 5. Retirer l'id de la team des relations events.teams ---
  // events.teams est une relation multi (maxSelect 999) : record.get()
  // renvoie un []any de strings sains (pas le piege goja des champs JSON).
  // Le save bump `updated` -> les clients resynchronisent (delta sync).
  var eventsRecords = $app.findRecordsByFilter(
    "events",
    "teams ~ {:teamId}",
    "",
    999,
    0,
    { teamId: teamId }
  );
  var eventsCount = eventsRecords.length;
  for (var n = 0; n < eventsCount; n++) {
    var ev = eventsRecords[n];
    var evTeams = ev.get("teams");
    if (!Array.isArray(evTeams)) {
      continue;
    }
    var cleaned = [];
    for (var p = 0; p < evTeams.length; p++) {
      if (evTeams[p] !== teamId) {
        cleaned.push(evTeams[p]);
      }
    }
    ev.set("teams", cleaned);
    $app.save(ev);
  }
  $app.logger().info(
    "Cascade delete team: events.teams nettoye",
    "teamId", teamId,
    "teamName", teamName,
    "events", String(eventsCount)
  );

  // Resume global
  if (totalDeleted > 0) {
    $app.logger().info(
      "Cascade delete team: total ressources supprimees",
      "teamId", teamId,
      "teamName", teamName,
      "totalDeleted", String(totalDeleted)
    );
  }

  e.next();
}, "teams");
