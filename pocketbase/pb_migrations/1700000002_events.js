migrate(
  function (txApp) {
    var teamsId = txApp.findCollectionByNameOrId("teams").id;
    var collection = new Collection({
      name: "events",
      type: "base",
      listRule:
        '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email)',
      viewRule:
        '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (teams.members ?= @request.auth.id || guestEmails ?= @request.auth.email || createdBy = @request.auth.id)',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      fields: [
        { name: "name", type: "text", required: true },
        { name: "date", type: "json" },
        { name: "location", type: "text" },
        { name: "meals", type: "json" },
        { name: "contributors", type: "json" },
        { name: "todos", type: "json" },
        {
          name: "teams",
          type: "relation",
          collectionId: teamsId,
          maxSelect: 999,
        },
        { name: "guestEmails", type: "json" },
        { name: "joinToken", type: "text" },
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        { name: "status", type: "text" },
        { name: "dateStart", type: "date" },
        { name: "dateEnd", type: "date" },
      ],
    });
    txApp.save(collection);
  },
  function (txApp) {
    var col = txApp.findCollectionByNameOrId("events");
    txApp.delete(col);
  },
);
