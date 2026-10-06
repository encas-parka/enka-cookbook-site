/**
 * Services de lookup utilisateur — PocketBase
 *
 * lookupUserByEmail : route custom GET /api/enka/lookup-user (match exact).
 * L'API standard users.getList est bloquée par la listRule users
 * (`id = @request.auth.id`) — cette route serveur est le seul chemin.
 */

import { pb } from "$lib/db-sync/pb-sync";

export interface LookupUser {
  id: string;
  name: string;
}

/**
 * Résout un email vers un utilisateur PocketBase.
 *
 * @returns l'utilisateur, ou null si aucun compte n'existe (404 attendu)
 * @throws sur erreur réseau/serveur autre que 404
 */
export async function lookupUserByEmail(
  email: string,
): Promise<LookupUser | null> {
  try {
    return await pb.send<LookupUser>("/api/enka/lookup-user", {
      method: "GET",
      query: { email },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Résout un lot d'emails en parallèle.
 * Les introuvables (null) et les erreurs unitaires sont exclus du résultat —
 * l'appelant applique son fallback sur les emails absents de la Map.
 */
export async function lookupUsersByEmails(
  emails: string[],
): Promise<Map<string, LookupUser>> {
  const settled = await Promise.all(
    emails.map(async (email) => {
      const key = email.toLowerCase();
      try {
        return [key, await lookupUserByEmail(email)] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );

  const resolved = new Map<string, LookupUser>();
  for (const [key, user] of settled) {
    if (user) {
      resolved.set(key, user);
    }
  }
  return resolved;
}
