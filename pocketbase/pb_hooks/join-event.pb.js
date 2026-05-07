/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : POST /api/enka/join-event
//
// Permet a un utilisateur authentifie de rejoindre un evenement via un share link.
// Cote serveur car l'API rule de events interdit l'update aux non-membres.
//
// Body : { linkId: string }
// Reponse : { eventId: string }
//
// Logique :
//   1. Trouver le share_link par ID
//   2. Verifier qu'il est actif
//   3. Recuperer l'evenement cible
//   4. Ajouter l'email de l'utilisateur dans guestEmails[] (si pas deja present)
//   5. Retourner l'eventId
// ==============================================================================

routerAdd("POST", "/api/enka/join-event", function(e) {
  // --- Auth check ---
  if (!e.auth) {
    throw new UnauthorizedError("Authentification requise");
  }

  var userEmail = e.auth.getString("email");
  var userId = e.auth.id;

  if (!userEmail) {
    throw new BadRequestError("Utilisateur sans email");
  }

  // --- Lire le body ---
  var body = e.requestInfo().body;
  var linkId = body.linkId || "";

  if (!linkId) {
    throw new BadRequestError("linkId requis");
  }

  // --- Trouver le share_link ---
  var shareLink;
  try {
    shareLink = $app.findRecordById("share_links", linkId);
  } catch (err) {
    throw new NotFoundError("Lien de partage introuvable");
  }

  // --- Verifier qu'il est actif ---
  var isActive = shareLink.getBool("isActive");
  if (!isActive) {
    throw new BadRequestError("Ce lien de partage est desactive");
  }

  // --- Recuperer l'evenement cible ---
  var targetId = shareLink.getString("target_id");
  if (!targetId) {
    throw new BadRequestError("Lien de partage invalide (pas de cible)");
  }

  var event;
  try {
    event = $app.findRecordById("events", targetId);
  } catch (err) {
    throw new NotFoundError("Evenement introuvable");
  }

  // --- Ajouter l'utilisateur dans guestUsers[] si pas deja present ---
  var currentGuestUsers = event.get("guestUsers") || [];
  var guestUserArray = Array.isArray(currentGuestUsers) ? currentGuestUsers : [];

  var alreadyJoined = false;
  for (var i = 0; i < guestUserArray.length; i++) {
    if (guestUserArray[i] === userId) {
      alreadyJoined = true;
      break;
    }
  }

  if (!alreadyJoined) {
    var updatedGuestUsers = guestUserArray.concat([userId]);
    event.set("guestUsers", updatedGuestUsers);
  }

  // --- Ajouter l'email dans guestEmails[] pour tracking ---
  var currentGuests = event.get("guestEmails") || [];
  var guestArray = Array.isArray(currentGuests) ? currentGuests : [];

  if (guestArray.indexOf(userEmail) === -1) {
    var updatedGuests = guestArray.concat([userEmail]);
    event.set("guestEmails", updatedGuests);
  }

  // Save if anything changed
  if (!alreadyJoined || guestArray.indexOf(userEmail) === -1) {
    $app.save(event);
    $app.logger().info(
      "User joined event",
      "email", userEmail,
      "userId", userId,
      "eventId", targetId
    );
  } else {
    console.log(
      "[join-event] " + userEmail + " already in event " + targetId
    );
  }

  // --- Reponse ---
  return e.json(200, { eventId: targetId });
}, $apis.requireAuth());
