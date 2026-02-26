/**
 * Utilitaires pour la gestion des slug-uuid
 * Format: <slug_22>_<uuid_12> = 35 caractères max
 */

import { nanoid } from "nanoid";

/**
 * Génère un slug-uuid de 35 caractères à partir d'un titre et d'une version optionnelle
 * @param title - Titre de la recette
 * @param versionLabel - Label de version optionnel (ex: "v2-geo")
 * @returns slug-uuid de 35 caractères max
 *
 * @example
 * generateSlugUuid35("Houmous maison") // "houmous-maison_abc123def456"
 * generateSlugUuid35("Houmous maison", "v2-geo") // "houmous-maison-v2_ghi789jkl012"
 */
export function generateSlugUuid35(
  title: string,
  versionLabel?: string,
): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const versionSlug = versionLabel
    ? versionLabel
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

  let slugPart: string;

  if (versionSlug) {
    // Avec version : 16 chars title + 1 separator + 5 chars version = 22 max
    const titlePart = slug.slice(0, 16);
    const versionPart = versionSlug.slice(0, 5);
    slugPart = `${titlePart}-${versionPart}`;
  } else {
    // Sans version : title jusqu'à 22 chars
    slugPart = slug.slice(0, 22);
  }

  return `${slugPart}_${nanoid(12).toLowerCase()}`;
}
