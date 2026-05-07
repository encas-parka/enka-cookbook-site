/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook : cascade delete quand une team est supprimee.
 *
 * IMPORTANT : ne supprime PAS les events (relation many-to-many).
 * Quand une team est supprimee, ce hook nettoie les ressources
 * qui lui appartiennent :
 *   - materiel (teamId reference directe)
 *   - teamdocs (teamId reference directe)
 *   - share_links de type "team" (link_type + target_id texte)
 *
 * Les events sont preserves car une team peut etre associee
 * a plusieurs events et un event a plusieurs teams.
 */

onRecordAfterDeleteSuccess(function (e) {
  var team = e.record;
  var teamId = team.id;
  var teamName = team.getString("name") || teamId;

  var totalDeleted = 0;

  // --- 1. Supprimer le materiel de la team ---
  try {
    var materielRecords = $app.findRecordsByFilter(
      "materiel",
      "teamId = {:teamId}",
      "",
      999,
      0,
      { teamId: teamId }
    );

    if (materielRecords && materielRecords.length > 0) {
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
    }
  } catch (err) {
    $app.logger().error(
      "Cascade delete team: erreur materiel",
      "teamId", teamId,
      "error", String(err)
    );
  }

  // --- 2. Supprimer les teamdocs de la team ---
  try {
    var teamdocsRecords = $app.findRecordsByFilter(
      "teamdocs",
      "teamId = {:teamId}",
      "",
      999,
      0,
      { teamId: teamId }
    );

    if (teamdocsRecords && teamdocsRecords.length > 0) {
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
    }
  } catch (err) {
    $app.logger().error(
      "Cascade delete team: erreur teamdocs",
      "teamId", teamId,
      "error", String(err)
    );
  }

  // --- 3. Supprimer les share_links de type "team" ciblant cette team ---
  try {
    var shareLinksRecords = $app.findRecordsByFilter(
      "share_links",
      "link_type = {:linkType} && target_id = {:targetId}",
      "",
      999,
      0,
      { linkType: "team", targetId: teamId }
    );

    if (shareLinksRecords && shareLinksRecords.length > 0) {
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
    }
  } catch (err) {
    $app.logger().error(
      "Cascade delete team: erreur share_links",
      "teamId", teamId,
      "error", String(err)
    );
  }

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
