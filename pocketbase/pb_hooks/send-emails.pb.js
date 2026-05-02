/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : POST /api/enka/send-emails
//
// Route agnostique d'envoi d'emails — pilotee par template.
// Utilisable pour : invitation a un event, invitation a une team, etc.
// L'echec d'un email individuel ne bloque pas les autres.
//
// Fonctions helper chargees via require() car les handlers JSVM sont executes
// dans un contexte isole (cf. docs PB "Caveats and limitations").
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

  // --- Config mailer ---
  var senderAddress = $app.settings().meta.senderAddress;
  if (!senderAddress) {
    throw new InternalServerError(
      "SMTP non configure. Configurez l'expediteur dans les parametres PocketBase."
    );
  }

  var inviterName = e.auth.getString("name") || e.auth.getString("email") || "Quelqu'un";

  // --- Charger le module template (DOIT etre DANS le handler) ---
  var emailTemplates = require(__hooks + "/lib/email-templates.js");

  // --- Envoyer les emails ---
  var results = [];
  var okCount = 0;
  var failCount = 0;

  for (var i = 0; i < recipients.length; i++) {
    var recipient = recipients[i];
    var email = recipient.email || "";
    var shareLinkId = recipient.shareLinkId || "";

    if (!email) {
      results.push({ email: email, ok: false, error: "Email manquant" });
      failCount++;
      continue;
    }

    if (!shareLinkId) {
      results.push({ email: email, ok: false, error: "shareLinkId manquant" });
      failCount++;
      continue;
    }

    // Verifier que le share_link existe et est actif
    var linkValid = false;

    try {
      var shareLink = $app.findRecordById("share_links", shareLinkId);

      if (shareLink.getBool("isActive")) {
        linkValid = true;
      }
    } catch (e) {
      // share_link introuvable
    }

    if (!linkValid) {
      results.push({
        email: email,
        ok: false,
        error: "Lien de partage introuvable ou inactif"
      });
      failCount++;
      continue;
    }

    // Construire le HTML via le module partage
    var html = emailTemplates.buildInvitationEmail(
      inviterName,
      eventName,
      eventDescription,
      dateStart,
      dateEnd,
      shareLinkId
    );

    // Envoyer - utiliser $app.newMailClient() pour PB v0.37+
    try {
      var message = new MailerMessage({
        from: { address: senderAddress },
        to: [{ address: email }],
        subject: inviterName + " vous invite a l'evenement: " + eventName,
        html: html
      });

      $app.newMailClient().send(message);

      results.push({ email: email, ok: true });
      okCount++;
      console.log("[send-emails] Email envoye a " + email + " pour l'evenement " + eventName);
    } catch (e) {
      results.push({
        email: email,
        ok: false,
        error: String(e)
      });
      failCount++;
      console.error("[send-emails] Erreur d'envoi a " + email + ": " + String(e));
    }
  }

  console.log(
    "[send-emails] Termine: " + okCount + " ok, " + failCount + " echec(s) sur " + recipients.length + " destinataire(s)"
  );

  // --- Reponse ---
  return e.json(200, { success: true, results: results });
}, $apis.requireAuth());
