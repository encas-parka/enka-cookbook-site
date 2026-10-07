/// <reference path="../pb_data/types.d.ts" />

// LOCK-2 : la reprise d'un verrou libéré ou expiré était impossible.
//
// L'updateRule héritée du hardening (`userId = @request.auth.id`) interdisait
// tout update d'un lock libéré (`releaseLock` vide userId → "") : PB répondait
// 404 (règle non satisfaite), le client tentait alors un create avec le même
// id (400 not_unique) et `acquireLock` renvoyait false → lock fantôme dès la
// première édition d'un event déjà édité.
//
// La règle relaxée autorise :
//   - userId = @request.auth.id : le détenteur (heartbeat/refresh) ;
//   - userId = "" : reprise d'un lock libéré ;
//   - expiresAt < @now : reprise d'un lock expiré (session crashée sans
//     release). Les datetimes PB se comparent lexicalement (RFC3339).
//
// createRule inchangée : `@request.body.userId = @request.auth.id`.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("locks");
  collection.updateRule =
    '@request.auth.id != "" && (userId = @request.auth.id || userId = "" || expiresAt < @now)';
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("locks");
  collection.updateRule = '@request.auth.id != "" && userId = @request.auth.id';
  app.save(collection);
});
