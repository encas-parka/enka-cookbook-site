/// <reference path="../pb_data/types.d.ts" />

// event_materiel — le créateur de l'event obtient le CRUD complet sur les
// lignes de materiel de son event (mesuré 12-10, sonde
// scripts_dev/probe-t03-loan-eventmateriel.ts : l'organisateur non membre des
// teams sélectionnées et non guest — cas du click-through — reçoit 400
// « Failed to create record. » (data vide) sur tout create event_materiel ;
// le prêt materiel_loan passe (createRule responsibleId = auth), d'où une
// réservation créée malgré l'erreur affichée). Miroir des migrations
// 1791278800 (events list/view) et 1791700000 (products/purchases) : les
// collections enfants event-scopées héritent de la clause createdBy sur leurs
// 5 règles. Les clauses teams.members/guestUsers restent inchangées.
//
// Piège mesuré sur update/delete : PB répond 404 (leak-protection) — côté
// client cela soft-delete la ligne (RecordDeletedError) au lieu d'afficher un
// refus ; la clause créateur lève aussi ce chemin.
//
// create : eventId non qualifié = record draft (valeurs soumises) — même forme
// que les règles existantes de la collection.

migrate((app) => {
  const rule =
    '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || eventId.createdBy = @request.auth.id)';

  const collection = app.findCollectionByNameOrId("event_materiel");
  collection.listRule = rule;
  collection.viewRule = rule;
  collection.createRule = rule;
  collection.updateRule = rule;
  collection.deleteRule = rule;
  app.save(collection);
}, (app) => {
  const original =
    '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';

  const collection = app.findCollectionByNameOrId("event_materiel");
  collection.listRule = original;
  collection.viewRule = original;
  collection.createRule = original;
  collection.updateRule = original;
  collection.deleteRule = original;
  app.save(collection);
})
