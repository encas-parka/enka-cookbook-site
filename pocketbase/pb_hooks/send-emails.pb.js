/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : POST /api/enka/send-emails
//
// Route d'envoi d'emails pour les invitations evenements.
// Pilotee par template, appelee par le client (EventsStore).
//
// Pour les invitations equipe, utiliser POST /api/enka/invite-to-team
// qui gere aussi la logique metier (lookup users, ajout members).
//
// Body : {
//   template: "invitation_to_event",
//   recipients: [
//     { email: string, shareLinkId: string }
//   ]
// }
//
// Le contenu de l'email (nom, description, dates) est TOUJOURS relu depuis
// l'event cible du share link — les champs equivalents du body client sont
// ignores (pas de contenu arbitraire envoye au nom du domaine de l'app).
//
// Ownership : le share link doit appartenir a l'appelant (createdBy = auth).
// La listRule share_links (`createdBy = auth`) fait de toute facon que le
// client ne peut reference que ses propres liens — ce check est la defense
// en profondeur cote hook (liens pre-REC-1, appels directs a l'API).
// Un lien sans createdBy (orphelin) est refuse : fail-closed.
//
// Reponse : {
//   success: true,
//   results: [{ email: string, ok: boolean, error?: string }]
// }
//
// L'expedition est groupee par le mailer : les emails de contenu identique
// (un meme evenement, contenu relu serveur) partagent une seule expedition
// SMTP, tous les destinataires en copie cachee — voir lib/mailer.js
// sendBatch. Les resultats restent donnes par destinataire.
//
// Un refus (lien introuvable/inactif/etranger, event cible mort) est reporte
// par destinataire (ok: false + error) et logge en warn ; la reponse reste 200.
// Le SMTP n'est verifie que si au moins un email doit partir : un lot
// entierement refuse repond 200 sans dependre de la config SMTP.
// ==============================================================================

routerAdd(
  "POST",
  "/api/enka/send-emails",
  function (e) {
    // --- Auth check ---
    if (!e.auth) {
      throw new UnauthorizedError("Authentification requise");
    }

    // --- Lire le body ---
    var body = e.requestInfo().body;
    if (!body) {
      throw new BadRequestError("Body requis");
    }

    var template = body.template || "";
    var recipients = body.recipients || [];

    // --- Validation ---
    if (template !== "invitation_to_event") {
      throw new BadRequestError(
        "Template inconnu: " +
          template +
          ". Seul 'invitation_to_event' est supporte.",
      );
    }

    if (!recipients.length) {
      throw new BadRequestError("Au moins un destinataire requis");
    }

    var inviterName =
      e.auth.getString("name") || e.auth.getString("email") || "Quelqu'un";

    // --- Charger les modules (DOIT etre DANS le handler) ---
    var mailer = require(__hooks + "/lib/mailer.js");
    var emailTemplates = require(__hooks + "/lib/email-templates.js");

    // --- Preparer les emails a envoyer ---
    var emailsToSend = [];
    var skippedResults = [];

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i];
      var email = recipient.email || "";
      var shareLinkId = recipient.shareLinkId || "";

      if (!email) {
        skippedResults.push({
          email: email,
          ok: false,
          error: "Email manquant",
        });
        continue;
      }

      if (!shareLinkId) {
        skippedResults.push({
          email: email,
          ok: false,
          error: "shareLinkId manquant",
        });
        continue;
      }

      // Verifier que le share_link existe et est actif
      var shareLink = null;
      try {
        shareLink = $app.findRecordById("share_links", shareLinkId);
      } catch (err) {
        // share_link introuvable
      }

      if (!shareLink || !shareLink.getBool("isActive")) {
        skippedResults.push({
          email: email,
          ok: false,
          error: "Lien de partage introuvable ou inactif",
        });
        $app
          .logger()
          .warn(
            "Send refused: lien introuvable ou inactif",
            "linkId",
            shareLinkId,
            "userId",
            e.auth.id,
          );
        continue;
      }

      if (shareLink.getString("link_type") !== "event") {
        skippedResults.push({
          email: email,
          ok: false,
          error: "Lien de partage invalide pour une invitation evenement",
        });
        $app
          .logger()
          .warn(
            "Send refused: link_type != event",
            "linkId",
            shareLinkId,
            "userId",
            e.auth.id,
          );
        continue;
      }

      if (shareLink.getString("createdBy") !== e.auth.id) {
        skippedResults.push({
          email: email,
          ok: false,
          error: "Lien de partage non autorise",
        });
        $app
          .logger()
          .warn(
            "Send refused: ownership (createdBy != auth)",
            "linkId",
            shareLinkId,
            "userId",
            e.auth.id,
            "owner",
            shareLink.getString("createdBy"),
          );
        continue;
      }

      // Reconciliation : contenu relu depuis l'event reel, jamais du body
      var eventRecord = null;
      try {
        eventRecord = $app.findRecordById(
          "events",
          shareLink.getString("target_id"),
        );
      } catch (err2) {
        // event cible introuvable (supprime entre-temps ?)
      }

      if (!eventRecord) {
        skippedResults.push({
          email: email,
          ok: false,
          error: "Evenement cible du lien introuvable",
        });
        $app
          .logger()
          .warn(
            "Send refused: event cible introuvable",
            "linkId",
            shareLinkId,
            "userId",
            e.auth.id,
          );
        continue;
      }

      var realEventName = eventRecord.getString("name");
      var realEventDescription = eventRecord.getString("description");
      var realDateStart = eventRecord.getString("dateStart");
      var realDateEnd = eventRecord.getString("dateEnd");

      // Construire le HTML via le module template (donnees serveur)
      var html = emailTemplates.buildInvitationEmail(
        inviterName,
        realEventName,
        realEventDescription,
        realDateStart,
        realDateEnd,
        shareLinkId,
      );

      emailsToSend.push({
        to: email,
        subject: inviterName + " vous invite a l'evenement: " + realEventName,
        html: html,
      });

      $app
        .logger()
        .info(
          "Invitation email built",
          "to",
          email,
          "event",
          realEventName,
          "eventId",
          eventRecord.id,
          "userId",
          e.auth.id,
        );
    }

    // --- Envoi batch via le mailer agnostique ---
    var sendResults = [];
    if (emailsToSend.length > 0) {
      // Verifier la config SMTP (throw 500 propre si pas configure)
      mailer.getSenderAddress();
      sendResults = mailer.sendBatch(emailsToSend, "send-emails");
    }

    // --- Combiner les resultats (skipped + envoyes) ---
    var results = [];

    for (var s = 0; s < skippedResults.length; s++) {
      results.push(skippedResults[s]);
    }

    for (var r = 0; r < sendResults.length; r++) {
      results.push({
        email: sendResults[r].to,
        ok: sendResults[r].ok,
        error: sendResults[r].error || undefined,
      });
    }

    // --- Reponse ---
    return e.json(200, { success: true, results: results });
  },
  $apis.requireAuth(),
);
