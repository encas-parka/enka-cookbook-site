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
//   2. Verifier le lien : type "event", actif, non expire, maxUses non atteint
//   3. Verifier l'evenement cible : statut joignable (proposition/confirmed,
//      fail-closed sur toute autre valeur)
//   4. Ajouter l'utilisateur dans guestUsers[] + guestEmails[] (si pas deja present)
//   5. Contributors : entree dediee (id reel), dedoublonnee par email —
//      une entree existante de meme email (id nanoid pose par inviteParticipants)
//      est rattachee au vrai userId ; son statut n'est pas ecrase (le RSVP
//      cote client reste maitre d'une invitation en attente)
//   6. Incrementer useCount (premier join uniquement) — read-modify-save sans
//      verrou : race JSVM assumee, deux joins concurrents peuvent deborder
//      maxUses d'une unite
//   7. Retourner l'eventId
// ==============================================================================

routerAdd(
  "POST",
  "/api/enka/join-event",
  function (e) {
    // --- Auth check ---
    if (!e.auth) {
      throw new UnauthorizedError("Authentification requise");
    }

    var userEmail = e.auth.getString("email");
    var userId = e.auth.id;
    var userName = e.auth.getString("name") || "";

    if (!userEmail) {
      throw new BadRequestError("Utilisateur sans email");
    }

    // --- Lire le body ---
    var body = e.requestInfo().body;
    var linkId = body.linkId || "";

    if (!linkId) {
      throw new BadRequestError("linkId requis");
    }

    // Helper local : refus de join journalise + erreur 400
    var refuse = function (reason) {
      $app
        .logger()
        .warn("Join refused: " + reason, "linkId", linkId, "userId", userId);
      throw new BadRequestError(reason);
    };

    // Helper : lecture d'un champ JSON en tableau JS pur.
    // get() sur un champ JSON renvoie l'export goja du []byte brut —
    // []byte("[]") devient [91,93] (codes ASCII) — et muter CE wrapper
    // corrompt la donnée stockée. getString() rend le texte JSON : parse.
    var jsonArray = function (record, field) {
      var raw = record.getString(field);
      if (!raw) {
        return [];
      }
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    };

    // --- Trouver le share_link ---
    var shareLink;
    try {
      shareLink = $app.findRecordById("share_links", linkId);
    } catch (err) {
      throw new NotFoundError("Lien de partage introuvable");
    }

    // --- Verifier le type de lien (un lien team ne joint pas un event) ---
    if (shareLink.getString("link_type") !== "event") {
      refuse("Ce lien ne permet pas de rejoindre un evenement");
    }

    // --- Verifier qu'il est actif ---
    if (!shareLink.getBool("isActive")) {
      refuse("Ce lien de partage est desactive");
    }

    // --- Verifier l'expiration (date PB "YYYY-MM-DD HH:mm:ss.SSSZ" → ISO T) ---
    var expiresAt = shareLink.getString("expiresAt");
    if (expiresAt !== "") {
      var expiresMs = new Date(expiresAt.replace(" ", "T")).getTime();
      if (isNaN(expiresMs) || expiresMs <= Date.now()) {
        refuse("Ce lien de partage est expire");
      }
    }

    // --- Verifier maxUses/useCount (maxUses 0 = illimite) ---
    var maxUses = shareLink.getInt("maxUses");
    var useCount = shareLink.getInt("useCount");
    if (maxUses > 0 && useCount >= maxUses) {
      refuse("Ce lien de partage a atteint sa limite d'utilisation");
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

    // --- Statut de l'event : joignable uniquement en proposition/confirmed ---
    // (fail-closed : archive/locked/canceled ou valeur inconnue → refus)
    var eventStatus = event.getString("status");
    if (eventStatus !== "proposition" && eventStatus !== "confirmed") {
      refuse("Cet evenement n'accepte pas de nouveaux participants");
    }

    // --- Ajouter l'utilisateur dans guestUsers[] si pas deja present ---
    var currentGuestUsers = event.get("guestUsers") || [];
    var guestUserArray = Array.isArray(currentGuestUsers)
      ? currentGuestUsers
      : [];

    var alreadyJoined = false;
    for (var i = 0; i < guestUserArray.length; i++) {
      if (guestUserArray[i] === userId) {
        alreadyJoined = true;
        break;
      }
    }

    var guestUsersChanged = false;
    if (!alreadyJoined) {
      event.set("guestUsers", guestUserArray.concat([userId]));
      guestUsersChanged = true;
    }

    // --- Ajouter l'email dans guestEmails[] pour tracking ---
    var guestArray = jsonArray(event, "guestEmails");

    var guestEmailsChanged = false;
    if (guestArray.indexOf(userEmail) === -1) {
      event.set("guestEmails", guestArray.concat([userEmail]));
      guestEmailsChanged = true;
    }

    // --- Contributors : dedoublonnage par email ---
    var contributorArray = jsonArray(event, "contributors");

    var contributorsChanged = false;
    var matchIndex = -1;
    for (var j = 0; j < contributorArray.length; j++) {
      var existing = contributorArray[j];
      if (
        existing &&
        typeof existing === "object" &&
        String(existing.email || "").toLowerCase() === userEmail.toLowerCase()
      ) {
        matchIndex = j;
        break;
      }
    }

    if (matchIndex === -1) {
      var entry = { id: userId, email: userEmail, status: "accepted" };
      if (userName) {
        entry.name = userName;
      }
      contributorArray.push(entry);
      contributorsChanged = true;
    } else {
      var match = contributorArray[matchIndex];
      if (String(match.id || "") !== userId) {
        // id temporaire (nanoid pose par inviteParticipants) → vrai userId
        match.id = userId;
        contributorsChanged = true;
      }
      if (!match.name && userName) {
        match.name = userName;
        contributorsChanged = true;
      }
    }
    if (contributorsChanged) {
      // contributorArray est issu de JSON.parse (objets JS purs) → marshalling sûr
      event.set("contributors", contributorArray);
    }

    // --- useCount : consomme uniquement au premier join (re-join idempotent) ---
    var useCountChanged = false;
    if (!alreadyJoined) {
      shareLink.set("useCount", useCount + 1);
      useCountChanged = true;
    }

    // --- Save si quelque chose a change ---
    if (
      guestUsersChanged ||
      guestEmailsChanged ||
      contributorsChanged ||
      useCountChanged
    ) {
      $app.save(event);
      if (useCountChanged) {
        $app.save(shareLink);
      }
      if (alreadyJoined) {
        $app
          .logger()
          .info(
            "Join reconciled existing participant",
            "email",
            userEmail,
            "userId",
            userId,
            "eventId",
            targetId,
          );
      } else {
        $app
          .logger()
          .info(
            "User joined event",
            "email",
            userEmail,
            "userId",
            userId,
            "eventId",
            targetId,
            "linkId",
            linkId,
            "useCount",
            String(useCount + 1),
          );
      }
    } else {
      $app
        .logger()
        .info(
          "User already in event",
          "email",
          userEmail,
          "userId",
          userId,
          "eventId",
          targetId,
        );
    }

    // --- Reponse ---
    return e.json(200, { eventId: targetId });
  },
  $apis.requireAuth(),
);
