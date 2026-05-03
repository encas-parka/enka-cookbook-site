// Fixup: purchases.products — json → relation (multiple → products)
// purchases.products — invoiceId: text (inchangé)
// Collection VIDE — safe de drop + recreate
//
// ⚠️ JSVM limitation (PB v0.37.5) :
//   - fields.remove(field.id) → TypeError: Object has no member 'remove'
//   - field.type = "relation" sur un JSONField → ne change pas le type (instances typées Goja)
//   → Workaround : drop la collection entière + new Collection() avec le schéma final
//
// Cette migration remplace l'ancien fichier 1777813748_purchases_schema_fixup.js

migrate(
  function (app) {
    // 1. Supprimer la collection existante (vide)
    var old = app.findCollectionByNameOrId("purchases");
    app.delete(old);

    // 2. IDs des collections référencées
    var eventsId = app.findCollectionByNameOrId("events").id;
    var productsId = app.findCollectionByNameOrId("products").id;

    // 3. Recréer avec le schéma complet (products = relation → products)
    var collection = new Collection({
      name: "purchases",
      type: "base",
      // API rules — collections enfants d'event (guestEmails pattern)
      listRule:
        '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule:
        '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        // eventId: relation → events (obligatoire)
        {
          name: "eventId",
          type: "relation",
          collectionId: eventsId,
          required: true,
          maxSelect: 1,
        },
        // store: json (objet magasin)
        { name: "store", type: "json" },
        // status: text
        { name: "status", type: "text" },
        // deleted: bool
        { name: "deleted", type: "bool" },
        // unit: text (obligatoire, ex: "kg", "L")
        { name: "unit", type: "text", required: true },
        // notes: text
        { name: "notes", type: "text" },
        // price: number
        { name: "price", type: "number" },
        // quantity: number (obligatoire)
        { name: "quantity", type: "number", required: true },
        // who: text (nom d'utilisateur, pas un ID)
        { name: "who", type: "text" },
        // createdBy: relation → users
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        // orderDate: date
        { name: "orderDate", type: "date" },
        // deliveryDate: date
        { name: "deliveryDate", type: "date" },
        // invoiceId: text (ID facture libre)
        { name: "invoiceId", type: "text" },
        // invoiceTotal: number
        { name: "invoiceTotal", type: "number" },
        // ⚡ products: relation → products (maxSelect: 999, remplace json)
        {
          name: "products",
          type: "relation",
          collectionId: productsId,
          maxSelect: 999,
        },
      ],
    });

    app.save(collection);
  },
  function (app) {
    // Down: recréer purchases avec products en json
    var old = app.findCollectionByNameOrId("purchases");
    app.delete(old);

    var eventsId = app.findCollectionByNameOrId("events").id;

    var collection = new Collection({
      name: "purchases",
      type: "base",
      listRule:
        '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      viewRule:
        '@request.auth.id != "" && (@collection.events.guestEmails ?= @request.auth.email || @collection.events.joinToken = @request.query.joinToken)',
      createRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      updateRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      deleteRule:
        '@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email',
      fields: [
        {
          name: "eventId",
          type: "relation",
          collectionId: eventsId,
          required: true,
          maxSelect: 1,
        },
        { name: "store", type: "json" },
        { name: "status", type: "text" },
        { name: "deleted", type: "bool" },
        { name: "unit", type: "text", required: true },
        { name: "notes", type: "text" },
        { name: "price", type: "number" },
        { name: "quantity", type: "number", required: true },
        { name: "who", type: "text" },
        {
          name: "createdBy",
          type: "relation",
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
        },
        { name: "orderDate", type: "date" },
        { name: "deliveryDate", type: "date" },
        { name: "invoiceId", type: "text" },
        { name: "invoiceTotal", type: "number" },
        { name: "products", type: "json" },
      ],
    });

    app.save(collection);
  },
);
