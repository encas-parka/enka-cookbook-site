/**
 * Service pour les appels aux fonctions cloud Appwrite
 */

import { getAppwriteInstances, getAppwriteConfig } from "./appwrite";
import { safeOperation, safeJsonParse } from "$lib/utils/safe-operation";

const { APPWRITE_CONFIG } = getAppwriteConfig();

/**
 * Retire une team d'un événement
 */
export async function removeTeamFromEvent(
  eventId: string,
  teamId: string,
): Promise<void> {
  return safeOperation(
    async () => {
      const { functions } = await getAppwriteInstances();

      const response = await functions.createExecution({
        functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
        body: JSON.stringify({
          action: "remove-user-from-event",
          mainId: eventId,
          teamId: teamId,
        }),
        async: false,
      });

      const result = safeJsonParse<any>(response.responseBody, {
        context: "removeTeamFromEvent",
        fallback: null,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || "Erreur lors du retrait de la team");
      }

      console.log(
        `[appwrite-functions] Team ${teamId} retirée de l'événement ${eventId}`,
      );
    },
    {
      context: "AppwriteFunctions.removeTeamFromEvent",
      timeout: 60000,
      errorMessage: "Erreur lors du retrait de la team",
    },
  );
}

/**
 * Vérifie si des emails existent dans Appwrite
 * @returns Record<email, { id, name } | false>
 */
export async function checkUserEmails(
  emails: string[],
): Promise<Record<string, { id: string; name: string } | false>> {
  return safeOperation(
    async () => {
      const { functions } = await getAppwriteInstances();

      const response = await functions.createExecution({
        functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
        body: JSON.stringify({
          action: "checkEmails",
          emails,
        }),
        async: false,
      });

      // ✅ Parsing sécurisé
      const result = safeJsonParse<any>(response.responseBody, {
        context: "checkUserEmails",
        fallback: null,
      });

      if (!result || !result.success) {
        throw new Error(
          result?.error || "Erreur lors de la vérification des emails",
        );
      }

      return result.data;
    },
    {
      context: "AppwriteFunctions.checkUserEmails",
      timeout: 15000, // 15s pour une cloud function
      errorMessage: "Erreur lors de la vérification des emails",
    },
  );
}

/**
 * Invite des participants (teams et/ou utilisateurs) à un événement
 * Fonction unifiée avec contrôle des emails aux membres existants
 *
 * @param eventId - ID de l'événement
 * @param eventName - Nom de l'événement
 * @param options - Options d'invitation
 *   @param options.teamIds - IDs des teams à inviter
 *   @param options.emails - Emails des utilisateurs à inviter
 *   @param options.userIds - IDs des utilisateurs à inviter
 *   @param options.message - Message personnalisé (optionnel)
 *   @param options.sendEmailToExistingMembers - Envoyer un email aux membres existants (défaut: true)
 *
 * @returns { success: boolean, processed: number, emailResults?: any }
 */
export async function inviteParticipantsToEvent(
  eventId: string,
  eventName: string,
  options: {
    teamIds?: string[];
    emails?: string[];
    userIds?: string[];
    message?: string;
    sendEmailToExistingMembers?: boolean;
  },
): Promise<{ success: boolean; processed: number; emailResults?: any }> {
  const {
    teamIds = [],
    emails = [],
    userIds = [],
    message,
    sendEmailToExistingMembers = true,
  } = options;

  return safeOperation(
    async () => {
      const { functions } = await getAppwriteInstances();

      const response = await functions.createExecution({
        functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
        body: JSON.stringify({
          action: "invite",
          context: {
            type: "event",
            id: eventId,
            name: eventName,
          },
          teamIds,
          emails,
          userIds,
          message,
          sendEmailToExistingMembers,
        }),
        async: false,
      });

      const result = safeJsonParse<any>(response.responseBody, {
        context: "inviteParticipantsToEvent",
        fallback: null,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || "Erreur lors de l'invitation");
      }

      console.log(
        `[appwrite-functions] ${result.processed} invitations traitées pour ${eventName}`,
      );

      // ✅ Retourner le résultat détaillé
      return result;
    },
    {
      context: "AppwriteFunctions.inviteParticipantsToEvent",
      timeout: 60000, // 60s car batch update peut être long avec les teams
      errorMessage: "Erreur lors de l'invitation",
    },
  );
}

/**
 * Retire un utilisateur d'un événement (supprime son Label)
 * @param mainId - ID de l'événement (main)
 * @param userId - ID de l'utilisateur à retirer
 */
export async function removeUserFromEvent(
  mainId: string,
  userId: string,
): Promise<void> {
  return safeOperation(
    async () => {
      const { functions } = await getAppwriteInstances();

      const response = await functions.createExecution({
        functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
        body: JSON.stringify({
          action: "remove-user-from-event",
          mainId,
          userId,
        }),
        async: false,
      });

      const result = safeJsonParse<any>(response.responseBody, {
        context: "removeUserFromEvent",
        fallback: null,
      });

      if (!result || !result.success) {
        throw new Error(
          result?.error || "Erreur lors du retrait de l'utilisateur",
        );
      }

      console.log(
        `[appwrite-functions] Utilisateur ${userId} retiré de l'événement ${mainId}`,
      );
    },
    {
      context: "AppwriteFunctions.removeUserFromEvent",
      timeout: 10000,
      errorMessage: "Erreur lors du retrait de l'utilisateur",
    },
  );
}
