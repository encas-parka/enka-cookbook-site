/// <reference path="../pb_data/types.d.ts" />

// Lot rules API — moindres privilèges (audit 26-10-06, REC-1/3/5/6/7/9,
// EVENT-1, SEC-2). Chaque garde create se lit « @request.body.X = moi » :
// le client doit revendiquer sa propre identité, pas celle d'autrui.
//
// Choix documentés :
// - REC-9 (materiel_loan) : le client (CreateLoanModal) n'envoie jamais
//   borrowerUser/createdBy ; il pose responsibleId = courant. La garde
//   mire donc responsibleId = auth (flux réel) || ownerId.members ~ auth
//   (membre de l'équipe propriétaire, miroir du modèle acteur list/update).
// - REC-6 (teams) : clause grand-père (createdBy = "") — les teams
//   pré-delta (createdBy vide) gardent le delete par membres. updateRule
//   reste members ~ (collaboration) : le risque réel est le cascade delete.
//
// No-op volontaires (déjà à la cible dans le snapshot dev, fix 042/043) :
// events updateRule et les 5 collections enfants (guestUsers, sans
// guestEmails ni joinToken dans aucune règle).

migrate((app) => {
  const rules = [
    {
      name: "recipes",
      updateRule: '@request.auth.id != "" && (@request.auth.id = createdBy || permissionWrite ~ @request.auth.id)',
    },
    {
      name: "share_links",
      listRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      viewRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      createRule: '@request.auth.id != "" && @request.body.createdBy = @request.auth.id',
      updateRule: '@request.auth.id != "" && createdBy = @request.auth.id',
      deleteRule: '@request.auth.id != "" && createdBy = @request.auth.id',
    },
    {
      name: "events",
      listRule: '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || createdBy = @request.auth.id)',
      viewRule: '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id || createdBy = @request.auth.id)',
    },
    {
      name: "teams",
      deleteRule: '@request.auth.id != "" && (createdBy = @request.auth.id || (createdBy = "" && members ~ @request.auth.id))',
    },
    {
      name: "notifications",
      createRule: '@request.auth.id != "" && @request.body.userId = @request.auth.id',
    },
    {
      name: "materiel",
      createRule: '@request.auth.id != "" && (@request.body.teamId.members ~ @request.auth.id || @request.body.ownerUser = @request.auth.id)',
    },
    {
      name: "materiel_loan",
      createRule: '@request.auth.id != "" && (@request.body.responsibleId = @request.auth.id || @request.body.ownerId.members ~ @request.auth.id)',
    },
    {
      name: "locks",
      createRule: '@request.auth.id != "" && @request.body.userId = @request.auth.id',
    },
  ];

  for (const r of rules) {
    const collection = app.findCollectionByNameOrId(r.name);
    for (const key in r) {
      if (key === "name") continue;
      collection[key] = r[key];
    }
    app.save(collection);
  }
}, (app) => {
  const restore = [
    {
      name: "recipes",
      updateRule: '@request.auth.id != "" && (@request.auth.id = createdBy || permissionWrite ?= @request.auth.id)',
    },
    {
      name: "share_links",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    },
    {
      name: "events",
      listRule: '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id)',
      viewRule: '@request.auth.id != "" && (teams.members ~ @request.auth.id || guestUsers ~ @request.auth.id)',
    },
    {
      name: "teams",
      deleteRule: '@request.auth.id != "" && members ~ @request.auth.id',
    },
    {
      name: "notifications",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "materiel",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "materiel_loan",
      createRule: '@request.auth.id != ""',
    },
    {
      name: "locks",
      createRule: '@request.auth.id != ""',
    },
  ];

  for (const r of restore) {
    const collection = app.findCollectionByNameOrId(r.name);
    for (const key in r) {
      if (key === "name") continue;
      collection[key] = r[key];
    }
    app.save(collection);
  }
})
