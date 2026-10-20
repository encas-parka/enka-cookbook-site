/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : GET /api/enka/lookup-users
//
// Resolution d'un LOT d'utilisateurs PocketBase par ids, pour le client.
// Meme besoin que lookup-user (listRule ET viewRule users : id = @request.auth.id
// — un client ne peut lire que son propre record) mais pour des ids deja connus :
// contributeurs d'une recette, proprietaires a afficher.
//
// Reponse minimale (id + nom d'affichage, pas d'email) — meme NOTE SEC que
// lookup-user : auth requise, aucune donnee sensible exposee.
//
// Query : ?ids=a,b,c (max 50)
// Reponse : 200 { users: [{ id, name }] } — les ids inconnus sont omis
// 400 ids manquant ou trop nombreux | 401 sans auth
// ==============================================================================

routerAdd(
  "GET",
  "/api/enka/lookup-users",
  function (e) {
    // --- Auth check ---
    if (!e.auth) {
      throw new UnauthorizedError("Authentification requise");
    }

    // --- Lire le query param ids (bindings url.Values defensifs) ---
    var query = e.requestInfo().query || {};
    var rawIds = "";
    if (typeof query.get === "function") {
      rawIds = query.get("ids") || "";
    } else if (query.ids) {
      rawIds = Array.isArray(query.ids)
        ? query.ids[0] || ""
        : String(query.ids);
    }

    var parts = String(rawIds || "").split(",");
    var ids = [];
    for (var i = 0; i < parts.length; i++) {
      var id = parts[i].trim();
      if (id && ids.indexOf(id) === -1) ids.push(id);
    }
    if (ids.length === 0) {
      throw new BadRequestError("ids requis");
    }
    if (ids.length > 50) {
      throw new BadRequestError("max 50 ids par requete");
    }

    var users = [];
    for (var j = 0; j < ids.length; j++) {
      try {
        var user = $app.findRecordById("users", ids[j]);
        users.push({ id: user.id, name: user.getString("name") || "" });
      } catch (err) {
        // id inconnu (compte supprime, residu de donnees) : omis — le client
        // garde son fallback sur l'id brut
      }
    }

    return e.json(200, { users: users });
  },
  $apis.requireAuth(),
);
