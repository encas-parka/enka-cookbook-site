/// <reference path="../pb_data/types.d.ts" />

// Clôture RSVP : le champ de tracking guestEmails (héritage Labels Appwrite)
// n'a plus aucun lecteur ni écrivain — l'accès invité vit dans guestUsers
// (relation filtrée par les règles events) et l'état RSVP dans contributors
// (registre des participants, json). Décision : docs/adr/0002-client-side-rsvp.md
// Down : le champ est recréé à l'identique (id d'origine conservé).

migrate((app) => {
  const collection = app.findCollectionByNameOrId("events");

  collection.fields.removeByName("guestEmails");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("events");

  collection.fields.add(new JsonField({
    "help": "",
    "hidden": false,
    "id": "json3572209388",
    "maxSize": 0,
    "name": "guestEmails",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  return app.save(collection);
})
