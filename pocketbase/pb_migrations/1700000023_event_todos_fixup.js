// Phase A9b — Fixup "event_todos" collection (add missing fields)
// Existing: eventId, task, taskOn, priority, status, assignedTo
// Adding: taskDescription, dueDate, requiredPeopleNb, locked
migrate(
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("event_todos");

    collection.fields.add(new TextField({ name: "taskDescription" }));
    collection.fields.add(new DateField({ name: "dueDate" }));
    collection.fields.add(new NumberField({ name: "requiredPeopleNb" }));
    collection.fields.add(new BoolField({ name: "locked" }));

    txApp.save(collection);
  },
  function (txApp) {
    var collection = txApp.findCollectionByNameOrId("event_todos");

    var fieldsToRemove = [
      "taskDescription",
      "dueDate",
      "requiredPeopleNb",
      "locked",
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
