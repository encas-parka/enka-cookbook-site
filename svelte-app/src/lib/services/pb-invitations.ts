/**
 * Services pour la gestion des invitations — PocketBase
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
 * Retourne le lien actif de l'événement, en créant un s'il n'en possède pas.
 * Chaque événement porte son lien dès la création — ce service est le point
 * de passage unique de cette garantie.
 *
 * @returns { id, created } — created distingue la création effective d'une
 *          simple lecture (telemetry d'usage, pas de différence de contrat).
 */
export async function getOrCreateShareLink(
  eventId: string,
  createdBy: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await getEventShareLinks(eventId);
  if (existing.length > 0) {
    return { id: existing[0], created: false };
  }
  const link = await createShareLink(eventId, createdBy);
  return { id: link.id, created: true };
}

/**
 * Régénère le lien : désactive tous les liens actifs de l'événement puis en
 * crée un neuf — remède au cas de lien divulgué (les usages passés du lien
 * précédent ne sont pas rappelés).
 */
export async function regenerateShareLink(
  eventId: string,
  createdBy: string,
): Promise<{ id: string }> {
  const active = await getEventShareLinks(eventId);
  for (const linkId of active) {
    await deactivateShareLink(linkId);
  }
  return createShareLink(eventId, createdBy);
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
export async function getEventShareLinks(eventId: string): Promise<string[]> {
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
