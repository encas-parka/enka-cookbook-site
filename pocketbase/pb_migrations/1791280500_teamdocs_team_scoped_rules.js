/// <reference path="../pb_data/types.d.ts" />

// teamdocs team-scopé : les 5 règles exigeaient toutes un eventId
// (eventId.teams.members / eventId.guestUsers) — un doc d'équipe
// (teamId posé, sans event) était rejeté au create et invisible en
// list/view. Extension symétrique des 5 règles : create passe par
// @request.body.teamId.members, les 4 autres par teamId.members du
// record. Un doc event-scopé (sans teamId) : la clause teamId.* avec
// valeur vide évalue faux, l'accès reste régi par les clauses eventId.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  collection.createRule =
    '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';
  collection.listRule =
    '@request.auth.id != "" && (teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';
  collection.viewRule = collection.listRule;
  collection.updateRule = collection.listRule;
  collection.deleteRule = collection.listRule;

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  const eventIdOnly =
    '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';

  collection.createRule = eventIdOnly;
  collection.listRule = eventIdOnly;
  collection.viewRule = eventIdOnly;
  collection.updateRule = eventIdOnly;
  collection.deleteRule = eventIdOnly;

  app.save(collection);
})
