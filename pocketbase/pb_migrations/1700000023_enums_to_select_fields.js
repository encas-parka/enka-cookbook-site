// OBSOLÈTE — Les champs select sont désormais créés directement dans les migrations initiales :
//   - events.status → 1700000002_events.js
//   - recipes.typeR + recipes.status → 1700000014_recipes_full.js
// Cette migration est conservée comme no-op pour préserver l'ordre chronologique.
// ⚠️ NE PAS SUPPRIMER ce fichier sans vérifier que _migrations est synchronisé.
migrate(
  function (txApp) {
    // No-op: les champs sont déjà en select depuis la création
  },
  function (txApp) {
    // No-op
  }
);
