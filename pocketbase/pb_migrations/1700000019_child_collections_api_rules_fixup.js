migrate(
  function (txApp) {
    // Fix API rules for child collections (products, purchases, event_materiel, teamdocs, event_todos)
    // Use only @collection.events.guestEmails (denormalized by teams-resync-events hook)
    // This avoids expensive double-hop joins
    
    var collections = ["products", "purchases", "event_materiel", "teamdocs", "event_todos"];
    
    for (var i = 0; i < collections.length; i++) {
      var collection = txApp.findCollectionByNameOrId(collections[i]);
      if (!collection) continue;
      
      // Build new rules without @collection.events.teams.members
      var listRule = '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)';
      var createRule = '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email';
      
      collection.listRule = listRule;
      collection.viewRule = listRule;
      collection.createRule = createRule;
      collection.updateRule = createRule;
      collection.deleteRule = createRule;
      
      txApp.save(collection);
    }
  },
  function (txApp) {
    // Rollback: restore original rules with @collection.events.teams.members
    var collections = ["products", "purchases", "event_materiel", "teamdocs", "event_todos"];
    
    for (var i = 0; i < collections.length; i++) {
      var collection = txApp.findCollectionByNameOrId(collections[i]);
      if (!collection) continue;
      
      var listRule = '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)';
      var createRule = '@request.auth.id != "" && (@collection.events.teams.members ?= @request.auth.id || @collection.events.guestEmails ?= @request.auth.email)';
      
      collection.listRule = listRule;
      collection.viewRule = listRule;
      collection.createRule = createRule;
      collection.updateRule = createRule;
      collection.deleteRule = createRule;
      
      txApp.save(collection);
    }
  }
);
