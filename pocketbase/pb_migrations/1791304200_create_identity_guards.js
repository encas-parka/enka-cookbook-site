/// <reference path="../pb_data/types.d.ts" />

// Garde d'identité au create (audit 26-10-06 F4/B3) : le client doit
// revendiquer SA PROPRE identité dans createdBy — impossible de créer un
// record au nom d'un tiers (spoof d'attribution, record indestructible par
// son prétendu auteur quand deleteRule mire createdBy).
//
// Collections : events, recipes, teams, materiel. Chacune a un flux client
// vérifié qui envoie createdBy = courant au create (EventsStore
// createEventWithTeams, RecipesStore createRecipe, NativeTeamsStore
// createTeam, MaterielStore createMateriel).
//
// Down : restaure les createRules d'avant la migration.

migrate((app) => {
  const rules = [
    {
      name: "events",
      createRule: '@request.auth.id != "" && @request.body.createdBy = @request.auth.id',
    },
    {
      name: "recipes",
      createRule: '@request.auth.id != "" && @request.body.createdBy = @request.auth.id',
    },
    {
      name: "teams",
      createRule: '@request.auth.id != "" && @request.body.createdBy = @request.auth.id',
    },
    {
      name: "materiel",
      createRule: '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || @request.body.ownerUser = @request.auth.id) && @request.body.createdBy = @request.auth.id',
    },
  ];

  for (const r of rules) {
    const collection = app.findCollectionByNameOrId(r.name);
    for (const key in r) {
      if (key === "name") continue;
      collection[key] = r[key];
    }
    app.save(collection);
  }
}, (app) => {
  const restore = [
    {
      name: "events",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "recipes",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "teams",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "materiel",
      createRule: '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || @request.body.ownerUser = @request.auth.id)',
    },
  ];

  for (const r of restore) {
    const collection = app.findCollectionByNameOrId(r.name);
    for (const key in r) {
      if (key === "name") continue;
      collection[key] = r[key];
    }
    app.save(collection);
  }
})
