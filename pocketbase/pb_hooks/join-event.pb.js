/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : POST /api/enka/join-event
//
// Permet à un utilisateur authentifié de rejoindre un événement via un share link.
// Côté serveur car l'API rule de events interdit l'update aux non-membres.
//
// Body : { linkId: string }
// Réponse : { eventId: string }
//
// Logique :
//   1. Trouver le share_link par ID
//   2. Vérifier qu'il est actif
//   3. Récupérer l'événement cible
//   4. Ajouter l'email de l'utilisateur dans guestEmails[] (si pas déjà présent)
//   5. Retourner l'eventId
// ==============================================================================

routerAdd("POST", "/api/enka/join-event", (e) => {
  // --- Auth check ---
  if (!e.auth) {
    throw new UnauthorizedError("Authentification requise");
  }

  const userEmail = e.auth.getString("email");
  const userId = e.auth.id;

  if (!userEmail) {
    throw new BadRequestError("Utilisateur sans email");
  }

  // --- Lire le body ---
  const body = e.requestInfo().body;
  const linkId = body.linkId || "";

  if (!linkId) {
    throw new BadRequestError("linkId requis");
  }

  // --- Trouver le share_link ---
  let shareLink;
  try {
    shareLink = $app.findRecordById("share_links", linkId);
  } catch (err) {
    throw new NotFoundError("Lien de partage introuvable");
  }

  // --- Vérifier qu'il est actif ---
  const isActive = shareLink.getBool("isActive");
  if (!isActive) {
    throw new BadRequestError("Ce lien de partage est désactivé");
  }

  // --- Récupérer l'événement cible ---
  const targetId = shareLink.getString("target_id");
  if (!targetId) {
    throw new BadRequestError("Lien de partage invalide (pas de cible)");
  }

  let event;
  try {
    event = $app.findRecordById("events", targetId);
  } catch (err) {
    throw new NotFoundError("Événement introuvable");
  }

  // --- Ajouter l'email dans guestEmails[] si pas déjà présent ---
  const currentGuests = event.get("guestEmails") || [];
  const guestArray = Array.isArray(currentGuests) ? currentGuests : [];

  if (guestArray.indexOf(userEmail) === -1) {
    const updatedGuests = guestArray.concat([userEmail]);
    event.set("guestEmails", updatedGuests);
    $app.save(event);
    console.log(
      "[join-event] " + userEmail + " ajouté à l'événement " + targetId
    );
  } else {
    console.log(
      "[join-event] " + userEmail + " déjà dans l'événement " + targetId
    );
  }

  // --- Réponse ---
  return e.json(200, { eventId: targetId });
}, $apis.requireAuth());
