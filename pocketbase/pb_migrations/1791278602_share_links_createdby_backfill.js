/// <reference path="../pb_data/types.d.ts" />

// B3 : pb-invitations.ts envoie déjà createdBy (absent du schéma) — 400 à la
// création de lien, et prérequis REC-1/T4 qui scopera les rules share_links
// sur ce champ (sans backfill, les liens existants deviendraient invisibles).
// Backfill : createdBy <- createdBy de l'event ciblé (target_id +
// link_type="event") quand résolvable ; les liens non résolus restent vides
// (comptés par vérification SQL externe, cf. journal T3) — les rules T4
// devront les tolérer.
// Colonne fraîchement ajoutée = DEFAULT '' NOT NULL : backfill ciblant
// '' et NULL (piège T2).

migrate((app) => {
  const collection = app.findCollectionByNameOrId("share_links");

  collection.fields.add(new RelationField({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3091827465",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "createdBy",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }));

  app.save(collection);

  app.db().newQuery(
    "UPDATE share_links SET createdBy = " +
    "(SELECT e.createdBy FROM events e WHERE e.id = share_links.target_id AND e.createdBy != '') " +
    "WHERE link_type = 'event' AND (createdBy = '' OR createdBy IS NULL) " +
    "AND EXISTS (SELECT 1 FROM events e WHERE e.id = share_links.target_id AND e.createdBy != '')"
  ).execute();
}, (app) => {
  const collection = app.findCollectionByNameOrId("share_links");

  collection.fields.removeByName("createdBy");

  return app.save(collection);
})
