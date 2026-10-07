/// <reference path="../pb_data/types.d.ts" />

// Index requêtes PB — parité avec les patterns réels de la sync (pb-collection
// initialFetch) et des lookups hooks/services, preuve EXPLAIN QUERY PLAN
// avant/après (run 26-10-07_parite-index-tags) :
//   - delta simple `updated >= since` ORDER BY updated (7 collections non
//     scopées : events, materiel, materiel_loan, recipes, teamdocs,
//     ingredients, categories) — avant : SCAN + TEMP B-TREE ;
//   - delta scopé `eventId = X AND updated >= since` ORDER BY updated
//     (products, purchases, event_materiel — toujours fetchés avec eventId)
//     — composite (eventId, updated) : filtre + tri couverts par l'index ;
//   - share_links : getEventShareLinks (`target_id = ? && isActive = true`)
//     + cascades delete events/teams (`link_type = ? && target_id = ?`)
//     — composite (target_id, link_type), le client utilise le préfixe.
// Candidats rejetés (la preuve prime sur l'hypothèse du ticket) :
//   - events.createdBy : les règles list/view sont des OR avec `teams ~` /
//     `guestUsers ~` (LIKE JSON non-indexable) → l'optimiseur SQLite ignore
//     l'index dans la forme réelle (mesuré : SCAN) ; le delete passe par PK ;
//   - locks (recordId, collection, userId) : le client locks travaille
//     exclusivement par PK (id = resourceId, getOne/update/subscribe) ;
//     recordId/collection sont des champs vestiges jamais remplis ni requêtés.

migrate((app) => {
  addIndex(app, "events", "idx_events_updated", "CREATE INDEX `idx_events_updated` ON `events` (`updated`)");
  addIndex(app, "materiel", "idx_materiel_updated", "CREATE INDEX `idx_materiel_updated` ON `materiel` (`updated`)");
  addIndex(app, "materiel_loan", "idx_materiel_loan_updated", "CREATE INDEX `idx_materiel_loan_updated` ON `materiel_loan` (`updated`)");
  addIndex(app, "recipes", "idx_recipes_updated", "CREATE INDEX `idx_recipes_updated` ON `recipes` (`updated`)");
  addIndex(app, "teamdocs", "idx_teamdocs_updated", "CREATE INDEX `idx_teamdocs_updated` ON `teamdocs` (`updated`)");
  addIndex(app, "ingredients", "idx_ingredients_updated", "CREATE INDEX `idx_ingredients_updated` ON `ingredients` (`updated`)");
  addIndex(app, "categories", "idx_categories_updated", "CREATE INDEX `idx_categories_updated` ON `categories` (`updated`)");
  addIndex(app, "products", "idx_products_eventId_updated", "CREATE INDEX `idx_products_eventId_updated` ON `products` (`eventId`, `updated`)");
  addIndex(app, "purchases", "idx_purchases_eventId_updated", "CREATE INDEX `idx_purchases_eventId_updated` ON `purchases` (`eventId`, `updated`)");
  addIndex(app, "event_materiel", "idx_event_materiel_eventId_updated", "CREATE INDEX `idx_event_materiel_eventId_updated` ON `event_materiel` (`eventId`, `updated`)");
  addIndex(app, "share_links", "idx_share_links_target", "CREATE INDEX `idx_share_links_target` ON `share_links` (`target_id`, `link_type`)");
}, (app) => {
  removeIndex(app, "events", "idx_events_updated");
  removeIndex(app, "materiel", "idx_materiel_updated");
  removeIndex(app, "materiel_loan", "idx_materiel_loan_updated");
  removeIndex(app, "recipes", "idx_recipes_updated");
  removeIndex(app, "teamdocs", "idx_teamdocs_updated");
  removeIndex(app, "ingredients", "idx_ingredients_updated");
  removeIndex(app, "categories", "idx_categories_updated");
  removeIndex(app, "products", "idx_products_eventId_updated");
  removeIndex(app, "purchases", "idx_purchases_eventId_updated");
  removeIndex(app, "event_materiel", "idx_event_materiel_eventId_updated");
  removeIndex(app, "share_links", "idx_share_links_target");
})

// Reassigne un tableau JS neuf (jamais de mutation du wrapper goja) ;
// idempotent : skip si le nom est déjà présent. Préserve les index existants
// (ex. idx_ingredients_uuid sur ingredients).
function addIndex(app, collectionName, indexName, ddl) {
  const collection = app.findCollectionByNameOrId(collectionName);
  const current = collection.indexes || [];
  for (var i = 0; i < current.length; i++) {
    if (current[i].indexOf(indexName) !== -1) {
      return;
    }
  }
  const next = [];
  for (var j = 0; j < current.length; j++) {
    next.push(current[j]);
  }
  next.push(ddl);
  collection.indexes = next;
  app.save(collection);
}

// Ne retire que les index nommés — préserve les index étrangers posés
// par ailleurs (down() sélectif, sûr si un autre index a été ajouté entre-temps).
function removeIndex(app, collectionName, indexName) {
  const collection = app.findCollectionByNameOrId(collectionName);
  const current = collection.indexes || [];
  const kept = [];
  var removed = false;
  for (var i = 0; i < current.length; i++) {
    if (current[i].indexOf(indexName) !== -1) {
      removed = true;
      continue;
    }
    kept.push(current[i]);
  }
  if (!removed) {
    return;
  }
  collection.indexes = kept;
  app.save(collection);
}
