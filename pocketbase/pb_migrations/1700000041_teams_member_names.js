// Add memberNames (json) to teams collection
// Stores {userId: "userName"} for display without needing expand:members
// (users listRule = id = @request.auth.id prevents expand from resolving other users)
//
// Note: Population is done separately via a script, not in the migration,
// because migrations run with limited txApp context.

migrate(
  function (txApp) {
    var teams = txApp.findCollectionByNameOrId("teams");

    teams.fields.push(
      new Field({
        name: "memberNames",
        type: "json",
      })
    );

    txApp.save(teams);
  },
  function (txApp) {
    var teams = txApp.findCollectionByNameOrId("teams");
    var field = null;
    for (var i = 0; i < teams.fields.length; i++) {
      if (teams.fields[i].name === "memberNames") {
        field = teams.fields[i];
        break;
      }
    }
    if (field) {
      teams.fields.splice(teams.fields.indexOf(field), 1);
      txApp.save(teams);
    }
  },
);
