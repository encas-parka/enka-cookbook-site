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
//   ],
//   eventName: string,
//   eventDescription?: string,
//   dateStart: string,
//   dateEnd?: string,
// }
//
// Reponse : {
//   success: true,
//   results: [{ email: string, ok: boolean, error?: string }]
// }
// ==============================================================================

routerAdd("POST", "/api/enka/send-emails", function(e) {
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
  var eventName = body.eventName || "";
  var eventDescription = body.eventDescription || "";
  var dateStart = body.dateStart || "";
  var dateEnd = body.dateEnd || "";

  // --- Validation ---
  if (template !== "invitation_to_event") {
    throw new BadRequestError(
      "Template inconnu: " + template + ". Seul 'invitation_to_event' est supporte."
    );
  }

  if (!recipients.length) {
    throw new BadRequestError("Au moins un destinataire requis");
  }

  if (!eventName) {
    throw new BadRequestError("eventName requis");
  }

  if (!dateStart) {
    throw new BadRequestError("dateStart requis");
  }

  var inviterName = e.auth.getString("name") || e.auth.getString("email") || "Quelqu'un";

  // --- Charger les modules (DOIT etre DANS le handler) ---
  var mailer = require(__hooks + "/lib/mailer.js");
  var emailTemplates = require(__hooks + "/lib/email-templates.js");

  // Verifier la config SMTP (throw si pas configuré)
  mailer.getSenderAddress();

  // --- Preparer les emails a envoyer ---
  var emailsToSend = [];
  var skippedResults = [];

  for (var i = 0; i < recipients.length; i++) {
    var recipient = recipients[i];
    var email = recipient.email || "";
    var shareLinkId = recipient.shareLinkId || "";

    if (!email) {
      skippedResults.push({ email: email, ok: false, error: "Email manquant" });
      continue;
    }

    if (!shareLinkId) {
      skippedResults.push({ email: email, ok: false, error: "shareLinkId manquant" });
      continue;
    }

    // Verifier que le share_link existe et est actif
    var linkValid = false;
    try {
      var shareLink = $app.findRecordById("share_links", shareLinkId);
      if (shareLink.getBool("isActive")) {
        linkValid = true;
      }
    } catch (err) {
      // share_link introuvable
    }

    if (!linkValid) {
      skippedResults.push({
        email: email,
        ok: false,
        error: "Lien de partage introuvable ou inactif"
      });
      continue;
    }

    // Construire le HTML via le module template
    var html = emailTemplates.buildInvitationEmail(
      inviterName,
      eventName,
      eventDescription,
      dateStart,
      dateEnd,
      shareLinkId
    );

    emailsToSend.push({
      to: email,
      subject: inviterName + " vous invite a l'evenement: " + eventName,
      html: html
    });
  }

  // --- Envoi batch via le mailer agnostique ---
  var sendResults = mailer.sendBatch(emailsToSend, "send-emails");

  // --- Combiner les resultats (skipped + envoyes) ---
  var results = [];

  for (var s = 0; s < skippedResults.length; s++) {
    results.push(skippedResults[s]);
  }

  for (var r = 0; r < sendResults.length; r++) {
    results.push({
      email: sendResults[r].to,
      ok: sendResults[r].ok,
      error: sendResults[r].error || undefined
    });
  }

  // --- Reponse ---
  return e.json(200, { success: true, results: results });
}, $apis.requireAuth());
