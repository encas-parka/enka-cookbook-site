/**
 * Templates d'emails PocketBase — modules partagés pour les hooks JSVM.
 *
 * Chaque fonction exportée DOIT être appelée depuis l'intérieur d'un handler
 * (hook ou route), car les handlers JSVM sont isolés dans leur propre scope
 * (cf. docs PocketBase "Caveats and limitations").
 *
 * @usage (depuis un handler .pb.js) :
 *   var emailTemplates = require(__hooks + "/lib/email-templates.js");
 *   var html = emailTemplates.buildInvitationEmail(...);
 */

/**
 * Construit le HTML pour le template "invitation_to_event".
 *
 * @param {string} inviterName - Nom de la personne qui invite
 * @param {string} eventName - Titre de l'événement
 * @param {string} eventDescription - Description (optionnelle, peut etre "")
 * @param {string} dateStart - Date de debut
 * @param {string} dateEnd - Date de fin (si differente du debut)
 * @param {string} shareLinkId - ID du share_link
 * @returns {string} HTML complet de l'email
 */
function buildInvitationEmail(inviterName, eventName, eventDescription, dateStart, dateEnd, shareLinkId) {
  var descriptionHtml = "";
  if (eventDescription) {
    descriptionHtml =
      '<p style="color:#555;font-size:15px;margin:16px 0;">' +
      escapeHtml(eventDescription) +
      "</p>";
  }

  var datesHtml = "";
  if (dateEnd && dateEnd !== dateStart) {
    datesHtml =
      '<p style="color:#555;font-size:15px;margin:12px 0;">' +
      "<strong>Du </strong>" +
      escapeHtml(dateStart) +
      " <strong>au</strong> " +
      escapeHtml(dateEnd) +
      "</p>";
  } else {
    datesHtml =
      '<p style="color:#555;font-size:15px;margin:12px 0;">' +
      "<strong>Le </strong>" +
      escapeHtml(dateStart) +
      "</p>";
  }

  var baseUrl = $os.getenv("ENKA_BASE_URL") || "https://enka-cookbook.app";
  var joinUrl = baseUrl + "/join/" + shareLinkId;

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">' +
    '<h2 style="color:#2d3748;margin-bottom:8px;">' +
    escapeHtml(inviterName) +
    " vous invite à l'événement :</h2>" +
    '<h1 style="color:#1a365d;font-size:24px;margin-top:0;">' +
    escapeHtml(eventName) +
    "</h1>" +
    datesHtml +
    descriptionHtml +
    '<div style="margin:32px 0;">' +
    '<a href="' +
    joinUrl +
    '" style="background-color:#4299e1;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;">' +
    "Voir l'événement</a>" +
    "</div>" +
    '<p style="color:#a0aec0;font-size:13px;margin-top:32px;">' +
    "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>" +
    '<a href="' + joinUrl + '" style="color:#4299e1;">' + joinUrl + "</a>" +
    "</p>" +
    "</div>";

  return html;
}

/**
 * Construit le HTML pour le template "invitation_to_team".
 *
 * Deux variantes :
 *   - Si hasAccount=true : "Vous avez été ajouté à l'équipe X"
 *   - Si hasAccount=false : "Créez un compte pour rejoindre l'équipe X"
 *
 * @param {string} inviterName - Nom de la personne qui invite
 * @param {string} teamName - Nom de l'équipe
 * @param {string} teamDescription - Description (optionnelle, peut etre "")
 * @param {boolean} hasAccount - Si le destinataire a déjà un compte
 * @returns {string} HTML complet de l'email
 */
function buildTeamInvitationEmail(inviterName, teamName, teamDescription, hasAccount) {
  var descriptionHtml = "";
  if (teamDescription) {
    descriptionHtml =
      '<p style="color:#555;font-size:15px;margin:16px 0;">' +
      escapeHtml(teamDescription) +
      "</p>";
  }

  var baseUrl = $os.getenv("ENKA_BASE_URL") || "https://enka-cookbook.app";

  var heading, bodyText, ctaText, ctaUrl;

  if (hasAccount) {
    heading = escapeHtml(inviterName) + " vous a ajout\u00e9 \u00e0 l'\u00e9quipe :";
    bodyText =
      '<p style="color:#555;font-size:15px;margin:16px 0;">' +
      "Vous faites maintenant partie de cette \u00e9quipe. Connectez-vous pour voir les \u00e9v\u00e9nements et documents partag\u00e9s." +
      "</p>";
    ctaText = "Voir mes \u00e9quipes";
    ctaUrl = baseUrl + "/dashboard";
  } else {
    heading = escapeHtml(inviterName) + " vous invite \u00e0 rejoindre l'\u00e9quipe :";
    bodyText =
      '<p style="color:#555;font-size:15px;margin:16px 0;">' +
      "Pour rejoindre cette \u00e9quipe, vous devez cr\u00e9er un compte enka-cookbook. " +
      "C'est gratuit et rapide !" +
      "</p>";
    ctaText = "Cr\u00e9er mon compte";
    ctaUrl = baseUrl + "/register";
  }

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">' +
    '<h2 style="color:#2d3748;margin-bottom:8px;">' +
    heading +
    "</h2>" +
    '<h1 style="color:#1a365d;font-size:24px;margin-top:0;">' +
    escapeHtml(teamName) +
    "</h1>" +
    descriptionHtml +
    bodyText +
    '<div style="margin:32px 0;">' +
    '<a href="' +
    ctaUrl +
    '" style="background-color:#4299e1;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;">' +
    ctaText +
    "</a>" +
    "</div>" +
    '<p style="color:#a0aec0;font-size:13px;margin-top:32px;">' +
    "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>" +
    '<a href="' + ctaUrl + '" style="color:#4299e1;">' + ctaUrl + "</a>" +
    "</p>" +
    "</div>";

  return html;
}

/**
 * Echappe les caracteres HTML speciaux pour eviter les injections.
 */
function escapeHtml(str) {
  if (typeof str !== "string") str = String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// CommonJS export
module.exports = {
  buildInvitationEmail: buildInvitationEmail,
  buildTeamInvitationEmail: buildTeamInvitationEmail,
  escapeHtml: escapeHtml,
};
