// OBSOLÈTE — Les champs select sont désormais créés directement dans les migrations initiales :
//   - materiel.type + materiel.status → 1700000007_materiel.js
//   - event_todos.priority + event_todos.status → 1700000012_event_todos.js
// Cette migration est conservée comme no-op pour préserver l'ordre chronologique.
migrate(
  function (txApp) {
    // No-op: les champs sont déjà en select depuis la création
  },
  function (txApp) {
    // No-op
  }
);
