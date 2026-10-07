/// <reference path="../pb_data/types.d.ts" />

// Restauration « documents liés par tag » : le champ tags (json — array de
// strings) existait dans la migration teamdocs d'origine (1700000009) mais a
// été perdu au drop+recreate 1700000029, qui a recréé teamdocs avec un schéma
// simplifié. Nullable : les docs existants (prod comprise) n'ont jamais porté
// de tags — les futures docs les créeront via l'UI.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  collection.fields.add(new JSONField({
    "help": "",
    "hidden": false,
    "id": "json4321650987",
    "maxSize": 0,
    "name": "tags",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("teamdocs");

  collection.fields.removeByName("tags");

  return app.save(collection);
})
