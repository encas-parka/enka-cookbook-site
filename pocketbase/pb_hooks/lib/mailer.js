/**
 * Mailer utility — agnostique d'envoi d'emails.
 *
 * Wrappe $app.newMailClient().send() avec :
 *   - Vérification de la config SMTP
 *   - Logging standardisé
 *   - Gestion d'erreur par email (un échec ne bloque pas les autres)
 *
 * @usage (depuis un handler .pb.js) :
 *   var mailer = require(__hooks + "/lib/mailer.js");
 *   var result = mailer.sendEmail({
 *     to: "user@example.com",
 *     subject: "Bienvenue",
 *     html: "<h1>Hello</h1>"
 *   });
 *
 * // Envoi batch (retourne les résultats individuels) :
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
      "SMTP non configure. Configurez l'expediteur dans les parametres PocketBase."
    );
  }
  return senderAddress;
}

/**
 * Envoie un seul email.
 *
 * @param {Object} opts
 * @param {string} opts.to - Adresse du destinataire
 * @param {string} opts.subject - Sujet de l'email
 * @param {string} opts.html - Corps HTML de l'email
 * @param {string} [opts.from] - Adresse d'expédition (défaut: config PB)
 * @param {string} [opts.senderName] - Nom pour le logging
 * @returns {{ ok: boolean, error?: string }}
 */
function sendEmail(opts) {
  var to = opts.to || "";
  var subject = opts.subject || "";
  var html = opts.html || "";
  var senderName = opts.senderName || "send-emails";

  if (!to) {
    return { ok: false, error: "Adresse destinataire manquante" };
  }

  if (!subject) {
    return { ok: false, error: "Sujet manquant" };
  }

  var from = opts.from || getSenderAddress();

  try {
    var message = new MailerMessage({
      from: { address: from },
      to: [{ address: to }],
      subject: subject,
      html: html
    });

    $app.newMailClient().send(message);

    console.log("[" + senderName + "] Email envoye a " + to);
    return { ok: true };
  } catch (err) {
    console.error("[" + senderName + "] Erreur d'envoi a " + to + ": " + String(err));
    return { ok: false, error: String(err) };
  }
}

/**
 * Envoie un batch d'emails. Un échec individuel ne bloque pas les autres.
 *
 * @param {Array<{ to: string, subject: string, html: string }>} emails
 * @param {string} [senderName] - Nom pour le logging
 * @returns {Array<{ to: string, ok: boolean, error?: string }>}
 */
function sendBatch(emails, senderName) {
  var results = [];
  var okCount = 0;
  var failCount = 0;

  for (var i = 0; i < emails.length; i++) {
    var opts = emails[i];
    var result = sendEmail({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      senderName: senderName || "send-batch"
    });

    results.push({
      to: opts.to,
      ok: result.ok,
      error: result.error || undefined
    });

    if (result.ok) {
      okCount++;
    } else {
      failCount++;
    }
  }

  console.log(
    "[" + (senderName || "send-batch") + "] Termine: " +
    okCount + " ok, " + failCount + " echec(s) sur " +
    emails.length + " destinataire(s)"
  );

  return results;
}

// CommonJS export
module.exports = {
  getSenderAddress: getSenderAddress,
  sendEmail: sendEmail,
  sendBatch: sendBatch,
};
