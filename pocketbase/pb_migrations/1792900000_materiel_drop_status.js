/// <reference path="../pb_data/types.d.ts" />

// Le statut persisté (ok/lost/torepair) quitte le schéma `materiel` : sa
// dernière écriture (projection du retour) et ses derniers lecteurs (UI
// inventaire, sélecteurs d'emprunt, libellés) ont disparu des deltas
// précédents. L'état du stock vit dans `quantity` / `repairQuantity` et
// l'affichage le dérive à la lecture — un statut persisté n'était qu'une
// dérivation périmée à chaque retour. Décision :
// docs/adr/0003-materiel-stock-model.md
//
// Données : le backfill du delta d'ajout (1792805000) a déjà transféré
// l'information utile (torepair → repairQuantity, lost → quantity 0) ; la
// colonne ne porte plus rien d'irremplaçable.
//
// Down : le champ est recréé à l'identique (select ok/lost/torepair, même id)
// mais les valeurs ne sont pas reconstituées — la dérivation d'origine est
// perdue depuis la conversion quantitative.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("materiel");

  if (collection.fields.getByName("status")) {
    collection.fields.removeByName("status");
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("materiel");

  if (!collection.fields.getByName("status")) {
    collection.fields.add(new SelectField({
      "help": "",
      "hidden": false,
      "id": "select2063623452",
      "maxSelect": 1,
      "name": "status",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": ["ok", "lost", "torepair"]
    }));
    app.save(collection);
  }
})
