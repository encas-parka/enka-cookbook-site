/// <reference path="../pb_data/types.d.ts" />

// products/purchases — le créateur de l'event obtient le CRUD complet sur les
// produits et achats de son event (mesuré 12-10, sonde scripts_dev/probe-t01-products.ts :
// l'organisateur non membre des teams sélectionnées et non guest reçoit 400
// « Failed to create record. » sur tout create — rejet de règle, data vide ;
// la listRule filtre au lieu de rejeter → liste serveur vide, seuls les produits
// virtuels needs s'affichent). Miroir de la clause createdBy déjà posée sur
// events list/view par 1791278800 : les collections enfants event-scopées en
// héritent sur leurs 5 règles. Les clauses teams.members/guestUsers restent
// inchangées (membres et invités conservent leurs accès).
//
// create : eventId non qualifié = record draft (valeurs soumises) — même forme
// que les règles existantes de ces collections.

migrate((app) => {
  const rule =
    '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id || eventId.createdBy = @request.auth.id)';

  for (const name of ["products", "purchases"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.listRule = rule;
    collection.viewRule = rule;
    collection.createRule = rule;
    collection.updateRule = rule;
    collection.deleteRule = rule;
    app.save(collection);
  }
}, (app) => {
  const original =
    '@request.auth.id != "" && (eventId.teams.members ~ @request.auth.id || eventId.guestUsers ~ @request.auth.id)';

  for (const name of ["products", "purchases"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.listRule = original;
    collection.viewRule = original;
    collection.createRule = original;
    collection.updateRule = original;
    collection.deleteRule = original;
    app.save(collection);
  }
})
