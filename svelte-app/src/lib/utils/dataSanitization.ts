/**
 * Utilitaires pour la sanitization des données
 * Fonctions pures pour nettoyer et transformer les données
 */

import type { Purchases } from '$lib/types/appwrite';

/**
 * Nettoie un purchase pour éviter la récursion infinie dans le cache
 * Transforme les objets products complets en leurs IDs seulement
 */
export function sanitizePurchase(purchase: Purchases): Purchases {
  return {
    ...purchase,
    products:
      purchase.products?.map((prod: any) =>
        typeof prod === "string" ? prod : prod.$id,
      ) || [],
    mainId: purchase.mainId, // Garder le type original (Main ou string selon ce qu'Appwrite envoie)
  };
}

/**
 * Nettoie un tableau de purchases
 */
export function sanitizePurchases(purchases: Purchases[]): Purchases[] {
  return purchases.map(purchase => sanitizePurchase(purchase));
}
