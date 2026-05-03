migrate(
  function (txApp) {
    // Fix API rules for events collection
    // Use only guestEmails (denormalized by teams-resync-events hook)
    var collection = txApp.findCollectionByNameOrId("events");
    
    collection.listRule = '@request.auth.id != "" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)';
    collection.viewRule = '@request.auth.id != "" && (guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)';
    collection.updateRule = '@request.auth.id != "" && (guestEmails ?= @request.auth.email || createdBy = @request.auth.id)';
    // deleteRule stays the same: '@request.auth.id != "" && createdBy = @request.auth.id'
    
    txApp.save(collection);
  },
  function (txApp) {
    // Rollback: restore original rules with teams.members
    var collection = txApp.findCollectionByNameOrId("events");
    
    collection.listRule = '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)';
    collection.viewRule = '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email || joinToken = @request.query.joinToken)';
    collection.updateRule = '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email || createdBy = @request.auth.id)';
    
    txApp.save(collection);
  }
);
