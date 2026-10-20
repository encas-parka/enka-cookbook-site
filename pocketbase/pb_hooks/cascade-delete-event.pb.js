/**
 * Hook : cascade delete quand un event est supprime.
 *
 * onRecordDelete (AVANT le delete) : les relations enfants sont encore
 * intactes a ce stade — PocketBase nullifie les references pendantes
 * apres le delete, un filtre "eventId = ..." ne trouve donc plus rien
 * en onRecordAfterDeleteSuccess (mesure 06-10). Le delete AVANT rend
 * aussi possible la suppression d'un event reference par une relation
 * required (products/purchases/event_materiel/event_todos.eventId) :
 * PB refuse ce delete tant que les enfants existent (400).
 *
 * Supprime tous les enregistrements lies a l'evenement :
 *   1. products       (eventId, required)
 *   2. purchases      (eventId, required)
 *   3. event_materiel (eventId, required)
 *   4. event_todos    (eventId, required)
 *   5. teamdocs       (eventId)
 *   6. share_links    (link_type = "event" AND target_id = event.id)
 *   7. materiel_loan  (eventId)
 *   8. notifications  (id de l'event present dans link OU data)
 *
 * Limite purge notifications : match par sous-chaine de l'id dans
 * link/data — un id d'event reapparaissant par hasard dans une
 * notification sans rapport serait supprime aussi (probabilite
 * negligeable, ids PB aleatoires de 15 chars) ; une notification
 * referencant l'event autrement que par son id dans ces champs
 * echapperait a la purge (pas de relation dedicatee au schema).
 *
 * Fail-closed : pas d'avalage d'erreur — tout echec de cascade
 * propage et ANNULE la suppression de l'event (pas de delete partiel,
 * pas d'orphelin silencieux). Limite 999/enfant (acceptable).
 */

/// <reference path="../pb_data/types.d.ts" />

onRecordDelete(function (e) {
  var event = e.record;
  var eventId = event.id;

  // --- 1-4. Enfants a relation eventId (required ou non) ---
  var children = [
    { collection: "products", label: "products" },
    { collection: "purchases", label: "purchases" },
    { collection: "event_materiel", label: "event_materiel" },
    { collection: "event_todos", label: "event_todos" },
    { collection: "teamdocs", label: "teamdocs" },
    { collection: "materiel_loan", label: "materiel_loan" },
  ];
  for (var c = 0; c < children.length; c++) {
    var child = children[c];
    var records = $app.findRecordsByFilter(
      child.collection,
      "eventId = {:eventId}",
      undefined,
      999,
      0,
      { eventId: eventId },
    );
    for (var i = 0; i < records.length; i++) {
      $app.delete(records[i]);
    }
    $app
      .logger()
      .info(
        "Cascade delete " + child.label,
        "eventId",
        eventId,
        "deleted",
        String(records.length),
      );
  }

  // --- 6. Supprimer les share_links (link_type = "event" ET target_id = eventId) ---
  var shareLinks = $app.findRecordsByFilter(
    "share_links",
    "link_type = {:linkType} && target_id = {:targetId}",
    undefined,
    999,
    0,
    { linkType: "event", targetId: eventId },
  );
  for (var n = 0; n < shareLinks.length; n++) {
    $app.delete(shareLinks[n]);
  }
  $app
    .logger()
    .info(
      "Cascade delete share_links",
      "eventId",
      eventId,
      "deleted",
      String(shareLinks.length),
    );

  // --- 8. Purger les notifications referencant l'event ---
  // Pas de relation dedicatee : match pragmatique par sous-chaine sur
  // link (texte) et data (json serialise). ~ = LIKE sous-chaine.
  var notifs = $app.findRecordsByFilter(
    "notifications",
    "link ~ {:eventId} || data ~ {:eventId}",
    undefined,
    999,
    0,
    { eventId: eventId },
  );
  for (var q = 0; q < notifs.length; q++) {
    $app.delete(notifs[q]);
  }
  $app
    .logger()
    .info(
      "Cascade delete notifications",
      "eventId",
      eventId,
      "deleted",
      String(notifs.length),
    );

  e.next();
}, "events");
