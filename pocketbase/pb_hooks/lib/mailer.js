/**
 * Mailer utility — agnostique d'envoi d'emails.
 *
 * Wrappe $app.newMailClient().send() avec :
 *   - Vérification de la config SMTP
 *   - Logging standardisé
 *   - Gestion d'erreur par email (un échec ne bloque pas les autres)
 *   - Regroupement des envois batch : un contenu identique (sujet + html)
 *     part en une seule expédition SMTP, tous les destinataires en copie
 *     cachée (BCC)
 *
 * @usage (depuis un handler .pb.js) :
 *   var mailer = require(__hooks + "/lib/mailer.js");
 *   var result = mailer.sendEmail({
 *     to: "user@example.com",
 *     subject: "Bienvenue",
 *     html: "<h1>Hello</h1>"
 *   });
 *
 * // Envoi batch (résultats individuels ; contenus identiques regroupés
 * // en une expédition, destinataires en BCC) :
 *   var results = mailer.sendBatch([
 *     { to: "a@example.com", subject: "S1", html: "<p>A</p>" },
 *     { to: "b@example.com", subject: "S2", html: "<p>B</p>" },
 *   ]);
 */

/**
 * Récupère l'adresse d'expédition configurée dans PocketBase.
 * Throw si SMTP non configuré.
 * @returns {string} senderAddress
 */
function getSenderAddress() {
  var senderAddress = $app.settings().meta.senderAddress;
  if (!senderAddress) {
    throw new InternalServerError(
      "SMTP non configure. Configurez l'expediteur dans les parametres PocketBase.",
    );
  }
  return senderAddress;
}

/**
 * Envoie un seul email.
 *
 * @param {Object} opts
 * @param {string} [opts.to] - Adresse du destinataire principal
 * @param {Array<string>} [opts.bcc] - Destinataires en copie cachée
 * @param {string} opts.subject - Sujet de l'email
 * @param {string} opts.html - Corps HTML de l'email
 * @param {string} [opts.from] - Adresse d'expédition (défaut: config PB)
 * @param {string} [opts.senderName] - Nom pour le logging
 * @returns {{ ok: boolean, error?: string }}
 */
function sendEmail(opts) {
  var to = opts.to || "";
  var bcc = opts.bcc || [];
  var subject = opts.subject || "";
  var html = opts.html || "";
  var senderName = opts.senderName || "send-emails";

  if (!to && bcc.length === 0) {
    return { ok: false, error: "Adresse destinataire manquante" };
  }

  if (!subject) {
    return { ok: false, error: "Sujet manquant" };
  }

  var from = opts.from || getSenderAddress();
  // Quand tout le monde est en copie cachée, le To reprend l'expéditeur :
  // aucun destinataire n'est exposé aux autres.
  var toAddress = to || from;

  try {
    var bccAddresses = bcc.map(function (address) {
      return { address: address };
    });
    var message = new MailerMessage({
      from: { address: from },
      to: [{ address: toAddress }],
      bcc: bccAddresses,
      subject: subject,
      html: html,
    });

    $app.newMailClient().send(message);

    // dev stdout : la liste BCC s'y lit en clair
    var recipientsLog = bcc.length > 0 ? bcc.join(", ") + " (bcc)" : toAddress;
    console.log("[" + senderName + "] Email envoye a " + recipientsLog);
    return { ok: true };
  } catch (err) {
    $app
      .logger()
      .error(
        "Email send failed",
        "sender",
        senderName,
        "to",
        toAddress,
        "bccCount",
        String(bcc.length),
        "error",
        String(err),
      );
    return { ok: false, error: String(err) };
  }
}

/**
 * Envoie un batch d'emails en regroupant les contenus identiques : un
 * couple (sujet, html) = une seule expédition SMTP, tous ses destinataires
 * en copie cachée. Un échec d'expédition marque tout son groupe ; les
 * résultats restent donnés par destinataire.
 *
 * @param {Array<{ to: string, subject: string, html: string }>} emails
 * @param {string} [senderName] - Nom pour le logging
 * @returns {Array<{ to: string, ok: boolean, error?: string }>}
 */
function sendBatch(emails, senderName) {
  var results = [];
  var okCount = 0;
  var failCount = 0;

  // Regroupe par contenu : les emails d'un même événement partagent sujet
  // et html (contenu relu côté serveur) → une seule expédition par groupe.
  var groups = [];
  var byContent = {};
  for (var i = 0; i < emails.length; i++) {
    var opts = emails[i];
    var key = opts.subject + "\u0000" + opts.html;
    if (!byContent[key]) {
      byContent[key] = {
        subject: opts.subject,
        html: opts.html,
        recipients: [],
      };
      groups.push(byContent[key]);
    }
    byContent[key].recipients.push(opts.to);
  }

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    var result = sendEmail({
      to: "",
      bcc: group.recipients,
      subject: group.subject,
      html: group.html,
      senderName: senderName || "send-batch",
    });

    for (var r = 0; r < group.recipients.length; r++) {
      results.push({
        to: group.recipients[r],
        ok: result.ok,
        error: result.error || undefined,
      });
    }

    if (result.ok) {
      okCount += group.recipients.length;
    } else {
      failCount += group.recipients.length;
    }
  }

  $app
    .logger()
    .info(
      "Batch email complete",
      "sender",
      senderName || "send-batch",
      "expeditions",
      String(groups.length),
      "ok",
      String(okCount),
      "failed",
      String(failCount),
      "total",
      String(emails.length),
    );

  return results;
}

// CommonJS export
module.exports = {
  getSenderAddress: getSenderAddress,
  sendEmail: sendEmail,
  sendBatch: sendBatch,
};
