// Fix API Rules: replace broken ?= operator with ~ + scope rules via relations
//
// Root cause: PocketBase v0.37.5 `?=` operator is non-functional on relation
// and json array fields — always evaluates to false.
// The `~` operator works correctly as "contains" for both types.
//
// Changes:
// 1. `?=` → `~` everywhere
// 2. Scope rules via relation fields (e.g. `teamId.members` instead of
//    `@collection.teams.members`) so access is tied to the linked record
// 3. Guard joinToken fallback: `joinToken != "" && ...` prevents `""=""` = true

migrate(
  function (txApp) {
    // ── teams ──────────────────────────────────────────────
    var teams = txApp.findCollectionByNameOrId("teams");
    var teamsRule = '@request.auth.id != "" && members ~ @request.auth.id';
    teams.listRule = teamsRule;
    teams.viewRule = teamsRule;
    teams.updateRule = teamsRule;
    teams.deleteRule = teamsRule;
    txApp.save(teams);

    // ── events ─────────────────────────────────────────────
    var events = txApp.findCollectionByNameOrId("events");
    events.listRule =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestEmails ~ @request.auth.email || (joinToken != "" && joinToken = @request.query.joinToken))';
    events.viewRule = events.listRule;
    events.updateRule =
      '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestEmails ~ @request.auth.email || createdBy = @request.auth.id)';
    txApp.save(events);

    // ── materiel ───────────────────────────────────────────
    // Scoped: teamId.members checks members of the SPECIFIC team
    var materiel = txApp.findCollectionByNameOrId("materiel");
    var matAccess = '@request.auth.id != "" && (ownerUser = @request.auth.id || teamId.members ~ @request.auth.id)';
    materiel.listRule = matAccess;
    materiel.viewRule = matAccess;
    materiel.updateRule = matAccess;
    txApp.save(materiel);

    // ── materiel_loan ──────────────────────────────────────
    // Scoped: ownerId is the owning user (relation → users)
    var loans = txApp.findCollectionByNameOrId("materiel_loan");
    var loanAccess = '@request.auth.id != "" && (borrowerUser = @request.auth.id || ownerId = @request.auth.id)';
    loans.listRule = loanAccess;
    loans.viewRule = loanAccess;
    loans.updateRule = loanAccess;
    txApp.save(loans);

    // ── child collections (eventId-scoped) ─────────────────
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
  function (txApp) {
    // ── Rollback: restore original rules with ?= (broken) ──

    var teams = txApp.findCollectionByNameOrId("teams");
    var teamsRule = '@request.auth.id != "" && members ?= @request.auth.id';
    teams.listRule = teamsRule;
    teams.viewRule = teamsRule;
    teams.updateRule = teamsRule;
    teams.deleteRule = teamsRule;
    txApp.save(teams);

    var events = txApp.findCollectionByNameOrId("events");
    events.listRule =
      '@request.auth.id != "" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)';
    events.viewRule = events.listRule;
    events.updateRule =
      '@request.auth.id != "" && (guestEmails ?= @request.auth.email || createdBy = @request.auth.id)';
    txApp.save(events);

    var materiel = txApp.findCollectionByNameOrId("materiel");
    var matAccess = '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)';
    materiel.listRule = matAccess;
    materiel.viewRule = matAccess;
    materiel.updateRule = matAccess;
    txApp.save(materiel);

    var loans = txApp.findCollectionByNameOrId("materiel_loan");
    var loanAccess = '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)';
    loans.listRule = loanAccess;
    loans.viewRule = loanAccess;
    loans.updateRule = loanAccess;
    txApp.save(loans);

    var childListRule =
      '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)';
    var childWriteRule =
      '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email';

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
