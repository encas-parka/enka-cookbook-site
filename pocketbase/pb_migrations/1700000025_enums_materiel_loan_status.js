// OBSOLÈTE — Le champ select est désormais créé directement dans la migration initiale :
//   - materiel_loan.status → 1700000008_materiel_loan.js
// Cette migration est conservée comme no-op pour préserver l'ordre chronologique.
migrate(
  function (txApp) {
    // No-op: le champ est déjà en select depuis la création
  },
  function (txApp) {
    // No-op
  }
);
