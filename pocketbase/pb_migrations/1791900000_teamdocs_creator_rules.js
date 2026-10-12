/// <reference path="../pb_data/types.d.ts" />

// teamdocs — le créateur de l'event obtient le CRUD complet sur les documents
// event-scopés de son event (mesuré 12-10, sonde
// scripts_dev/probe-t04-teamdocs.ts, log /tmp/orchestrate/probe-t04-before-26-10-12.log :
// create teamdocs par le créateur non couvert — ni teamId.members, ni
// eventId.teams.members, ni eventId.guestUsers, cas du click-through —
// répond 400 « Failed to create record. » (data vide) = rejet de règle, le
// même payload passant pour un guest ; et le doc créé par un participant
// guest est invisible pour ce créateur : listRule filtre (200 sans le
// record), viewRule répond 404 (leak-protection) — le record existe pourtant
// côté serveur (lecture admin). Miroir des migrations 1791278800 (events
// list/view), 1791700000 (products/purchases) et 1791800000 (event_materiel) :
// les collections enfants event-scopées héritent de la clause createdBy.
// Les clauses teamId.members / eventId.teams.members / eventId.guestUsers
// restent inchangées — la couverture participant (team ou guest) passe déjà.
//
// Piège rappelé : un update/delete refusé par règle PB répond 404
// (leak-protection) — côté client pb-sync soft-delete la ligne
// (RecordDeletedError) au lieu d'afficher un refus ; la clause créateur lève
// aussi ce chemin.
//
// create : eventId non qualifié = record draft (valeurs soumises) — même
// forme que la règle existante ; la clause teamId.* (via @request.body)
// garde sa place pour les docs d'équipe sans event.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  collection.createRule =
    '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || eventId.createdBy = @request.auth.id)';
  collection.listRule =
    '@request.auth.id != "" && (teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || eventId.createdBy = @request.auth.id)';
  collection.viewRule = collection.listRule;
  collection.updateRule = collection.listRule;
  collection.deleteRule = collection.listRule;
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  collection.createRule =
    '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';
  collection.listRule =
    '@request.auth.id != "" && (teamId.members ~ @request.auth.id || eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';
  collection.viewRule = collection.listRule;
  collection.updateRule = collection.listRule;
  collection.deleteRule = collection.listRule;
  app.save(collection);
})
