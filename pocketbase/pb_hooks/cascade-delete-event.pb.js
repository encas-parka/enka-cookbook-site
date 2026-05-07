/**
 * Hook : cascade delete quand un event est supprime.
 *
 * Supprime tous les enregistrements lies a l'evenement :
 *   1. products       (eventId)
 *   2. purchases      (eventId)
 *   3. event_materiel (eventId)
 *   4. event_todos    (eventId)
 *   5. teamdocs       (eventId)
 *   6. share_links    (link_type = "event" AND target_id = event.id)
 */

/// <reference path="../pb_data/types.d.ts" />

onRecordAfterDeleteSuccess(function (e) {
  var event = e.record;
  var eventId = event.id;

  // --- 1. Supprimer les products ---
  try {
    var products = $app.findRecordsByFilter(
      "products",
      "eventId = {:eventId}",
      undefined,  // sort
      999,        // limit
      0,          // offset
      { eventId: eventId }
    );
    for (var i = 0; i < products.length; i++) {
      $app.delete(products[i]);
    }
    $app.logger().info(
      "Cascade delete products",
      "eventId", eventId,
      "deleted", String(products.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete products failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  // --- 2. Supprimer les purchases ---
  try {
    var purchases = $app.findRecordsByFilter(
      "purchases",
      "eventId = {:eventId}",
      undefined,
      999,
      0,
      { eventId: eventId }
    );
    for (var j = 0; j < purchases.length; j++) {
      $app.delete(purchases[j]);
    }
    $app.logger().info(
      "Cascade delete purchases",
      "eventId", eventId,
      "deleted", String(purchases.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete purchases failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  // --- 3. Supprimer les event_materiel ---
  try {
    var eventMateriel = $app.findRecordsByFilter(
      "event_materiel",
      "eventId = {:eventId}",
      undefined,
      999,
      0,
      { eventId: eventId }
    );
    for (var k = 0; k < eventMateriel.length; k++) {
      $app.delete(eventMateriel[k]);
    }
    $app.logger().info(
      "Cascade delete event_materiel",
      "eventId", eventId,
      "deleted", String(eventMateriel.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete event_materiel failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  // --- 4. Supprimer les event_todos ---
  try {
    var eventTodos = $app.findRecordsByFilter(
      "event_todos",
      "eventId = {:eventId}",
      undefined,
      999,
      0,
      { eventId: eventId }
    );
    for (var l = 0; l < eventTodos.length; l++) {
      $app.delete(eventTodos[l]);
    }
    $app.logger().info(
      "Cascade delete event_todos",
      "eventId", eventId,
      "deleted", String(eventTodos.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete event_todos failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  // --- 5. Supprimer les teamdocs ---
  try {
    var teamdocs = $app.findRecordsByFilter(
      "teamdocs",
      "eventId = {:eventId}",
      undefined,
      999,
      0,
      { eventId: eventId }
    );
    for (var m = 0; m < teamdocs.length; m++) {
      $app.delete(teamdocs[m]);
    }
    $app.logger().info(
      "Cascade delete teamdocs",
      "eventId", eventId,
      "deleted", String(teamdocs.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete teamdocs failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  // --- 6. Supprimer les share_links (link_type = "event" ET target_id = eventId) ---
  try {
    var shareLinks = $app.findRecordsByFilter(
      "share_links",
      "link_type = {:linkType} && target_id = {:targetId}",
      undefined,
      999,
      0,
      { linkType: "event", targetId: eventId }
    );
    for (var n = 0; n < shareLinks.length; n++) {
      $app.delete(shareLinks[n]);
    }
    $app.logger().info(
      "Cascade delete share_links",
      "eventId", eventId,
      "deleted", String(shareLinks.length)
    );
  } catch (err) {
    $app.logger().error(
      "Cascade delete share_links failed",
      "eventId", eventId,
      "error", String(err)
    );
  }

  e.next();
}, "events");
