/**
 * Hook : resync evenements quand une team est modifiee.
 *
 * Quand les membres d'une team changent (ajout/retrait), ce hook envoie
 * un message SSE custom aux membres concernes pour qu'ils rafraichissent
 * leur cache EventsStore.
 *
 * Messages envoyes :
 *   - Nouveaux membres : { action: "team_joined", teamId, teamName }
 *   - Membres retires  : { action: "team_left", teamId, teamName }
 *   - Membres existants (si nom/description change) : { action: "team_updated", teamId }
 *
 * @see svelte-app/src/lib/stores/GlobalState.svelte.ts — abonnement cote client
 */

/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateSuccess(function (e) {
  var team = e.record;
  var teamId = team.id;
  var teamName = team.getString("name") || "";

  // --- Comparer les membres avant/apres ---
  var newMembers = team.getStringSlice("members") || [];
  // e.record.originalCopy() contient l'etat avant modification
  var original = team.originalCopy();
  var oldMembers = (original && original.getStringSlice("members")) || [];

  // Identifier les ajouts et retraits
  var addedUserIds = [];
  var removedUserIds = [];

  for (var i = 0; i < newMembers.length; i++) {
    if (oldMembers.indexOf(newMembers[i]) === -1) {
      addedUserIds.push(newMembers[i]);
    }
  }
  for (var j = 0; j < oldMembers.length; j++) {
    if (newMembers.indexOf(oldMembers[j]) === -1) {
      removedUserIds.push(oldMembers[j]);
    }
  }

  // Verifier si le nom ou la description a change (pour les membres existants)
  var nameChanged = false;
  if (original) {
    nameChanged = team.getString("name") !== original.getString("name");
  }

  // --- Envoyer les messages SSE custom ---
  var broker = $app.subscriptionsBroker();
  var clients = broker.clients();
  var hasNotifications = addedUserIds.length > 0 || removedUserIds.length > 0 || nameChanged;

  if (!hasNotifications) {
    e.next();
    return;
  }

  var sentCount = 0;

  for (var clientId in clients) {
    var client = clients[clientId];
    var auth = client.get("auth");
    if (!auth) continue;

    var userId = auth.id;
    var topic = "user_" + userId;

    if (!client.hasSubscription(topic)) continue;

    var msgData = null;

    // Nouveau membre → team_joined
    if (addedUserIds.indexOf(userId) !== -1) {
      msgData = JSON.stringify({
        action: "team_joined",
        teamId: teamId,
        teamName: teamName
      });
    }
    // Membre retire → team_left
    else if (removedUserIds.indexOf(userId) !== -1) {
      msgData = JSON.stringify({
        action: "team_left",
        teamId: teamId,
        teamName: teamName
      });
    }
    // Membre existant et team renommee → team_updated
    else if (nameChanged && newMembers.indexOf(userId) !== -1) {
      msgData = JSON.stringify({
        action: "team_updated",
        teamId: teamId,
        teamName: teamName
      });
    }

    if (msgData) {
      client.send(new SubscriptionMessage({
        name: topic,
        data: msgData
      }));
      sentCount++;
    }
  }

  if (sentCount > 0) {
    console.log("[teams-resync] Team " + teamId + " : " + sentCount + " notification(s) envoyee(s)"
      + " (+" + addedUserIds.length + " membres, -" + removedUserIds.length + " retires)");
  }

  e.next();
}, "teams");
