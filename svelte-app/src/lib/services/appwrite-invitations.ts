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
 * Valide une invitation de team native et récupère un token de session
 * Utilisé dans le workflow d'invitation par email (AcceptInvite.svelte)
 *
 * La vérification se fait via:
 * - Vérifier que l'utilisateur a une membership dans la team (non-bloquant)
 *
 * NOTE: Cette fonction utilise la Cloud Function 'invitation' avec le scope 'any'
 * pour pouvoir être appelée par des utilisateurs non connectés.
 *
 * IMPORTANT: L'utilisateur peut finaliser son compte même si la membership a été
 * révoquée. Le champ membershipRevoked est informatif seulement.
 *
 * @param userId - ID de l'utilisateur
 * @param teamId - ID de la team native
 * @returns Token de session Appwrite + infos sur la membership
 */
export async function validateInvitation(
  userId: string,
  teamId: string,
): Promise<{
  token: string;
  userId: string;
  hasMembership: boolean;
  membershipRevoked: boolean;
  teamName: string | null;
}> {
  try {
    const { functions } = await getAppwriteInstances();

    const response = await functions.createExecution({
      functionId: APPWRITE_CONFIG.functions.invitation,
      body: JSON.stringify({
        action: "exchange-invite",
        userId,
        teamId,
      }),
    });

    const result = JSON.parse(response.responseBody);

    if (!result.success) {
      throw new Error(result.error || "L'invitation est invalide.");
    }

    return {
      token: result.token,
      userId: result.userId,
      hasMembership: result.hasMembership || false,
      membershipRevoked: result.membershipRevoked || false,
      teamName: result.teamName || null,
    };
  } catch (error) {
    console.error("[invitations] Error validating invitation:", error);
    throw error;
  }
}
