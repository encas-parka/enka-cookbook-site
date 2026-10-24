/// <reference path="../pb_data/types.d.ts" />

// Stock multi-exemplaires (lot 1) : `repairQuantity` compte les exemplaires
// actuellement en réparation — soustraits de la disponibilité, sans quitter le
// stock. Le champ est purement additif ici : `status` reste en place jusqu'à ce
// que ses lecteurs aient migré (ticket 06).
//
// Backfill conservateur des statuts hérités, appliqué aux données existantes :
//   - « à réparer » → tout l'item en réparation (l'humain remet en service au
//     geste, unité par unité) ;
//   - « perdu » → quantité 0 (les exemplaires n'existent plus).
// Décision : docs/adr/0003-materiel-stock-model.md
//
// Down : le champ est retiré ; le backfill n'est pas défait — un statut
// d'origine n'est pas distinguable d'une quantité corrigée depuis.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("materiel");

  if (!collection.fields.getByName("repairQuantity")) {
    collection.fields.add(new NumberField({
      "help": "",
      "hidden": false,
      "id": "number1031184101",
      "max": null,
      "min": 0,
      "name": "repairQuantity",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }));
    app.save(collection);
  }

  var toRepair = app.findRecordsByFilter(
    "materiel",
    "status = {:status}",
    undefined,
    999,
    0,
    { status: "torepair" },
  );
  for (var i = 0; i < toRepair.length; i++) {
    var toRepairRecord = toRepair[i];
    toRepairRecord.set("repairQuantity", toRepairRecord.getInt("quantity"));
    app.save(toRepairRecord);
  }

  var lost = app.findRecordsByFilter(
    "materiel",
    "status = {:status}",
    undefined,
    999,
    0,
    { status: "lost" },
  );
  for (var j = 0; j < lost.length; j++) {
    var lostRecord = lost[j];
    lostRecord.set("quantity", 0);
    app.save(lostRecord);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("materiel");

  collection.fields.removeByName("repairQuantity");

  return app.save(collection);
})
