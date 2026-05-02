/**
 * Services pour la gestion des invitations — PocketBase
 *
 * Remplace appwrite-invitations.ts.
 *
 * createShareLink : CRUD direct sur la collection share_links
 * redeemShareLink : appelle la route custom PB /api/enka/join-event
 *                   (le hook server-side ajoute l'email dans guestEmails[])
 */

import { pb } from "$lib/db-sync/pb-sync";

/**
 * Génère un share link pour un événement.
 * Le lien est multi-utilisateurs : il reste actif tant que isActive = true.
 *
 * @param eventId - ID de l'événement
 * @param createdBy - userId du créateur du lien
 * @returns { id: string } — l'ID du share_link (= linkId dans l'URL /join/:linkId)
 */
export async function createShareLink(
  eventId: string,
  createdBy: string,
): Promise<{ id: string }> {
  const record = await pb.collection("share_links").create({
    target_id: eventId,
    link_type: "event",
    isActive: true,
    token: "", // pas besoin de token — l'ID du record sert de token
    createdBy,
  });

  return { id: record.id };
}

/**
 * Utilise un share link pour rejoindre un événement.
 * Appelle la route custom PB qui ajoute l'email dans guestEmails[] côté serveur.
 *
 * @param linkId - ID du share_link (= UUID dans l'URL /join/:linkId)
 * @param _userId - ID de l'utilisateur courant (inutilisé — PB lit e.auth)
 * @returns { eventId: string }
 */
export async function redeemShareLink(
  linkId: string,
  _userId: string,
): Promise<{ eventId: string }> {
  const result = await pb.send("/api/enka/join-event", {
    method: "POST",
    body: { linkId },
  });

  return { eventId: result.eventId };
}

/**
 * Récupère les share links d'un événement.
 */
export async function getEventShareLinks(
  eventId: string,
): Promise<string[]> {
  const links = await pb.collection("share_links").getFullList({
    filter: pb.filter("target_id = {:eventId} && isActive = true", {
      eventId,
    }),
    sort: "-created",
  });

  return links.map((l) => l.id);
}

/**
 * Désactive un share link.
 */
export async function deactivateShareLink(linkId: string): Promise<void> {
  await pb.collection("share_links").update(linkId, { isActive: false });
}
