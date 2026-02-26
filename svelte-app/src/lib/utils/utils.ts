/**
 * Fonctions utilitaires pour la gestion des URLs et des paramètres
 */

/**
 * Récupère le mainId depuis les paramètres de l'URL
 * @param fallbackId - ID par défaut si aucun paramètre trouvé
 * @returns Le mainId extrait de l'URL ou l'ID par défaut
 */
export function getMainIdFromUrl(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "getMainIdFromUrl() appelé côté serveur - SSR non supporté",
    );
  }

  const urlParams = new URLSearchParams(window.location.search);
  const listIdFromUrl = urlParams.get("listId");

  if (!listIdFromUrl || !listIdFromUrl.trim()) {
    throw new Error(
      "Paramètre 'listId' manquant ou vide dans l'URL. Format attendu : ?listId=votre-event-id",
    );
  }

  return listIdFromUrl.trim();
}

/**
 * Transforme listId en mainId formaté (4 premiers + _ + 10 derniers)
 * @param listId - Identifiant original depuis l'URL
 * @returns mainId formaté pour Appwrite/IndexedDB
 */
export function transformListIdToMainId(listId: string): string {
  const prefix = listId.substring(0, 4);
  const suffix = listId.slice(-10);
  return `${prefix}_${suffix}`;
}

/**
 * Génère une clé de stockage persistant avec le mainId inclus
 * @param baseKey - Clé de base
 * @param mainId - Identifiant principal
 * @returns Clé de stockage avec mainId inclus
 */
export function createStorageKey(baseKey: string, mainId: string): string {
  return `${baseKey}_${mainId}`;
}


/**
 * Vérifie si une adresse email est valide
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}