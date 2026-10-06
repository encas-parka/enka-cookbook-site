/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : GET /api/enka/lookup-user
//
// Resolution d'un utilisateur PocketBase par email, pour le client.
// Remplace users.getList (bloque par la listRule users : id = @request.auth.id).
//
// Match EXACT sur l'email (pas de search/LIKE : pas de leakage de sous-chaines).
//
// NOTE SEC : l'enumeration d'emails par un utilisateur authentifie est acceptee
// pour une app collaborative (auth requise, pas de donnees sensibles dans la
// reponse — id et nom d'affichage uniquement).
//
// Query : ?email=...
// Reponse : 200 { id, name } | 404 utilisateur inconnu | 400 email manquant | 401 sans auth
// ==============================================================================

routerAdd("GET", "/api/enka/lookup-user", function(e) {
  // --- Auth check ---
  if (!e.auth) {
    throw new UnauthorizedError("Authentification requise");
  }

  // --- Lire le query param email (bindings url.Values defensifs) ---
  var query = e.requestInfo().query || {};
  var rawEmail = "";
  if (typeof query.get === "function") {
    rawEmail = query.get("email") || "";
  } else if (query.email) {
    rawEmail = Array.isArray(query.email) ? (query.email[0] || "") : String(query.email);
  }

  var email = String(rawEmail || "").trim().toLowerCase();
  if (!email) {
    throw new BadRequestError("email requis");
  }

  // --- Match exact ---
  var user;
  try {
    user = $app.findFirstRecordByFilter("users", "email = {:email}", { email: email });
  } catch (err) {
    throw new NotFoundError("Utilisateur introuvable");
  }

  $app.logger().info(
    "User lookup",
    "email", email,
    "userId", user.id,
    "by", e.auth.id
  );

  return e.json(200, { id: user.id, name: user.getString("name") || "" });
}, $apis.requireAuth());
