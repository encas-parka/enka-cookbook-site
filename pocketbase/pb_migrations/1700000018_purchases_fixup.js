// Phase A5 — Fixup "purchases" collection (add missing fields)
// Existing: eventId, store, status, deleted
// Adding: unit, notes, price, quantity, who (text=name), createdBy (relation→users), orderDate, deliveryDate, invoiceId, invoiceTotal, products
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("purchases");

    collection.fields.add(new TextField({ name: "unit", required: true }));
    collection.fields.add(new TextField({ name: "notes" }));
    collection.fields.add(new NumberField({ name: "price" }));
    collection.fields.add(new NumberField({ name: "quantity", required: true }));
    // who: nom d'utilisateur (pas un ID) — ex: "Jean"
    collection.fields.add(new TextField({ name: "who" }));
    // createdBy: relation vers users
    collection.fields.add(
      new RelationField({
        name: "createdBy",
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      }),
    );
    collection.fields.add(new DateField({ name: "orderDate" }));
    collection.fields.add(new DateField({ name: "deliveryDate" }));
    collection.fields.add(new TextField({ name: "invoiceId" }));
    collection.fields.add(new NumberField({ name: "invoiceTotal" }));
    collection.fields.add(new JSONField({ name: "products" }));

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("purchases");

    var fieldsToRemove = [
      "unit",
      "notes",
      "price",
      "quantity",
      "who",
      "createdBy",
      "orderDate",
      "deliveryDate",
      "invoiceId",
      "invoiceTotal",
      "products",
    ];
    for (var i = 0; i < fieldsToRemove.length; i++) {
      var field = collection.fields.getByName(fieldsToRemove[i]);
      if (field) {
        collection.fields.remove(field.id);
      }
    }

    txApp.save(collection);
  },
);
