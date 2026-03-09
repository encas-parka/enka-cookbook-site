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
 * Valide une invitation (team native OU event) et récupère un token de session
 * Utilisé dans le workflow d'invitation par email (AcceptInvite.svelte)
 *
 * La vérification se fait via:
 * - Team native : Vérifier que l'utilisateur a une membership dans la team
 * - Event : Vérifier/Rajouter le label eventId et les contributors[] (défensif)
 *
 * NOTE: Cette fonction utilise la Cloud Function 'invitation' avec le scope 'any'
 * pour pouvoir être appelée par des utilisateurs non connectés.
 *
 * IMPORTANT: L'utilisateur peut finaliser son compte même si la membership a été
 * révoquée. Le champ accessRevoked est informatif seulement.
 *
 * @param userId - ID de l'utilisateur
 * @param teamId - ID de la team native (optionnel)
 * @param eventId - ID de l'event (optionnel)
 * @returns Token de session Appwrite + infos sur l'invitation
 */
export async function validateInvitation(
  userId: string,
  teamId?: string,
  eventId?: string,
): Promise<{
  token: string;
  userId: string;
  hasAccess: boolean;
  accessRevoked: boolean;
  contextName: string | null;
}> {
  try {
    const { functions } = await getAppwriteInstances();

    // Déterminer l'action selon le paramètre fourni
    const action = teamId ? "exchange-invite" : "exchange-event-invite";

    const payload: any = {
      action,
      userId,
    };

    if (teamId) payload.teamId = teamId;
    if (eventId) payload.eventId = eventId;

    const response = await functions.createExecution({
      functionId: APPWRITE_CONFIG.functions.invitation,
      body: JSON.stringify(payload),
    });

    const result = JSON.parse(response.responseBody);

    if (!result.success) {
      throw new Error(result.error || "L'invitation est invalide.");
    }

    return {
      token: result.token,
      userId: result.userId,
      hasAccess: result.hasAccess ?? result.hasMembership ?? false,
      accessRevoked: result.accessRevoked ?? result.membershipRevoked ?? false,
      contextName: result.contextName ?? result.teamName ?? null,
    };
  } catch (error) {
    console.error("[invitations] Error validating invitation:", error);
    throw error;
  }
}

/**
 * Génère un magic link de partage pour un event
 * Appelle la CF users_tems_manager avec action "create-share-link"
 *
 * @param eventId - ID de l'event (= label Appwrite)
 * @param createdBy - userId du participant qui génère le lien
 * @returns { id: string, url: string }
 */
export async function createShareLink(
  eventId: string,
  createdBy: string,
): Promise<{ id: string; url: string }> {
  const { functions } = await getAppwriteInstances();

  const response = await functions.createExecution({
    functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
    body: JSON.stringify({
      action: "create-share-link",
      eventId,
      createdBy,
    }),
  });

  const result = JSON.parse(response.responseBody);

  if (!result.success) {
    throw new Error(result.error || "Erreur lors de la création du lien.");
  }

  return { id: result.id, url: result.url };
}

/**
 * Utilise un magic link pour obtenir l'accès à un event
 * Appelle la CF users_tems_manager avec action "redeem-share-link"
 * La CF attribue le label et ajoute l'user dans contributors (status "invited")
 *
 * @param linkId - $id du document share_links (= UUID dans l'URL /join/:linkId)
 * @param userId - ID de l'user courant authentifié
 * @returns { eventId: string }
 */
export async function redeemShareLink(
  linkId: string,
  userId: string,
): Promise<{ eventId: string }> {
  const { functions } = await getAppwriteInstances();

  const response = await functions.createExecution({
    functionId: APPWRITE_CONFIG.functions.usersTeamsManager,
    body: JSON.stringify({
      action: "redeem-share-link",
      linkId,
      userId,
    }),
  });

  const result = JSON.parse(response.responseBody);

  if (!result.success) {
    throw new Error(result.error || "Lien d'invitation invalide ou expiré.");
  }

  return { eventId: result.eventId };
}
