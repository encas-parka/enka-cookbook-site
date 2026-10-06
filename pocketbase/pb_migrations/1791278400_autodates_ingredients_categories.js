/// <reference path="../pb_data/types.d.ts" />

// ingredients et categories ont été importées sans autodates : le delta-sync
// client (filter `updated > {:since}`) échoue en 400 sur colonne inexistante.
// Backfill des rows existantes à date fixe (antérieure à toute écriture
// postérieure au déploiement) : le curseur `max(updated)` des clients repart
// de la valeur backfillée, toutes les rows franchissent le filtre delta,
// et les updates ultérieurs (autodate onUpdate) restent strictement supérieurs.

migrate((app) => {
  const backfillDate = "2026-10-06 00:00:00.000Z";
  const names = ["ingredients", "categories"];

  names.forEach((name) => {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new AutodateField({
      "hidden": false,
      "id": "autodate2990389176",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }));
    collection.fields.add(new AutodateField({
      "hidden": false,
      "id": "autodate3332085495",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }));
    app.save(collection);
  });

  // colonne fraîchement ajoutée : les rows existantes portent '' (DEFAULT NOT NULL)
  names.forEach((name) => {
    app.db()
      .newQuery("UPDATE " + name + " SET created = {:d}, updated = {:d} WHERE created = '' OR created IS NULL")
      .bind({ d: backfillDate })
      .execute();
  });
}, (app) => {
  const names = ["ingredients", "categories"];

  names.forEach((name) => {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("created");
    collection.fields.removeByName("updated");
    app.save(collection);
  });
})
