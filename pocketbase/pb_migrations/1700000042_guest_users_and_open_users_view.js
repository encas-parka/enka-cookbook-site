// 1. Open users.viewRule — any authenticated user can VIEW a user record
//    emailVisibility: false (default) hides the email field from non-owners
//    listRule stays restrictive: id = @request.auth.id (no user directory)
//
// 2. Add guestUsers (relation → users, multiple) on events
//    Replaces guestEmails ~ @request.auth.email (substring match on JSON, fragile)
//    with guestUsers ~ @request.auth.id (exact match on IDs, safe with ~ operator)
//
// 3. Update all API rules: guestEmails ~ email → guestUsers ~ id
//    guestEmails kept for invitation tracking (emails of non-registered users)
//
// Why: PB v0.37.5 `?=` is broken, `~` is the workaround but does LIKE '%val%'
// on serialized JSON — safe for 15-char IDs, risky for emails.
// Also: open users.viewRule enables `expand: 'members'` on teams (resolves names).

migrate(
  function (txApp) {
    // ── 1. Open users viewRule ──────────────────────────────
    var users = txApp.findCollectionByNameOrId("users");
    users.listRule = "id = @request.auth.id";
    users.viewRule = '@request.auth.id != ""';
    txApp.save(users);

    // ── 2. Add guestUsers relation field to events ──────────
    var events = txApp.findCollectionByNameOrId("events");
    events.fields.push(
      new Field({
        name: "guestUsers",
        type: "relation",
        collectionId: "_pb_users_auth_", // users collection ID (auth collections use _pb_users_auth_)
        required: false,
        options: {
          maxSelect: 100,
          minSelect: 0,
        },
      })
    );
    txApp.save(events);

    // ── 3. Update events API rules ──────────────────────────
    // Replace guestEmails ~ @request.auth.email with guestUsers ~ @request.auth.id
    var evAccess =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || (joinToken != "" && joinToken = @request.query.joinToken))';
    var evUpdate =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || createdBy = @request.auth.id)';

    events.listRule = evAccess;
    events.viewRule = evAccess;
    events.updateRule = evUpdate;
    // createRule and deleteRule unchanged
    txApp.save(events);

    // ── 4. Update child collections API rules ───────────────
    var childListRule =
      '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || (eventId.joinToken != "" && eventId.joinToken = @request.query.joinToken))';
    var childWriteRule =
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
      col.listRule = childListRule;
      col.viewRule = childListRule;
      col.createRule = childWriteRule;
      col.updateRule = childWriteRule;
      col.deleteRule = childWriteRule;
      txApp.save(col);
    }
  },
  function (txApp) {
    // ── Rollback ────────────────────────────────────────────

    // 1. Restore users rules
    var users = txApp.findCollectionByNameOrId("users");
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    txApp.save(users);

    // 2. Remove guestUsers field from events
    var events = txApp.findCollectionByNameOrId("events");
    var fieldIndex = -1;
    for (var i = 0; i < events.fields.length; i++) {
      if (events.fields[i].name === "guestUsers") {
        fieldIndex = i;
        break;
      }
    }
    if (fieldIndex >= 0) {
      events.fields.splice(fieldIndex, 1);
    }

    // 3. Restore events rules with guestEmails
    events.listRule =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestEmails ~ @request.auth.email || (joinToken != "" && joinToken = @request.query.joinToken))';
    events.viewRule = events.listRule;
    events.updateRule =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestEmails ~ @request.auth.email || createdBy = @request.auth.id)';
    txApp.save(events);

    // 4. Restore child rules with guestEmails
    var childListRule =
      '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email || (eventId.joinToken != "" && eventId.joinToken = @request.query.joinToken))';
    var childWriteRule =
      '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestEmails ~ @request.auth.email)';

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
      col.listRule = childListRule;
      col.viewRule = childListRule;
      col.createRule = childWriteRule;
      col.updateRule = childWriteRule;
      col.deleteRule = childWriteRule;
      txApp.save(col);
    }
  },
);
