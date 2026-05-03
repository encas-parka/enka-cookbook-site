/// <reference path="../pb_data/types.d.ts" />

// ==============================================================================
// Route custom : POST /api/enka/invite-to-team
//
// Invitation par email a une equipe.
// Pour chaque email :
//   - Si l'utilisateur existe dans PB → ajout direct dans team.members[] + role "member"
//   - Si l'utilisateur n'existe pas → email d'invitation avec lien creation de compte
//   - Si deja membre → skip
//
// Body : {
//   teamId: string,
//   emails: string[]
// }
//
// Reponse : {
//   success: true,
//   results: [{ email: string, ok: boolean, action: "added"|"invited"|"already_member"|"skipped", error?: string }]
// }
// ==============================================================================

routerAdd("POST", "/api/enka/invite-to-team", function(e) {
  // --- Auth check ---
  if (!e.auth) {
    throw new UnauthorizedError("Authentification requise");
  }

  // --- Lire le body ---
  var body = e.requestInfo().body;
  if (!body) {
    throw new BadRequestError("Body requis");
  }

  var teamId = body.teamId || "";
  var emails = body.emails || [];

  // --- Validation ---
  if (!teamId) {
    throw new BadRequestError("teamId requis");
  }

  if (!emails.length) {
    throw new BadRequestError("Au moins un email requis");
  }

  // --- Verifier que la team existe ---
  var team;
  try {
    team = $app.findRecordById("teams", teamId);
  } catch (err) {
    throw new NotFoundError("Equipe introuvable");
  }

  // Verifier que l'utilisateur est membre de la team (droit d'inviter)
  var currentMembers = team.get("members") || [];
  var memberArray = Array.isArray(currentMembers) ? currentMembers : [];
  var inviterId = e.auth.id;

  if (memberArray.indexOf(inviterId) === -1) {
    throw new ForbiddenError("Vous n'etes pas membre de cette equipe");
  }

  var inviterName = e.auth.getString("name") || e.auth.getString("email") || "Quelqu'un";
  var teamName = team.getString("name") || "Equipe";
  var teamDescription = team.getString("description") || "";

  // --- Charger les modules (DOIT etre DANS le handler) ---
  var mailer = require(__hooks + "/lib/mailer.js");
  var emailTemplates = require(__hooks + "/lib/email-templates.js");

  // Vérifier la config SMTP via le mailer (throw si pas configuré)
  mailer.getSenderAddress();

  // --- Traiter chaque email : lookup + collecte ---
  var results = [];
  var addedUserIds = [];

  for (var i = 0; i < emails.length; i++) {
    var email = (emails[i] || "").trim().toLowerCase();
    if (!email) {
      results.push({ email: email, ok: false, action: "skipped", error: "Email vide" });
      continue;
    }

    // Chercher un user PB avec cet email
    var existingUser = null;
    try {
      existingUser = $app.findFirstRecordByFilter(
        "users",
        "email = {:email}",
        { email: email }
      );
    } catch (err) {
      // User non trouve → pas de compte
    }

    if (existingUser) {
      var userId = existingUser.id;
      if (memberArray.indexOf(userId) !== -1) {
        results.push({ email: email, ok: true, action: "already_member" });
      } else {
        addedUserIds.push(userId);
        results.push({ email: email, ok: true, action: "added" });
      }
    } else {
      results.push({ email: email, ok: true, action: "invited" });
    }
  }

  // --- Mise a jour atomique de la team ---
  if (addedUserIds.length > 0) {
    var updatedMembers = memberArray.concat(addedUserIds);
    var currentRoles = team.get("roles") || {};
    if (typeof currentRoles !== "object" || Array.isArray(currentRoles)) {
      currentRoles = {};
    }

    for (var j = 0; j < addedUserIds.length; j++) {
      currentRoles[addedUserIds[j]] = "member";
    }

    team.set("members", updatedMembers);
    team.set("roles", currentRoles);
    $app.save(team);

    $app.logger().info(
      "Members added to team",
      "count", String(addedUserIds.length),
      "teamId", teamId,
      "teamName", teamName
    );
  }

  // --- Envoyer les emails via le mailer agnostique ---
  var emailsToSend = [];

  for (var k = 0; k < results.length; k++) {
    var result = results[k];
    if (!result.ok || result.action === "already_member" || result.action === "skipped") {
      continue;
    }

    var hasAccount = result.action === "added";

    var html = emailTemplates.buildTeamInvitationEmail(
      inviterName,
      teamName,
      teamDescription,
      hasAccount
    );

    var subject;
    if (hasAccount) {
      subject = inviterName + " vous a ajoute a l'equipe : " + teamName;
    } else {
      subject = inviterName + " vous invite a rejoindre l'equipe : " + teamName;
    }

    emailsToSend.push({ to: result.email, subject: subject, html: html });
  }

  // Envoi batch via le mailer
  var sendResults = mailer.sendBatch(emailsToSend, "invite-to-team");

  // Mettre a jour les results avec les erreurs d'envoi
  var sendIdx = 0;
  for (var m = 0; m < results.length; m++) {
    if (results[m].ok && results[m].action !== "already_member" && results[m].action !== "skipped") {
      if (sendIdx < sendResults.length && !sendResults[sendIdx].ok) {
        results[m].ok = false;
        results[m].error = sendResults[sendIdx].error;
      }
      sendIdx++;
    }
  }

  // --- Reponse ---
  return e.json(200, { success: true, results: results });
}, $apis.requireAuth());
