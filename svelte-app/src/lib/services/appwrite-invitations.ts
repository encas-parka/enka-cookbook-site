/**
 * Services pour la gestion des invitations
 *
 * NOTE : Ce fichier contient la fonction validateInvitation utilisée
 * pour le workflow d'invitation par email. La validation se fait maintenant
 * via les Labels (events) ou les Memberships (teams) sans secret.
 */

import { getAppwriteInstances } from "./appwrite";
import { getAppwriteConfig } from "$lib/services/appwrite";

const APPWRITE_CONFIG = getAppwriteConfig().APPWRITE_CONFIG;

/**
 * Valide une invitation et récupère un token de session
 * Utilisé dans le workflow d'invitation par email (AcceptInvite.svelte)
 *
 * La vérification se fait via:
 * - Pour les EVENTS: vérifier que l'utilisateur a le Label de l'événement
 * - Pour les TEAMS: vérifier que l'utilisateur a une membership dans la team
 *
 * @param userId - ID de l'utilisateur
 * @param eventId - ID de l'événement (optionnel, si invitation à un event)
 * @param teamId - ID de la team native (optionnel, si invitation à une team)
 * @returns Token de session Appwrite
 */
export async function validateInvitation(
  userId: string,
  eventId?: string,
  teamId?: string,
): Promise<{ token: string; userId: string }> {
  try {
    const { functions } = await getAppwriteInstances();

    const response = await functions.createExecution({
      functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
      body: JSON.stringify({
        action: "exchange-invite",
        userId,
        eventId,
        teamId,
      }),
    });

    const result = JSON.parse(response.responseBody);

    if (!result.success) {
      throw new Error(result.error || "L'invitation est invalide.");
    }

    return { token: result.token, userId: result.userId };
  } catch (error) {
    console.error("[invitations] Error validating invitation:", error);
    throw error;
  }
}
