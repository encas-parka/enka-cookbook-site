// Fix API Rules for child collections: remove eventId.joinToken reference
//
// Root cause: migration 1778068970_updated_events.js removed the `joinToken`
// field from the `events` collection, but the child collections still reference
// `eventId.joinToken` in their listRule and viewRule API rules.
//
// Since `joinToken` no longer exists on events, PocketBase returns 400 Bad Request
// for ANY request to these collections (the API rule cannot be evaluated).
//
// This migration removes `|| (eventId.joinToken != "" && eventId.joinToken = @request.query.joinToken)`
// from listRule and viewRule of all child collections.
//
// Affected collections: teamdocs, products, purchases, event_materiel, event_todos
//
// The createRule, updateRule, deleteRule are already correct (no joinToken).

migrate(
  function (txApp) {
    var newRule =
      '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';

    var childCollections = [
      "event_materiel",
      "event_todos",
      "products",
      "purchases",
      "teamdocs",
    ];

    for (var i = 0; i < childCollections.length; i++) {
      var col = txApp.findCollectionByNameOrId(childCollections[i]);
      if (!col) continue;
      col.listRule = newRule;
      col.viewRule = newRule;
      // createRule, updateRule, deleteRule untouched (no joinToken)
      txApp.save(col);
    }
  },
  function (txApp) {
    // Rollback: restore listRule/viewRule with joinToken
    var oldRule =
      '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || (eventId.joinToken != "" && eventId.joinToken = @request.query.joinToken))';

    var childCollections = [
      "event_materiel",
      "event_todos",
      "products",
      "purchases",
      "teamdocs",
    ];

    for (var i = 0; i < childCollections.length; i++) {
      var col = txApp.findCollectionByNameOrId(childCollections[i]);
      if (!col) continue;
      col.listRule = oldRule;
      col.viewRule = oldRule;
      txApp.save(col);
    }
  },
);
