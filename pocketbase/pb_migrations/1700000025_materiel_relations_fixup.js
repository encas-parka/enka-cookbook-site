// Fixup — Drop & recreate materiel + event_materiel + materiel_loan
// Corrects shareableWith (json→relation→teams) and storeIn (json→self-relation) on materiel
// All 3 collections are empty, safe to drop+recreate
// Order: drop event_materiel → materiel_loan → materiel, then recreate in reverse
migrate(
  function (txApp) {
    var teamsId = txApp.findCollectionByNameOrId("teams").id;
    var eventsId = txApp.findCollectionByNameOrId("events").id;
    var usersId = "_pb_users_auth_";

    // === DROP in dependency order (children first) ===
    var emCol = txApp.findCollectionByNameOrId("event_materiel");
    if (emCol) { txApp.delete(emCol); }

    var mlCol = txApp.findCollectionByNameOrId("materiel_loan");
    if (mlCol) { txApp.delete(mlCol); }

    var matCol = txApp.findCollectionByNameOrId("materiel");
    if (matCol) { txApp.delete(matCol); }

    // === RECREATE materiel (with corrected shareableWith + storeIn) ===
    var materiel = new Collection({
      name: "materiel",
      type: "base",
      listRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        { name: "type", type: "text" },
        { name: "description", type: "text" },
        { name: "ownerUser", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "teamId", type: "relation", collectionId: teamsId, maxSelect: 1 },
        { name: "status", type: "text" },
        { name: "deleted", type: "bool" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "quantity", type: "number" },
        { name: "location", type: "text" },
        { name: "shareableWith", type: "relation", collectionId: teamsId, maxSelect: 999 },
        { name: "isStorage", type: "bool" },
      ],
    });
    txApp.save(materiel);

    // Self-referencing storeIn
    var savedMat = txApp.findCollectionByNameOrId("materiel");
    savedMat.fields.add(
      new RelationField({ name: "storeIn", collectionId: savedMat.id, maxSelect: 1 }),
    );
    txApp.save(savedMat);

    var materielId = savedMat.id;

    // === RECREATE event_materiel (original + fixup fields) ===
    var eventMateriel = new Collection({
      name: "event_materiel",
      type: "base",
      listRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      viewRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      createRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      updateRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      deleteRule:
        '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)',
      fields: [
        { name: "eventId", type: "relation", collectionId: eventsId, required: true, maxSelect: 1 },
        { name: "type", type: "text" },
        { name: "status", type: "text" },
        { name: "groupId", type: "text" },
        { name: "specs", type: "json" },
        { name: "deleted", type: "bool" },
        { name: "name", type: "text" },
        { name: "quantity", type: "number" },
        { name: "who", type: "text" },
        { name: "where", type: "text" },
        { name: "sourceMaterielId", type: "relation", collectionId: materielId, maxSelect: 1 },
        { name: "notes", type: "text" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "fromTeamName", type: "text" },
      ],
    });
    txApp.save(eventMateriel);

    var eventMaterielId = txApp.findCollectionByNameOrId("event_materiel").id;

    // === RECREATE materiel_loan (original + fixup fields) ===
    var materielLoan = new Collection({
      name: "materiel_loan",
      type: "base",
      listRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "materielId", type: "relation", collectionId: materielId, required: true, maxSelect: 1 },
        { name: "borrowerUser", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "eventId", type: "relation", collectionId: eventsId, maxSelect: 1 },
        { name: "startDate", type: "date" },
        { name: "endDate", type: "date" },
        { name: "status", type: "text" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "responsibleId", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "responsibleName", type: "text" },
        { name: "ownerId", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "ownerName", type: "text" },
        { name: "materiels", type: "json" },
        { name: "notes", type: "text" },
        { name: "completedAt", type: "date" },
        { name: "returnedAt", type: "date" },
        { name: "returnNotes", type: "text" },
        { name: "eventName", type: "text" },
      ],
    });
    txApp.save(materielLoan);

    // Now add loanId to event_materiel (references materiel_loan which now exists)
    var savedEM = txApp.findCollectionByNameOrId("event_materiel");
    var savedMLId = txApp.findCollectionByNameOrId("materiel_loan").id;
    savedEM.fields.add(
      new RelationField({ name: "loanId", collectionId: savedMLId, maxSelect: 1 }),
    );
    txApp.save(savedEM);
  },
  function (txApp) {
    // Down: drop all 3 in dependency order
    var em = txApp.findCollectionByNameOrId("event_materiel");
    if (em) { txApp.delete(em); }
    var ml = txApp.findCollectionByNameOrId("materiel_loan");
    if (ml) { txApp.delete(ml); }
    var mat = txApp.findCollectionByNameOrId("materiel");
    if (mat) { txApp.delete(mat); }
  },
);
