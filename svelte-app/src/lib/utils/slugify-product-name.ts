/**
 * Génère une clé sémantique pour un nouveau produit créé par l'utilisateur
 * Utilisé uniquement pour la création manuelle (les produits Hugo ont déjà leur clé dans le JSON)
 * @param productName - Le nom du produit à slugifier
 * @param uuid - L'UUID unique pour éviter les collisions
 * @returns Une clé sémantique de la forme "nom-du-produit_uuid"
 */
export function generateSemanticKey(productName: string, uuid: string): string {
  if (!productName || !uuid) {
    throw new Error(
      "productName et uuid sont requis pour générer une clé sémantique",
    );
  }

  // 1. Convertir en minuscules et normaliser les accents
  const slugged = productName
    .toLowerCase()
    .normalize("NFD") // Décomposer les caractères accentués
    .replace(/[\u0300-\u036f]/g, "") // Supprimer les diacritiques
    .trim();

  // 2. Remplacer les caractères non alphanumériques par des tirets
  const normalized = slugged
    .replace(/[^a-z0-9]+/g, "-") // Espaces et caractères spéciaux -> tirets
    .replace(/^-+|-+$/g, "") // Supprimer les tirets au début/fin
    .replace(/--+/g, "-"); // Éviter les tirets multiples

  // 3. S'assurer qu'on n'a pas une chaîne vide après slugification
  const safeName = normalized || "produit";

  // 4. Combiner avec l'UUID pour garantir l'unicité
  return `${safeName}_${uuid}`;
}

/**
 * Extrait le nom du produit lisible à partir d'une clé sémantique
 * @param semanticKey - La clé sémantique (ex: "patates-douces_abc123")
 * @returns Le nom du produit slugifié (ex: "patates-douces")
 */
export function extractSlugFromKey(semanticKey: string): string {
  const lastUnderscoreIndex = semanticKey.lastIndexOf("_");
  if (lastUnderscoreIndex === -1) {
    return semanticKey;
  }
  return semanticKey.substring(0, lastUnderscoreIndex);
}

/**
 * Fonction utilitaire pour tester si une clé utilise le nouveau format sémantique
 * @param key - La clé à tester
 * @returns true si la clé semble utiliser le format sémantique
 */
export function isSemanticKey(key: string): boolean {
  // Les clés sémantiques contiennent des tirets et se terminent par un UUID
  const semanticPattern = /^[a-z0-9-]+_[a-f0-9-]{36}$/i;
  return semanticPattern.test(key);
}

/**
 * Convertit un slugifié en nom lisible pour l'affichage
 * @param slug - Le slugifié (ex: "patates-douces")
 * @returns Le nom formaté pour l'affichage (ex: "Patates douces")
 */
export function formatSlugForDisplay(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
