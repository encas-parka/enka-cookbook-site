/// <reference path="../pb_data/types.d.ts" />

// DIV-1/B1/B2 : le client (NativeTeamsStore) et le hook invite-to-team
// écrivent createdBy/roles/description/city/isPublic — champs déclarés dans
// la migration 1700000001 mais jamais appliqués à la DB (fichier édité après
// application). Ré-ajout par delta, typage miroir de 1700000001.
// Pas de backfill createdBy : aucune heuristique fiable (le créateur n'est
// pas dérivable de members sur les teams existantes) — les règles T4
// porteront une clause grand-père pour les teams sans owner.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("teams");

  collection.fields.add(new RelationField({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2204758921",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "createdBy",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }));

  collection.fields.add(new JSONField({
    "help": "",
    "hidden": false,
    "id": "json1093847265",
    "maxSize": 0,
    "name": "roles",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  collection.fields.add(new TextField({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2956104837",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  collection.fields.add(new TextField({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text7382910564",
    "max": 0,
    "min": 0,
    "name": "city",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  collection.fields.add(new BoolField({
    "help": "",
    "hidden": false,
    "id": "bool5510293847",
    "name": "isPublic",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("teams");

  collection.fields.removeByName("createdBy");
  collection.fields.removeByName("roles");
  collection.fields.removeByName("description");
  collection.fields.removeByName("city");
  collection.fields.removeByName("isPublic");

  return app.save(collection);
})
