// Select fields — Drop + recreate 8 collections (all empty)
// Converts text fields → select for: events, materiel, materiel_loan, event_materiel, event_todos
// Also recreates products, purchases, teamdocs (reference events → new ID after drop)
//
// Drop order: children first (purchases → products → event_materiel → event_todos → teamdocs → materiel_loan → materiel → events)
// Create order: parents first (events → materiel → materiel_loan → event_materiel → event_todos → products → purchases → teamdocs)
//
// ⚠️ JSVM limitation: fields.remove() and field.type mutation don't work → drop+recreate is the only reliable pattern

migrate(
  function (txApp) {
    var teamsId = txApp.findCollectionByNameOrId("teams").id;
    var usersId = "_pb_users_auth_";

    // ================================================================
    // DROP (dependency order — children first)
    // ================================================================
    var toDrop = ["purchases", "products", "event_materiel", "event_todos", "teamdocs", "materiel_loan", "materiel", "events"];
    for (var i = 0; i < toDrop.length; i++) {
      var col = txApp.findCollectionByNameOrId(toDrop[i]);
      if (col) { txApp.delete(col); }
    }

    // ================================================================
    // CREATE events (status → select)
    // ================================================================
    var events = new Collection({
      name: "events",
      type: "base",
      listRule: '@request.auth.id != "" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && (guestEmails ?= @request.auth.email || createdBy = @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        { name: "date", type: "json" },
        { name: "location", type: "text" },
        { name: "meals", type: "json" },
        { name: "contributors", type: "json" },
        { name: "todos", type: "json" },
        { name: "teams", type: "relation", collectionId: teamsId, maxSelect: 999 },
        { name: "guestEmails", type: "json" },
        { name: "joinToken", type: "text" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "status", type: "select", values: ["archive", "locked", "proposition", "confirmed", "canceled"], maxSelect: 1 },
        { name: "dateStart", type: "date" },
        { name: "dateEnd", type: "date" },
      ],
    });
    txApp.save(events);

    var eventsId = txApp.findCollectionByNameOrId("events").id;

    // ================================================================
    // CREATE materiel (type, status → select) + self-ref storeIn
    // ================================================================
    var materiel = new Collection({
      name: "materiel",
      type: "base",
      listRule: '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule: '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        { name: "type", type: "select", values: ["electronic", "manual", "other", "tools", "dish", "gaz", "cooking", "hygiene"], maxSelect: 1 },
        { name: "description", type: "text" },
        { name: "ownerUser", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "teamId", type: "relation", collectionId: teamsId, maxSelect: 1 },
        { name: "status", type: "select", values: ["ok", "lost", "torepair"], maxSelect: 1 },
        { name: "deleted", type: "bool" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "quantity", type: "number" },
        { name: "location", type: "text" },
        { name: "shareableWith", type: "relation", collectionId: teamsId, maxSelect: 999 },
        { name: "isStorage", type: "bool" },
      ],
    });
    txApp.save(materiel);

    // Self-referencing storeIn (needs collection ID after save)
    var savedMat = txApp.findCollectionByNameOrId("materiel");
    savedMat.fields.add(
      new RelationField({ name: "storeIn", collectionId: savedMat.id, maxSelect: 1 })
    );
    txApp.save(savedMat);

    var materielId = savedMat.id;

    // ================================================================
    // CREATE materiel_loan (status → select)
    // ================================================================
    var materielLoan = new Collection({
      name: "materiel_loan",
      type: "base",
      listRule: '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      viewRule: '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && (borrowerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "materielId", type: "relation", collectionId: materielId, required: true, maxSelect: 1 },
        { name: "borrowerUser", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "eventId", type: "relation", collectionId: eventsId, maxSelect: 1 },
        { name: "startDate", type: "date" },
        { name: "endDate", type: "date" },
        { name: "status", type: "select", values: ["asked", "accepted", "refused", "canceled", "returned", "completed", "archived"], maxSelect: 1 },
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

    var materielLoanId = txApp.findCollectionByNameOrId("materiel_loan").id;

    // ================================================================
    // CREATE event_materiel (type, status → select) + loanId
    // ================================================================
    var eventMateriel = new Collection({
      name: "event_materiel",
      type: "base",
      listRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        { name: "eventId", type: "relation", collectionId: eventsId, required: true, maxSelect: 1 },
        { name: "type", type: "select", values: ["electronic", "manual", "other", "tools", "dish", "gaz", "cooking", "hygiene"], maxSelect: 1 },
        { name: "status", type: "select", values: ["to_find", "to_check", "confirmed", "reserved", "loan", "ok", "lost"], maxSelect: 1 },
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

    // loanId: relation → materiel_loan (added after materiel_loan exists)
    var savedEM = txApp.findCollectionByNameOrId("event_materiel");
    savedEM.fields.add(
      new RelationField({ name: "loanId", collectionId: materielLoanId, maxSelect: 1 })
    );
    txApp.save(savedEM);

    // ================================================================
    // CREATE event_todos (priority, status → select)
    // ================================================================
    var eventTodos = new Collection({
      name: "event_todos",
      type: "base",
      listRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        { name: "eventId", type: "relation", collectionId: eventsId, required: true, maxSelect: 1 },
        { name: "task", type: "text", required: true },
        { name: "taskOn", type: "date" },
        { name: "priority", type: "select", values: ["low", "medium", "high"], maxSelect: 1 },
        { name: "status", type: "select", values: ["todo", "done", "waiting", "canceled", "inprogress"], maxSelect: 1 },
        { name: "assignedTo", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "taskDescription", type: "text" },
        { name: "dueDate", type: "date" },
        { name: "requiredPeopleNb", type: "number" },
        { name: "locked", type: "bool" },
      ],
    });
    txApp.save(eventTodos);

    // ================================================================
    // CREATE products (status stays text — dynamic Hugo values + isSyncing)
    // ================================================================
    var productsCol = new Collection({
      name: "products",
      type: "base",
      listRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        { name: "eventId", type: "relation", collectionId: eventsId, required: true, maxSelect: 1 },
        { name: "productHugoUuid", type: "text" },
        { name: "productName", type: "text" },
        { name: "productType", type: "text" },
        { name: "pF", type: "bool" },
        { name: "pS", type: "bool" },
        { name: "store", type: "json" },
        { name: "specs", type: "json" },
        { name: "status", type: "text" },
        { name: "deleted", type: "bool" },
        { name: "stockReel", type: "json" },
        { name: "who", type: "json" },
        { name: "previousNames", type: "json" },
        { name: "isMerged", type: "bool" },
        { name: "mergedFrom", type: "json" },
        { name: "mergeDate", type: "date" },
        { name: "mergeReason", type: "text" },
        { name: "isSynced", type: "bool" },
        { name: "totalNeededOverride", type: "json" },
        { name: "updatedBy", type: "relation", collectionId: usersId, maxSelect: 1 },
      ],
    });
    txApp.save(productsCol);

    var productsId = txApp.findCollectionByNameOrId("products").id;

    // mergedInto: self-referencing relation (needs products ID after save)
    var savedProducts = txApp.findCollectionByNameOrId("products");
    savedProducts.fields.add(
      new RelationField({ name: "mergedInto", collectionId: productsId, maxSelect: 1 })
    );
    txApp.save(savedProducts);

    // ================================================================
    // CREATE purchases (status stays text, products = relation)
    // ================================================================
    var purchases = new Collection({
      name: "purchases",
      type: "base",
      listRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        { name: "eventId", type: "relation", collectionId: eventsId, required: true, maxSelect: 1 },
        { name: "store", type: "json" },
        { name: "status", type: "text" },
        { name: "deleted", type: "bool" },
        { name: "unit", type: "text", required: true },
        { name: "notes", type: "text" },
        { name: "price", type: "number" },
        { name: "quantity", type: "number", required: true },
        { name: "who", type: "text" },
        { name: "createdBy", type: "relation", collectionId: usersId, maxSelect: 1 },
        { name: "orderDate", type: "date" },
        { name: "deliveryDate", type: "date" },
        { name: "invoiceId", type: "text" },
        { name: "invoiceTotal", type: "number" },
        { name: "products", type: "relation", collectionId: productsId, maxSelect: 999 },
      ],
    });
    txApp.save(purchases);

    // ================================================================
    // CREATE teamdocs (simplified schema from pb-generated.ts)
    // ================================================================
    var teamdocs = new Collection({
      name: "teamdocs",
      type: "base",
      listRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule: '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule: '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        { name: "teamId", type: "relation", collectionId: teamsId, maxSelect: 1 },
        { name: "eventId", type: "relation", collectionId: eventsId, maxSelect: 1 },
        { name: "title", type: "text" },
        { name: "content", type: "text" },
        { name: "status", type: "text" },
      ],
    });
    txApp.save(teamdocs);
  },
  function (txApp) {
    // Down: drop all 8 in dependency order
    var toDrop = ["purchases", "products", "event_materiel", "event_todos", "teamdocs", "materiel_loan", "materiel", "events"];
    for (var i = 0; i < toDrop.length; i++) {
      var col = txApp.findCollectionByNameOrId(toDrop[i]);
      if (col) { txApp.delete(col); }
    }
  },
);
