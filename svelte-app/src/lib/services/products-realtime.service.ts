/**
 * Service de gestion des événements realtime pour les produits et achats
 *
 * Ce service gère :
 * - L'inscription aux channels realtime via RealtimeManager
 * - Le parsing des événements Appwrite
 * - Les notifications toast pour les autres utilisateurs
 * - Le dispatch vers les callbacks appropriés
 *
 * @usage
 * const unsubscribe = setupProductsRealtimeHandler(callbacks, options);
 * // Plus tard...
 * unsubscribe();
 */

import type { Products, Purchases } from "../types/appwrite.d";
import { realtimeManager } from "../stores/RealtimeManager.svelte";
import { toastService } from "./toast.service.svelte";
import { globalState } from "../stores/GlobalState.svelte";
import { getDatabaseId, getCollectionId } from "./appwrite";

// =============================================================================
// TYPES
// =============================================================================

export interface ProductsRealtimeCallbacks {
  onProductCreate: (product: Products) => void;
  onProductUpdate: (product: Products) => void;
  onProductDelete: (productId: string) => void;
  onPurchaseCreate: (purchase: Purchases) => void;
  onPurchaseUpdate: (purchase: Purchases) => void;
  onPurchaseDelete: (purchaseId: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export interface ProductsRealtimeOptions {
  /** Si true, affiche des toasts quand d'autres utilisateurs modifient des données */
  showOtherUserToasts?: boolean;
}

// =============================================================================
// HANDLER REALTIME
// =============================================================================

/**
 * Crée un handler pour les événements realtime Appwrite
 * Gère le parsing, les toasts et le dispatch vers les callbacks
 */
function createRealtimeEventHandler(
  callbacks: ProductsRealtimeCallbacks,
  options: ProductsRealtimeOptions = {}
) {
  const { showOtherUserToasts = true } = options;

  return (response: any) => {
    const { events, payload } = response;
    if (!payload) return;

    // Gérer les événements de connexion
    if (response.event === "client.connected") {
      callbacks.onConnect?.();
      return;
    }

    // Déterminer le type de collection et d'événement
    const isProductsCollection = events.some((e: string) =>
      e.includes("products.")
    );
    const isPurchasesCollection = events.some((e: string) =>
      e.includes("purchases.")
    );

    const isCreate = events.some((e: string) => e.includes(".create"));
    const isUpdate = events.some((e: string) => e.includes(".update"));
    const isDelete = events.some((e: string) => e.includes(".delete"));

    // Dispatcher vers les callbacks appropriés
    if (isProductsCollection) {
      handleProductEvent(
        payload as Products,
        { isCreate, isUpdate, isDelete },
        callbacks,
        showOtherUserToasts
      );
    } else if (isPurchasesCollection) {
      handlePurchaseEvent(
        payload as Purchases,
        { isCreate, isUpdate, isDelete },
        callbacks,
        showOtherUserToasts
      );
    }
  };
}

/**
 * Gère un événement sur la collection Products
 */
function handleProductEvent(
  product: Products,
  eventType: { isCreate: boolean; isUpdate: boolean; isDelete: boolean },
  callbacks: ProductsRealtimeCallbacks,
  showToasts: boolean
) {
  const { isCreate, isUpdate, isDelete } = eventType;

  // Toast notifications pour les autres utilisateurs
  if (showToasts && product.updatedBy && product.updatedBy !== globalState.userName) {
    if (isCreate || isUpdate) {
      toastService.info(
        `${product.updatedBy} a modifié le produit "${product.productName}"`,
        { source: "realtime-other" }
      );
    } else if (isDelete) {
      toastService.info(`${product.updatedBy} a supprimé un produit`, {
        source: "realtime-other",
      });
    }
  }

  // Dispatch vers les callbacks
  if (isCreate) {
    callbacks.onProductCreate(product);
  } else if (isUpdate) {
    callbacks.onProductUpdate(product);
  } else if (isDelete) {
    callbacks.onProductDelete(product.$id);
  }
}

/**
 * Gère un événement sur la collection Purchases
 */
function handlePurchaseEvent(
  purchase: Purchases,
  eventType: { isCreate: boolean; isUpdate: boolean; isDelete: boolean },
  callbacks: ProductsRealtimeCallbacks,
  showToasts: boolean
) {
  const { isCreate, isUpdate, isDelete } = eventType;

  // Toast notifications pour les autres utilisateurs
  if (showToasts && purchase.createdBy && purchase.createdBy !== globalState.userName) {
    const productName = "un produit"; // Message générique

    if (isCreate && purchase.who !== globalState.userName) {
      toastService.info(`${purchase.who} a ajouté un achat pour ${productName}`, {
        source: "realtime-other",
      });
    } else if (isUpdate && purchase.who !== globalState.userName) {
      toastService.info(`${purchase.who} a modifié un achat pour ${productName}`, {
        source: "realtime-other",
      });
    } else if (isDelete) {
      toastService.info(`${purchase.who} a supprimé un achat pour ${productName}`, {
        source: "realtime-other",
      });
    }
  }

  // Dispatch vers les callbacks
  if (isCreate) {
    callbacks.onPurchaseCreate(purchase);
  } else if (isUpdate) {
    callbacks.onPurchaseUpdate(purchase);
  } else if (isDelete) {
    callbacks.onPurchaseDelete(purchase.$id);
  }
}

// =============================================================================
// API PUBLIQUE
// =============================================================================

/**
 * Configure les abonnements realtime pour les produits et achats
 *
 * @param callbacks - Fonctions à appeler pour chaque type d'événement
 * @param options - Options de configuration
 * @returns Fonction de désinscription
 *
 * @example
 * const unsubscribe = setupProductsRealtimeHandler({
 *   onProductCreate: (product) => store.upsert(product),
 *   onProductUpdate: (product) => store.upsert(product),
 *   onProductDelete: (id) => store.delete(id),
 *   onPurchaseCreate: (purchase) => store.applyPurchase(purchase),
 *   onPurchaseUpdate: (purchase) => store.applyPurchase(purchase),
 *   onPurchaseDelete: (id) => store.removePurchase(id),
 * });
 */
export function setupProductsRealtimeHandler(
  callbacks: ProductsRealtimeCallbacks,
  options: ProductsRealtimeOptions = {}
): () => void {
  const DB_ID = getDatabaseId();
  const PRODUCTS_COLLECTION = getCollectionId("products");
  const PURCHASES_COLLECTION = getCollectionId("purchases");

  const channels = [
    `databases.${DB_ID}.collections.${PRODUCTS_COLLECTION}.documents`,
    `databases.${DB_ID}.collections.${PURCHASES_COLLECTION}.documents`,
  ];

  const handleRealtimeEvent = createRealtimeEventHandler(callbacks, options);

  // S'inscrire via RealtimeManager (inscription dynamique)
  const unsubscribe = realtimeManager.registerDynamic(channels, handleRealtimeEvent);

  console.log(
    `[ProductsRealtimeHandler] ✅ Realtime configuré (${channels.length} channels)`
  );

  return unsubscribe;
}
