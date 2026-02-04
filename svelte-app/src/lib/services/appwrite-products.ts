/**
 * Services d'interaction avec Appwrite - Couche d'accès aux données pure
 *
 * Architecture du système :
 * ┌─────────────────────────────────────────────────────────────┐
 * │              appwrite-products                         │
 * │  • CRUD Appwrite pur                                        │
 * │  • Transformations sans état                               │
 * │  • Gestion realtime                                        │
 * │  • Sync incrémentielle                                     │
 * └─────────────────▲───────────────────────────────────────────┘
 *                   │ Fournit les services bruts
 *                   │
 * ┌─────────────────▼───────────────────────────────────────────┐
 * │                  ProductsStore                              │
 * │  • SvelteMap réactive                                      │
 * │  • Cache localStorage                                      │
 * │  • Filtrage et dérivés                                     │
 * │  • Logique métier                                          │
 * └─────────────────▲───────────────────────────────────────────┘
 *                   │ Consommé par ProductModalState
 *                   │
 * ┌─────────────────▼───────────────────────────────────────────┐
 * │              ProductModalState                              │
 * │  • Factory par produit                                     │
 * │  • Formulaires locaux                                      │
 * │  • Orchestration des appels                                │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Services principaux :
 * ─────────────────────────────────────────────────────────────
 * Lecture/Chargement :
 * • loadMainEventData() : Données principales de l'événement
 * • syncProductsWithPurchases() : Sync incrémentielle delta
 * • loadPurchasesListByIds() : Chargement par IDs
 *
 * Écriture CRUD :
 * • createMainDocument() : Création document main
 * • upsertProduct() : Création/Mise à jour produit (avec sync logic)
 * • updateProduct() : Mise à jour produit direct (générique)
 * • createPurchase/updatePurchase/deletePurchase() : CRUD achats
 *
 * Realtime :
 * • subscribeToRealtime() : Abonnement événements produits/achats
 *
 * Ce fichier est une couche sans état qui expose des fonctions pures
 * pour les stores Svelte 5. Toute la logique de réactivité est gérée
 * par ProductsStore et ProductModalState.
 */

import {
  ID,
  Query,
  Permission,
  Role,
  type Models,
  ExecutionMethod,
} from "appwrite";
import {
  getAppwriteInstances,
  getAppwriteConfig,
  subscribe as appwriteSubscribe,
} from "./appwrite";
import type { Products, Purchases } from "../types/appwrite";
import type {
  EnrichedProduct,
  MainEventData,
  StoreInfo,
  TotalNeededOverrideData,
} from "../types/store.types";
import { toastService } from "./toast.service.svelte";
import { executeWithRetry } from "../utils/retry.utils";
import { slugify } from "../utils/productsUtils";
import { eventsStore } from "../stores/EventsStore.svelte";
import { productsStore } from "../stores/ProductsStore.svelte";
import type { EnrichedEvent } from "../types/events.d";

// =============================================================================
// TYPES INTERNE (utilise les types générés automatiquement ??)
// =============================================================================

export type ProductUpdate = Partial<
  Omit<Products, "$id" | keyof Models.Row | "purchases" | "mainId">
>;

export type PurchaseCreate = Omit<
  Purchases,
  "$id" | keyof Models.Row | "purchases" | "createdBy" | "products" | "mainId"
> & {
  products: string[]; // IDs des produits pour la relation
  mainId: string; // ID du main pour la relation
};

export type PurchaseUpdate = Partial<
  Omit<Purchases, "$id" | keyof Models.Row | "mainId" | "createdBy">
> & {
  products?: Products[];
};

// =============================================================================
// NOUVEAUX TYPES POUR LA MIGRATION PRODUCTSSTORE
// =============================================================================

export interface ProductWithPurchases extends Products {
  purchases: Purchases[];
}

// =============================================================================
// UTILITAIRES DE PERMISSIONS LABEL
// =============================================================================

/**
 * Génère les permissions pour un produit/achat basées sur un label (MAIN ID)
 * @deprecated Utiliser getEventPermissionsFromEvent() à la place
 * @param mainId - ID du main (utilisée comme label)
 * @returns Array de permissions
 */
export function getLabelPermissions(mainId: string): string[] {
  return [
    Permission.read(Role.label(mainId)),
    Permission.update(Role.label(mainId)),
    Permission.delete(Role.label(mainId)),
  ];
}

/**
 * Génère les permissions pour un produit/achat à partir d'un événement
 * Inclut uniquement les permissions labels (plus de teams)
 * @param event - Événement enrichi (venant du cache EventsStore)
 * @returns Array de permissions à appliquer
 *
 * IMPORTANT: Cette fonction génère de NOUVELLES permissions basées sur
 * l'événement, plutôt que de copier les permissions existantes.
 *
 * Les permissions générées sont :
 * 1. Permissions LABEL basées sur mainId (event.$id)
 *
 * NOTE : Les permissions teams ne sont plus utilisées.
 * Le contrôle d'accès est géré exclusivement par les labels.
 */
export function getEventPermissionsFromEvent(
  event: EnrichedEvent | null,
): string[] {
  if (!event) {
    return [];
  }

  const permissions: string[] = [];
  const mainId = event.$id;

  // Permissions LABEL basées sur mainId
  // Ces permissions permettent à tous les membres de l'événement d'accéder aux produits/achats
  permissions.push(
    Permission.read(Role.label(mainId)),
    Permission.update(Role.label(mainId)),
  );

  return permissions;
}

// =============================================================================
// HELPERS PRÉPARATION ROWS POUR BATCH OPERATIONS
// =============================================================================

/**
 * Prépare une row complète pour upsert avec permissions
 *

 * Contrairement aux updates individuels (updateProduct) où la lib Appwrite client
 * est permissive et ignore les champs inconnus, la cloud function de batch est
 * stricte sur les types et valide que "store" est bien une string.
 *
 * C'est pourquoi on DOIT transformer :
 * - StoreInfo (objet) → store (JSON string)
 * - whoData.names → who (array direct)
 *
 * @param product - Produit enrichi
 * @param updateData - Données de mise à jour à appliquer (StoreInfo objet ou { names })
 * @param updateType - Type de mise à jour ("who" | "store")
 * @param mainId - ID de l'événement pour les permissions Label
 * @returns Row complète pour Appwrite
 */
function prepareProductRow(
  product: EnrichedProduct,
  updateData: { names?: string[] } | StoreInfo,
  updateType: "who" | "store",
  mainId: string,
) {
  let whoValue = product.who;
  let storeValue = product.store;

  if (updateType === "who") {
    // Type guard pour TypeScript
    const whoData = updateData as { names?: string[] };
    whoValue = whoData.names || null;
  } else if (updateType === "store") {
    const storeInfoData = updateData as StoreInfo;
    storeValue = JSON.stringify(storeInfoData);
  }

  return {
    $id: product.$id,
    // Champs de base du produit
    productHugoUuid: product.productHugoUuid,
    productName: product.productName,
    mainId: product.mainId,
    status: product.status || null,
    // Champs modifiables (soit l'update, soit la valeur actuelle)
    who: whoValue,
    store: storeValue,
    stockReel: product.stockReel || null,
    previousNames: product.previousNames || null,
    isMerged: product.isMerged || false,
    mergedFrom: product.mergedFrom || null,
    mergeDate: product.mergeDate || null,
    mergeReason: product.mergeReason || null,
    mergedInto: product.mergedInto || null,
    totalNeededOverride: product.totalNeededOverride || null,
    // Permissions Label (read + update)
    $permissions: [
      Permission.read(Role.label(mainId)),
      Permission.update(Role.label(mainId)),
    ],
  };
}

// =============================================================================
// UTILITAIRES DE TRANSFORMATION SYNC
// =============================================================================

/**
 * Transforme un EnrichedProduct en données Products pour Appwrite
 * @param enrichedProduct - Produit enrichi localement
 * @param userUpdates - Modifications utilisateur à appliquer
 * @returns Données formatées pour Appwrite avec $id prédéfini
 */
export function enrichedProductToAppwriteProduct(
  enrichedProduct: EnrichedProduct,
  userUpdates: ProductUpdate,
): any {
  return {
    $id: enrichedProduct.$id,
    mainId: enrichedProduct.mainId,
    productHugoUuid: enrichedProduct.productHugoUuid,
    productName: enrichedProduct.productName, // pour renommage futur
    // Données utilisateur (écrasent/étendent les valeurs par défaut)
    ...userUpdates,
  };
}

export interface LoadProductsOptions {
  limit?: number;
  orderBy?: "productName" | "$updatedAt";
  orderDirection?: "asc" | "desc";
}

export interface SyncOptions {
  lastSync: string | null;
  limit?: number;
}

export interface RealtimeCallbacks {
  onProductCreate?: (product: Products) => void;
  onProductUpdate?: (product: Products) => void;
  onProductDelete?: (productId: string) => void;
  onPurchaseCreate?: (purchase: Purchases) => void;
  onPurchaseUpdate?: (purchase: Purchases) => void;
  onPurchaseDelete?: (purchaseId: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

// =============================================================================
// UTILITAIRES INTERNES
// =============================================================================

/**
 * Enrichit les données produit avec le nom de l'utilisateur
 * @param data - Données du produit à enrichir
 * @returns Données enrichies avec updatedBy
 */
async function enrichProductWithUser(data: any) {
  const { account } = await getAppwriteInstances();
  const user = await account.get();
  return {
    ...data,
    updatedBy: user.name,
  };
}

// =============================================================================
// SERVICES PRODUITS - LECTURE
// =============================================================================

/**
 * Récupère le nom de l'utilisateur courant
 * @returns Nom de l'utilisateur ou chaîne vide si non disponible
 */
function getCurrentUserName(): string {
  return localStorage.getItem("appwrite-user-name") || "";
}

/**
 * Charge les produits depuis Appwrite avec leurs achats associés
 *
 * Service principal de chargement initial pour ProductsStore.
 * Gère le chargement des produits et optionnellement leurs achats associés.
 *
 * @param mainId - ID du main pour filtrer les produits
 * @param options - Options de chargement (pagination, tri, inclusion des achats)
 * @returns Promise<ProductWithPurchases[]> - Produits enrichis avec leurs achats si demandé
 * @deprecated Utiliser plutôt syncProductsWithPurchases
 *
 *
 * Flux :
 * 1. Charge les produits depuis la collection products
 * 2. Si includePurchases=true, charge les achats associés
 * 3. Utilise mergeProductsWithPurchases pour enrichir les produits @LEGACY @USELESS
 * 4. Retourne les produits prêts à être utilisés par ProductsStore
 */
export async function loadProductsWithPurchases(
  mainId: string,
  options: LoadProductsOptions = {},
): Promise<ProductWithPurchases[]> {
  const {
    limit = 1000,
    orderBy = "productName",
    orderDirection = "asc",
  } = options;

  try {
    const { tables, config } = await getAppwriteInstances();

    // 1. Charger les produits (purchases est maintenant string[], pas une relation)
    const productsResponse = await tables.listRows({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      queries: [
        Query.equal("mainId", mainId),
        Query.orderAsc(
          orderBy === "productName" ? "productName" : "$updatedAt",
        ),
        Query.limit(limit),
      ],
    });
    const products = productsResponse.rows as unknown as Products[];

    // 2. Extraire tous les IDs de purchases uniques
    const allPurchaseIds = new Set<string>();
    products.forEach((product) => {
      if (product.purchases?.length) {
        product.purchases.forEach((id) => allPurchaseIds.add(id));
      }
    });

    // 3. Charger toutes les purchases en une seule requête
    let purchasesMap = new Map<string, Purchases>();
    if (allPurchaseIds.size > 0) {
      const purchasesResponse = await tables.listRows({
        databaseId: config.databaseId,
        tableId: config.collections.purchases,
        queries: [Query.equal("$id", Array.from(allPurchaseIds))],
      });
      const purchases = purchasesResponse.rows as unknown as Purchases[];

      // Créer un Map pour lookup O(1)
      purchases.forEach((purchase) => {
        purchasesMap.set(purchase.$id, purchase);
      });

      console.log(
        `[Appwrite product] ${purchases.length} purchases chargées pour ${products.length} produits`,
      );
    }

    // 4. Fusionner les purchases dans les produits
    const productsWithPurchases: ProductWithPurchases[] = products.map(
      (product) => {
        if (!product.purchases?.length) {
          return { ...product, purchases: [] };
        }

        // Remplacer les IDs par les objets Purchases complets
        const fullPurchases = product.purchases
          .map((id) => purchasesMap.get(id))
          .filter((p): p is Purchases => p !== undefined);

        return {
          ...product,
          purchases: fullPurchases,
        };
      },
    );

    console.log(
      `[Appwrite product] ${productsResponse.rows.length} produits chargés avec achats`,
    );

    return productsWithPurchases;
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur chargement produits pour mainId ${mainId}:`,
      error,
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur lors du chargement des produits";
    throw new Error(`Échec du chargement des produits: ${errorMessage}`);
  }
}

/**
 * Charge un produit spécifique par son ID depuis Appwrite
 *
 * Service utilitaire pour récupérer un seul produit. Utile pour des vues détaillées
 * ou des opérations ponctuelles sur un produit sans charger toute la liste.
 *
 * @param productId - L'ID du produit à récupérer.
 * @returns Promise<Products | null> - Le produit trouvé, ou null si une erreur survient ou si le produit n'existe pas.
 * @legacy : inutilisé ?
 *
 * Flux :
 * 1. Récupère les instances Appwrite nécessaires (databases, config).
 * 2. Appelle `databases.getDocument` avec les informations de la collection `products`.
 * 3. Retourne le document trouvé, casté en `Products`.
 * 4. En cas d'erreur (ex: produit non trouvé), log l'erreur et retourne `null`.
 */
export async function loadProductById(
  productId: string,
): Promise<Products | null> {
  try {
    const { tables, config } = await getAppwriteInstances();
    const response = await tables.getRow({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      rowId: productId,
    });
    return response as unknown as Products;
  } catch (err) {
    console.error("[Appwrite product] Erreur chargement produit:", err);
    return null;
  }
}

/**
 * Charge les purchases modifiés depuis le dernier sync
 * @param mainId - ID du main
 * @param lastSync - Date du dernier sync
 * @param limit - Limite de résultats (default: 100)
 * @returns Promise<Purchases[]>
 */
export async function loadUpdatedPurchases(
  mainId: string,
  lastSync: string,
  limit = 100,
): Promise<Purchases[]> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: config.databaseId,
      tableId: config.collections.purchases,
      queries: [
        Query.greaterThan("$updatedAt", lastSync),
        Query.equal("mainId", mainId),
        Query.limit(limit),
        // Note: products est maintenant string[] (pas une relation), pas besoin de Query.select
      ],
    });

    console.log(
      `[Appwrite product] ${response.rows.length} purchases modifiés chargés`,
    );
    return response.rows as unknown as Purchases[];
  } catch (error) {
    console.error(
      "[Appwrite product] Erreur chargement purchases modifiés:",
      error,
    );
    return [];
  }
}

/**
 * Charge plusieurs produits par leurs IDs
 */
export async function loadProductsListByIds(
  productIds: string[],
): Promise<Products[]> {
  try {
    const { tables, config } = await getAppwriteInstances();

    // Utiliser une requête avec filtre OR pour récupérer les produits
    const response = await tables.listRows({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      queries: [
        Query.equal("$id", productIds), // ← Filtre par IDs
        // Note: purchases est maintenant string[] (pas une relation), pas besoin de Query.select
      ],
    });

    return response.rows as unknown as Products[];
  } catch (err) {
    console.error("[Appwrite product] Erreur chargement produits:", err);
    return [];
  }
}

/**
 * Synchronise les produits avec leurs purchases depuis Appwrite (uniquement les mises à jour)
 *
 * Service de synchronisation incrémentielle pour ProductsStore.
 * Optimisé pour ne charger que les modifications depuis dernière synchronisation.
 *
 * @param mainId - ID du main pour filtrer les produits
 * @param options - Options de synchronisation (dernière sync, limite)
 * @returns Promise<ProductWithPurchases[]> - Produits modifiés/créés avec leurs purchases depuis lastSync
 *
 * Flux :
 * 1. Vérifie la présence de lastSync (sinon retourne vide)
 * 2. Requête Appwrite avec filtre $updatedAt > lastSync et relations purchases
 * 3. Retourne uniquement le delta des modifications avec relations
 * 4. ProductsStore utilisera applyProductUpdates pour fusionner ces changements
 */
export async function syncProductsWithPurchases(
  mainId: string,
  options: SyncOptions,
): Promise<ProductWithPurchases[]> {
  const { lastSync, limit = 1000 } = options;

  try {
    const { tables, config } = await getAppwriteInstances();

    if (!lastSync) {
      // === CHARGEMENT COMPLET ===
      console.log(
        "[Appwrite product] Chargement complet des produits et achats",
      );

      // 1. Charger les produits (sans purchases)
      const productsResponse = await tables.listRows({
        databaseId: config.databaseId,
        tableId: config.collections.products,
        queries: [Query.equal("mainId", mainId), Query.limit(limit)],
      });
      const products = productsResponse.rows as unknown as Products[];

      // 2. Charger les purchases
      const purchasesResponse = await tables.listRows({
        databaseId: config.databaseId,
        tableId: config.collections.purchases,
        queries: [
          Query.equal("mainId", mainId),
          Query.limit(limit * 2), // Plus de purchases que de produits
        ],
      });
      const purchases = purchasesResponse.rows as unknown as Purchases[];

      // 3. Reconstruire la relation côté client
      const productsMap = new Map<string, ProductWithPurchases>();
      products.forEach((p) => {
        productsMap.set(p.$id, { ...p, purchases: [] });
      });

      purchases.forEach((purchase) => {
        purchase.products?.forEach((productId) => {
          const product = productsMap.get(productId);
          if (product) {
            if (!product.purchases) product.purchases = [];
            product.purchases.push(purchase);
          }
        });
      });

      console.log(
        `[Appwrite product] ${products.length} produits chargés avec ${purchases.length} achats`,
      );

      return Array.from(productsMap.values());
    }

    // === CHARGEMENT INCRÉMENTAL ===
    // Pour le delta, on fait la même chose
    const productsResponse = await tables.listRows({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      queries: [
        Query.greaterThan("$updatedAt", lastSync),
        Query.equal("mainId", mainId),
        Query.limit(limit),
      ],
    });
    const products = productsResponse.rows as unknown as Products[];

    // Charger aussi les purchases modifiées
    const purchasesResponse = await tables.listRows({
      databaseId: config.databaseId,
      tableId: config.collections.purchases,
      queries: [
        Query.greaterThan("$updatedAt", lastSync),
        Query.equal("mainId", mainId),
        Query.limit(limit * 2),
      ],
    });
    const purchases = purchasesResponse.rows as unknown as Purchases[];

    // Reconstruire la relation pour le delta
    const productsMap = new Map<string, ProductWithPurchases>();
    products.forEach((p) => {
      productsMap.set(p.$id, { ...p, purchases: [] });
    });

    purchases.forEach((purchase) => {
      purchase.products?.forEach((productId) => {
        const product = productsMap.get(productId);
        if (product) {
          if (!product.purchases) product.purchases = [];
          product.purchases.push(purchase);
        }
      });
    });

    if (productsResponse.rows.length > 0) {
      console.log(
        `[Appwrite product] ${productsResponse.rows.length} produits synchronisés (delta)`,
      );
    }

    return Array.from(productsMap.values());
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur sync produits avec purchases pour mainId ${mainId}:`,
      error,
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur lors de la synchronisation";
    throw new Error(`Échec de la synchronisation: ${errorMessage}`);
  }
}

// =============================================================================
// SERVICES PRODUITS - MISE À JOUR
// =============================================================================

/**
 * Met à jour un produit dans Appwrite
 * @param productId - ID du produit à mettre à jour
 * @param updates - Champs à mettre à jour
 * @returns Promise<Products>
 */
export async function updateProduct(
  productId: string,
  updates: ProductUpdate,
  putUpdatedBy: boolean = true,
): Promise<Products> {
  const { tables, config } = await getAppwriteInstances();

  // Enrichir les données avec updatedBy
  if (putUpdatedBy) {
    updates.updatedBy = getCurrentUserName();
  }

  const response = await tables.updateRow({
    databaseId: config.databaseId,
    tableId: config.collections.products,
    rowId: productId,
    data: updates,
    // permissions non fourni = Appwrite préserve les permissions existantes
  });

  return response as unknown as Products;
}

/**
 * Met à jour ou crée un produit sur Appwrite (pattern upsert)
 * @param productId - ID du produit à mettre à jour/créer
 * @param updates - Champs à mettre à jour
 * @param getEnrichedProduct - Fonction pour récupérer le produit enrichi localement
 * @returns Promise<Products>
 */
export async function upsertProduct(
  productId: string,
  updates: ProductUpdate,
  getEnrichedProduct: (productId: string) => any, // EnrichedProduct | null
): Promise<Products> {
  try {
    // Récupérer le produit enrichi localement
    const enrichedProduct = getEnrichedProduct(productId);
    if (!enrichedProduct) {
      throw new Error(
        `Produit ${productId} non trouvé localement pour création`,
      );
    }

    console.log(
      `[Appwrite product] Création produit ${productId} sur Appwrite...`,
    );

    // Transformer en données Appwrite avec les updates utilisateur
    const appwriteData = enrichedProductToAppwriteProduct(
      enrichedProduct,
      updates,
    );

    // Enrichir les données avec updatedBy
    const enrichedData = await enrichProductWithUser(appwriteData);

    const { tables, config } = await getAppwriteInstances();

    // 🔥 NOUVEAU: Récupérer les permissions depuis l'événement (inclut les teams)
    const event = eventsStore.getEventById(enrichedData.mainId);
    const eventPermissions = getEventPermissionsFromEvent(event);

    const response = await tables.createRow({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      rowId: productId, // $id prédéfini
      data: enrichedData, // ← Utiliser les données enrichies
      permissions: eventPermissions, // ← Inclut les labels ET les teams
    });

    console.log(
      `[Appwrite product] Produit ${productId} créé avec permissions (labels + teams)`,
    );

    // Note : le ProductsStore mettra à jour isSynced via le realtime
    return response as unknown as Products;
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur création produit ${productId}:`,
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec de la création du produit: ${errorMessage}`);
  }
}

/**
 * Crée un produit manuel (sans lien Hugo)
 * @param productData - Données du produit (nom, type, store, who)
 * @param mainId - ID du main
 * @returns Promise<Products>
 */
export async function createManualProduct(
  productData: {
    productName: string;
    productType: string;
    store?: StoreInfo;
    who?: string[];
    pF?: boolean;
    pS?: boolean;
    quantity?: { q: number; u: string };
  },
  mainId: string,
): Promise<Products> {
  try {
    const { tables, config } = await getAppwriteInstances();

    // Générer un ID unique basé sur le nom slugifié (10 premiers chars) + timestamp
    const slug = slugify(productData.productName).substring(0, 10);
    const uniqueId = `${slug}_${Date.now().toString(36)}`;

    // Construire l'objet specs (métadonnées manuelles)
    const specs = {
      quantity: productData.quantity, // { q: number, u: string }
      pF: productData.pF || false,
      pS: productData.pS || false,
    };

    const manualProduct = {
      productHugoUuid: null, // Toujours null pour les produits manuels
      productName: productData.productName,
      productType: productData.productType || "Autre",
      store: productData.store ? JSON.stringify(productData.store) : null,
      who: productData.who || [],
      isSynced: true, // Toujours true pour les produits créés directement dans Appwrite
      mainId: mainId,
      status: "active",
      updatedBy: getCurrentUserName(),
      // Champs par défaut
      stockReel: null,
      isMerged: false,
      mergedFrom: null,
      mergeDate: null,
      mergeReason: null,
      mergedInto: null,
      totalNeededOverride: null,
      specs: JSON.stringify(specs), // ✅ Stockage des métadonnées manuelles
    };

    console.log(
      `[Appwrite product] Création produit manuel ${uniqueId}...`,
      manualProduct,
    );

    // 🔥 NOUVEAU: Récupérer les permissions depuis l'événement (inclut les teams)
    const event = eventsStore.getEventById(mainId);
    const eventPermissions = getEventPermissionsFromEvent(event);

    const response = await tables.createRow({
      databaseId: config.databaseId,
      tableId: config.collections.products,
      rowId: uniqueId,
      data: manualProduct,
      permissions: eventPermissions, // ← Inclut les labels ET les teams
    });

    console.log(
      `[Appwrite product] Produit manuel ${uniqueId} créé avec permissions Label`,
    );
    return response as unknown as Products;
  } catch (error) {
    console.error("[Appwrite product] Erreur création produit manuel:", error);
    throw error;
  }
}

// =============================================================================
// SERVICES BATCH UPDATE
// =============================================================================

interface ProductBatchUpdate {
  stockReel?: string | null;
  who?: string[] | null;
  storeInfo?: StoreInfo | null;
}

/**
 * Met à jour plusieurs champs d'un produit en un seul appel
 * @param productId - ID du produit à mettre à jour
 * @param updates - Champs à mettre à jour (stock, who, storeInfo)
 * @param getEnrichedProduct - Fonction pour récupérer le produit enrichi localement
 * @returns Promise<Products>
 */
export async function updateProductBatch(
  productId: string,
  updates: ProductBatchUpdate,
  getEnrichedProduct: (productId: string) => any, // EnrichedProduct | null
): Promise<Products> {
  try {
    // Récupérer le produit enrichi localement pour vérifier isSynced
    const enrichedProduct = getEnrichedProduct(productId);
    if (!enrichedProduct) {
      throw new Error(
        `Produit ${productId} non trouvé localement pour mise à jour batch`,
      );
    }

    const productUpdates: ProductUpdate = {};

    if (updates.stockReel !== undefined) {
      productUpdates.stockReel = updates.stockReel;
    }

    if (updates.who !== undefined) {
      productUpdates.who = updates.who;
    }

    if (updates.storeInfo !== undefined) {
      productUpdates.store = JSON.stringify(updates.storeInfo);
    }

    // ✅ LOGIQUE DE SYNC : Vérifier isSynced du produit
    if (!enrichedProduct.isSynced) {
      // Produit local : utiliser upsertProduct pour créer sur Appwrite
      console.log(
        `[Appwrite product] Produit ${productId} local, création batch avec upsert...`,
      );
      return await upsertProduct(productId, productUpdates, getEnrichedProduct);
    } else {
      // Produit déjà sync : utiliser updateProduct normal
      console.log(
        `[Appwrite product] Produit ${productId} déjà sync, update batch normal...`,
      );
      return await updateProduct(productId, productUpdates);
    }
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur lors de la mise à jour batch du produit ${productId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// SERVICES ACHATS
// =============================================================================

/**
 * Crée un nouvel achat
 * @param purchaseData - Données de l'achat
 * @returns Promise<Purchases>
 */
export async function createPurchase(
  purchaseData: PurchaseCreate,
): Promise<Purchases> {
  const { tables, config } = await getAppwriteInstances();

  const completePurchaseData = {
    ...purchaseData,
    createdBy: getCurrentUserName(),
  };

  // 🔥 NOUVEAU: Récupérer les permissions depuis l'événement (inclut les teams)
  const event = eventsStore.getEventById(purchaseData.mainId);
  const eventPermissions = getEventPermissionsFromEvent(event);

  const response = await tables.createRow(
    config.databaseId,
    config.collections.purchases,
    ID.unique(),
    completePurchaseData,
    eventPermissions, // ← Inclut les labels ET les teams
  );

  console.log(
    "[Appwrite product] Achat créé avec permissions Label:",
    response,
  );
  return response as unknown as Purchases;
}

/**
 * Met à jour un achat existant
 * @param purchaseId - ID de l'achat à mettre à jour
 * @param updates - Champs à mettre à jour
 * @returns Promise<Purchases>
 */
export async function updatePurchase(
  purchaseId: string,
  updates: PurchaseUpdate,
): Promise<Purchases> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const response = await tables.updateRow(
      config.databaseId,
      config.collections.purchases,
      purchaseId,
      updates,
      // permissions non fourni = Appwrite préserve les permissions existantes
    );

    console.log(`[Appwrite product] Achat ${purchaseId} mis à jour:`, updates);
    return response as unknown as Purchases;
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur mise à jour achat ${purchaseId}:`,
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec de la mise à jour de l'achat: ${errorMessage}`);
  }
}

/**
 * Supprime un achat
 * @param purchaseId - ID de l'achat à supprimer
 */
export async function deletePurchase(purchaseId: string): Promise<void> {
  try {
    const { tables, config } = await getAppwriteInstances();

    await tables.deleteRow(
      config.databaseId,
      config.collections.purchases,
      purchaseId,
    );

    console.log(`[Appwrite product] Achat ${purchaseId} supprimé`);
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur suppression achat ${purchaseId}:`,
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec de la suppression de l'achat: ${errorMessage}`);
  }
}

/**
 * Charge les purchases avec leurs relations products (requête ciblée)
 *
 * Utilitaire optimisé pour charger uniquement les champs nécessaires des purchases,
 * en particulier la relation products pour identifier les produits associés.
 *
 * @param purchaseIds - Liste des IDs des purchases à charger
 * @returns Promise<Purchases[]> - Purchases avec leurs relations products
 *
 * Flux :
 * 1. Utilise Query.select() pour charger uniquement les champs nécessaires
 * 2. Inclut le champ products pour avoir les relations
 * 3. Retourne les purchases complets avec leurs produits associés
 */
export async function loadPurchasesListByIds(
  purchaseIds: string[],
): Promise<Purchases[]> {
  if (!purchaseIds?.length) return [];

  try {
    const { tables, config } = await getAppwriteInstances();

    const response = await tables.listRows(
      config.databaseId,
      config.collections.purchases,
      [Query.equal("$id", purchaseIds)], // Note: products est maintenant string[], pas de relation
    );

    console.log(
      `[Appwrite product] ${response.rows.length} purchases chargés avec relations products`,
    );
    return response.rows as unknown as Purchases[];
  } catch (error) {
    console.error(
      "[Appwrite product] Erreur chargement purchases avec relations:",
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec du chargement des purchases: ${errorMessage}`);
  }
}

// =============================================================================
// UTILITAIRES DE MERGE
// =============================================================================

/**
 * Applique les mises à jour de produits aux produits existants
 *
 * Utilitaire principal pour la synchronisation incrémentielle de ProductsStore.
 * Fusionne intelligemment les produits existants avec les mises à jour reçues.
 *
 * @param currentProducts - Liste actuelle des produits dans le store
 * @param updatedProducts - Liste des produits mis à jour ou nouveaux (de syncProducts)
 * @returns Array<Products> - Liste fusionnée prête à remplacer l'état du store
 *
 * Algorithme :
 * 1. Crée un Map des produits mis à jour pour lookup O(1)
 * 2. Remplace les produits existants par leurs versions mises à jour
 * 3. Conserve les produits non modifiés
 * 4. Ajoute les nouveaux produits qui n'existaient pas
 *
 * Utilisé par ProductsStore après syncProducts() ou lors des événements realtime.
 */
export function applyProductUpdates(
  currentProducts: Products[],
  updatedProducts: Products[],
): Products[] {
  const updated = new Map(updatedProducts.map((p) => [p.$id, p]));
  const merged = currentProducts.map((p) => updated.get(p.$id) ?? p);
  const existingIds = new Set(currentProducts.map((p) => p.$id));
  const news = updatedProducts.filter((p) => !existingIds.has(p.$id));

  return [...merged, ...news];
}

// =============================================================================
// UTILITAIRES DE PARSING
// =============================================================================

/**
 * Formate les données de stock pour Appwrite
 * @param quantity - Quantité
 * @param unit - Unité
 * @param notes - Notes optionnelles
 * @param dateTime - Date/heure optionnelle
 * @returns string JSON formaté
 */
export function formatStockData(
  quantity: number,
  unit: string,
  notes?: string,
  dateTime?: string,
): string {
  const stockEntry = {
    quantity: quantity.toString(),
    unit,
    notes: notes || "",
    dateTime: dateTime || new Date().toISOString(),
  };

  return JSON.stringify(stockEntry);
}

/**
 * Parse les données de stock depuis Appwrite
 * @param stockJson - Chaîne JSON des stocks
 * @returns StockEntry | null
 */
export function parseStockData(stockJson: string | null): {
  quantity: string;
  unit: string;
  notes: string;
  dateTime: string;
} | null {
  if (!stockJson) return null;

  try {
    return JSON.parse(stockJson);
  } catch (error) {
    console.error("[Appwrite product] Erreur parsing stock data:", error);
    return null;
  }
}

// =============================================================================
// SERVICES REALTIME
// =============================================================================

/**
 * S'abonne aux événements realtime des collections products et purchases
 *
 * @deprecated Utilisez realtimeManager.registerDynamic() directement depuis ProductsStore
 * Cette fonction est conservée pour compatibilité mais ne devrait plus être utilisée.
 *
 * Service principal pour les mises à jour en temps réel de ProductsStore.
 * Gère l'abonnement Appwrite et dispatche les événements vers les callbacks appropriés.
 *
 * @param mainId - ID du main pour filtrer les événements
 * @param callbacks - Fonctions de callback pour chaque type d'événement
 * @returns Function - Fonction de désabonnement (appeler pour se désabonner)
 *
 * Flux :
 * 1. Initialise AppwriteClient si nécessaire
 * 2. S'abonne aux collections products et purchases pour ce mainId
 * 3. Parse les événements Appwrite (create/update/delete)
 * 4. Dispatch vers les callbacks appropriés (onProductCreate, onPurchaseUpdate, etc.)
 * 5. Gère le cycle de vie (connect/disconnect/error)
 *
 * ProductsStore fournit les callbacks qui mettent à jour l'état réactif.
 */
export function subscribeToRealtime(
  mainId: string,
  callbacks: RealtimeCallbacks = {},
): () => void {
  console.log(
    "[Appwrite product] subscribeToRealtime appelé avec mainId:",
    mainId,
  );
  let unsubscribe: (() => void) | null = null;

  const handleRealtimeEvent = (response: any) => {
    const { events, payload } = response;
    if (!payload) return;

    // Déterminer la collection source à partir des événements
    const isProductsCollection = events.some((e: string) =>
      e.includes("products."),
    );
    const isPurchasesCollection = events.some((e: string) =>
      e.includes("purchases."),
    );

    const isCreate = events.some((e: string) => e.includes(".create"));
    const isUpdate = events.some((e: string) => e.includes(".update"));
    const isDelete = events.some((e: string) => e.includes(".delete"));

    // Dispatcher vers les callbacks appropriés
    if (isProductsCollection) {
      const product = payload as Products;

      // 🔄 TOAST REALTIME : Notification pour les modifications d'autres utilisateurs
      if (product.updatedBy && product.updatedBy !== getCurrentUserName()) {
        if (isCreate || isUpdate) {
          toastService.info(
            `${product.updatedBy} a modifié le produit "${product.productName}"`,
            { source: "realtime-other" },
          );
        } else if (isDelete) {
          toastService.info(`${product.updatedBy} a supprimé un produit`, {
            source: "realtime-other",
          });
        }
      }

      if (isCreate && callbacks.onProductCreate) {
        callbacks.onProductCreate(product);
      } else if (isUpdate && callbacks.onProductUpdate) {
        callbacks.onProductUpdate(product);
      } else if (isDelete && callbacks.onProductDelete) {
        callbacks.onProductDelete(product.$id);
      }
    } else if (isPurchasesCollection) {
      const purchase = payload as Purchases;

      // 🔄 TOAST REALTIME : Notification pour les achats d'autres utilisateurs
      if (purchase.createdBy && purchase.createdBy !== getCurrentUserName()) {
        const productName = "un produit"; // Message générique (purchase.products est maintenant string[])

        if (isCreate && purchase.who !== getCurrentUserName()) {
          toastService.info(
            `${purchase.who} a ajouté un achat pour ${productName}`,
            { source: "realtime-other" },
          );
        } else if (isUpdate && purchase.who !== getCurrentUserName()) {
          toastService.info(
            `${purchase.who} a modifié un achat pour ${productName}`,
            { source: "realtime-other" },
          );
        } else if (isDelete) {
          toastService.info(
            `${purchase.who} a supprimé un achat pour ${productName}`,
            { source: "realtime-other" },
          );
        }
      }

      if (isCreate && callbacks.onPurchaseCreate) {
        callbacks.onPurchaseCreate(purchase);
      } else if (isUpdate && callbacks.onPurchaseUpdate) {
        callbacks.onPurchaseUpdate(purchase);
      } else if (isDelete && callbacks.onPurchaseDelete) {
        callbacks.onPurchaseDelete(purchase.$id);
      }
    }
  };

  const setupSubscription = async () => {
    try {
      console.log("[Appwrite product] Setup Realtime Subscription...");

      // S'assurer que les instances Appwrite sont initialisées
      const instances = await getAppwriteInstances();
      const { config } = instances;

      console.log(
        "[Appwrite product] Appwrite instances initialisées, subscribing to collections...",
      );
      console.log("[Appwrite product] Config:", config);

      // S'abonner aux canaux de collections pour le mainId spécifique
      const channels = [
        `databases.${config.databaseId}.collections.${config.collections.products}.documents`,
        `databases.${config.databaseId}.collections.${config.collections.purchases}.documents`,
      ];

      unsubscribe = await appwriteSubscribe(channels, (response) => {
        // Gérer les callbacks de connexion
        if (response.event === "client.connected") {
          console.log("[Appwrite product] Realtime connecté");
          callbacks.onConnect?.();
        }

        // Traiter les événements de produits et achats
        // Pas besoin de filtrer par mainId - on est déjà sur le bon événement
        if (response.payload) {
          handleRealtimeEvent(response);
        }
      });

      console.log(
        "[Appwrite product] Abonnement realtime configuré avec succès",
      );

      // Signaler la connexion initiale
      setTimeout(() => {
        callbacks.onConnect?.();
      }, 100);
    } catch (error) {
      console.error(
        "[Appwrite product] Impossible de configurer realtime:",
        error,
      );
      callbacks.onError?.(error);
    }
  };

  // Lancer la configuration de l'abonnement
  setupSubscription();

  // Retourner la fonction de désabonnement
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/**
 * Charge les données principales de l'événement depuis la collection main
 * @param mainId - ID de l'événement principal
 * @returns Promise<MainEventData | null> - Données de l'événement ou null si non trouvé
 */
export async function loadMainEventData(
  mainId: string,
): Promise<MainEventData | null> {
  try {
    console.log(
      `[Appwrite product] Chargement des données principales pour mainId: ${mainId}`,
    );

    const { tables, config } = await getAppwriteInstances();

    const mainData = await tables.getRow(
      config.databaseId,
      config.collections.main,
      mainId,
    );
    console.log(
      `[Appwrite product] Données principales chargées pour: ${mainData.name}`,
    );
    return mainData as unknown as MainEventData;
  } catch (error) {
    console.error(
      `[Appwrite product] Erreur chargement données principales pour mainId ${mainId}:`,
      error,
    );
    return null;
  }
}

// /**
//  * @deprecated : no usage. appwrite-event for this.
//  * Crée un document Main dans Appwrite
//  */
// export async function createMainDocument(
//   mainId: string,
//   hugoContentHash: string,
//   allDates: string[],
//   name: string,
// ): Promise<void> {
//   try {
//     console.log(`[Appwrite product] Création du Main document: ${mainId}`);

//     const { tables, config, account } = await getAppwriteInstances();
//     const user = await account.get();

//     await tables.createRow(config.databaseId, config.collections.main, mainId, {
//       name: name,
//       createdBy: user.$id,
//       isActive: true,
//       originalDataHash: hugoContentHash,
//       allDates: allDates,
//       status: "active",
//       dateStart: allDates[0] || null,
//       dateEnd: allDates[allDates.length - 1] || null,
//     });

//     console.log(`[Appwrite product] Main document créé: ${mainId}`);
//   } catch (error) {
//     console.error(
//       `[Appwrite product] Erreur création Main document:`,
//       error,
//     );
//     throw error;
//   }
// }

// =============================================================================
// SERVICES DE MODIFICATION GROUPÉE
// =============================================================================

export interface BatchUpdateResult {
  success: boolean;
  transactionId?: string;
  updatedCount: number;
  updateType: string;
  error?: string;
  timestamp: string;
}

/**
 * Version optimisée utilisant upsertRows côté serveur
 * Les rows complètes sont préparées côté client avec les permissions
 * @param productIds - IDs des produits à modifier
 * @param products - Produits complets pour reconstruire les rows
 * @param updateType - Type de mise à jour ("who" | "store")
 * @param updateData - Données de mise à jour
 * @returns Promise<BatchUpdateResult> - Résultat de l'opération
 */
export async function batchUpdateProductsOptimized(
  productIds: string[],
  products: EnrichedProduct[],
  updateType: "who" | "store",
  updateData: { names?: string[] } | StoreInfo,
): Promise<BatchUpdateResult> {
  try {
    const { functions, config, account } = await getAppwriteInstances();
    const mainId = productsStore.currentMainId;

    if (!mainId) {
      throw new Error(
        "No current event - cannot determine mainId for permissions",
      );
    }

    // ✅ Récupérer l'utilisateur courant
    const user = await account.get();

    // ⚡ SIMPLIFICATION 2026-01-21 : Plus de prepareBatchUpdateData()
    // On construit directement les rows avec updateType + updateData
    // La sérialisation JSON sera faite automatiquement par Appwrite client

    // 1. Construire les rows complètes avec permissions
    const rows = productIds.map((productId) => {
      const product = products.find((p) => p.$id === productId);
      if (!product) {
        throw new Error(`Product ${productId} not found in products data`);
      }
      return prepareProductRow(product, updateData, updateType, mainId);
    });

    console.log(
      `[Appwrite product] Lancement mise à jour groupée OPTIMISÉE: ${rows.length} produits, type: ${updateType}`,
    );

    // 3. Envoyer à la cloud function avec les rows complètes
    const payload = {
      operation: "batchUpdateProductsOptimized",
      data: {
        rows,
        fromUserId: user.$id,
      },
    };

    // 🔄 RETRY LOGIC
    const execution = await executeWithRetry<Models.Execution>(
      () =>
        functions.createExecution(
          config.functions.batchUpdate,
          JSON.stringify(payload),
          false, // async = false pour attendre le résultat
          "/",
          ExecutionMethod.POST,
        ),
      {
        operationName: `batchUpdateProductsOptimized (${rows.length} products, type: ${updateType})`,
        maxAutoRetries: 1,
        autoRetryDelay: 2000,
      },
    );

    if (!execution) {
      throw new Error(
        "Opération annulée ou échouée après tentatives de mise à jour groupée optimisée",
      );
    }

    if (execution.status !== "completed") {
      throw new Error(
        `Exécution échouée avec statut: ${execution.status}. Erreur: ${(execution as any).stderr || execution.responseBody}`,
      );
    }

    const result = JSON.parse(execution.responseBody) as BatchUpdateResult;

    if (result.success) {
      console.log(
        `[Appwrite product] Mise à jour groupée optimisée réussie: ${result.updatedCount} produits mis à jour`,
      );
    } else {
      console.error(
        `[Appwrite product] Mise à jour groupée optimisée échouée:`,
        result.error,
      );
    }

    return result;
  } catch (error) {
    console.error(
      "[Appwrite products] Erreur mise à jour groupée optimisée:",
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";

    return {
      success: false,
      updatedCount: productIds.length,
      updateType: updateType,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Crée un purchase de validation rapide pour un produit
 * @param productId - ID du produit à valider
 * @param quantities - Quantités manquantes à valider
 * @param options - Options supplémentaires (invoiceId, notes, etc.)
 * @returns Promise<Purchases[]>
 */
export async function createQuickValidationPurchases(
  mainId: string,
  productId: string,
  quantities: Array<{ q: number; u: string }>,
  options: {
    invoiceId?: string;
    notes?: string;
    store?: string;
    price?: number | null;
    who?: string;
    status?: string | null;
    orderDate?: string | null;
    deliveryDate?: string | null;
  } = {},
): Promise<Purchases[]> {
  try {
    const { tables, config, account } = await getAppwriteInstances();
    const user = await account.get();

    // 🔥 NOUVEAU: Récupérer les permissions depuis l'événement (inclut les teams)
    const event = eventsStore.getEventById(mainId);
    const eventPermissions = getEventPermissionsFromEvent(event);

    const purchases: Purchases[] = [];

    console.log("[Appwrite product] Debug createQuickValidationPurchases:", {
      mainId,
      productId,
      productIdType: typeof productId,
      quantities,
      options,
    });

    const purchaseStatus = options.status || "delivered";
    let deliveryDate = options.deliveryDate || null;

    // Auto-date de livraison si "delivered" et pas de date fournie
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    for (const qty of quantities) {
      const purchaseData = {
        products: [productId],
        mainId: mainId,
        quantity: qty.q,
        unit: qty.u,
        status: purchaseStatus,
        notes:
          options.notes ||
          `Validation rapide ${new Date().toLocaleDateString("fr-FR")}`,
        store: options.store ?? null,
        who: options.who || user.name,
        price: options.price || null,
        orderDate: options.orderDate || null,
        deliveryDate,
        createdBy: user.$id,
        invoiceId: options.invoiceId,
        invoiceTotal: null,
      };

      const response = await tables.createRow(
        config.databaseId,
        config.collections.purchases,
        ID.unique(),
        purchaseData,
        eventPermissions, // ← Inclut les labels ET les teams
      );

      purchases.push(response as unknown as Purchases);
    }

    console.log(
      `[Appwrite product] ${purchases.length} validations rapides créées avec permissions (labels + teams) pour produit ${productId}`,
    );
    return purchases;
  } catch (error) {
    console.error(
      "[Appwrite product] Erreur création validation rapide:",
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec de la validation rapide: ${errorMessage}`);
  }
}

/**
 * Crée une dépense générale (sans produits liés)
 * @param mainId - ID de l'événement principal
 * @param expenseData - Données de la dépense
 * @returns Promise<Purchases>
 */
export async function createExpensePurchase(
  mainId: string,
  invoiceId?: string,
  invoiceTotal?: number,
  store?: string,
  notes?: string,
  who?: string,
): Promise<Purchases> {
  try {
    const { tables, config, account } = await getAppwriteInstances();
    const user = await account.get();

    // Générer un invoiceId si non fourni
    const finalInvoiceId = invoiceId || ID.unique();

    // Utiliser le nom de l'utilisateur courant comme "who" par défaut
    const who = user.name;

    if (!invoiceTotal) {
      throw new Error("invoiceTotal est requis pour une dépense");
    }

    // 🔥 NOUVEAU: Récupérer les permissions depuis l'événement (inclut les teams)
    const event = eventsStore.getEventById(mainId);
    const eventPermissions = getEventPermissionsFromEvent(event);

    const completeExpenseData = {
      products: [], // Pas de produits liés
      mainId: mainId,
      quantity: 1,
      unit: "global",
      status: "expense",
      notes: notes || "",
      store: store ?? null,
      who: who || user.name,
      price: invoiceTotal,
      invoiceId: finalInvoiceId,
      invoiceTotal: invoiceTotal,
      orderDate: null,
      deliveryDate: new Date().toISOString(),
      createdBy: user.$id,
    };

    const response = await tables.createRow(
      config.databaseId,
      config.collections.purchases,
      ID.unique(),
      completeExpenseData,
      eventPermissions, // ← Inclut les labels ET les teams
    );

    console.log(
      "[Appwrite product] Dépense créée avec permissions (labels + teams):",
      response,
    );
    return response as unknown as Purchases;
  } catch (error) {
    console.error("[Appwrite product] Erreur création dépense:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    throw new Error(`Échec de la création de la dépense: ${errorMessage}`);
  }
}

/**
 * Charge les achats orphelins (dépenses globales)
 * @param mainId - ID de l'événement principal
 * @returns Promise<Purchases[]>
 */
export async function loadOrphanPurchases(
  mainId: string,
): Promise<Purchases[]> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const response = await tables.listRows(
      config.databaseId,
      config.collections.purchases,
      [
        Query.equal("mainId", mainId),
        Query.equal("status", "expense"),
        Query.limit(1000), // Limite raisonnable pour les dépenses
      ],
    );

    console.log(
      `[Appwrite product] ${response.rows.length} dépenses globales chargées`,
    );
    return response.rows as unknown as Purchases[];
  } catch (error) {
    console.error(
      "[Appwrite product] Erreur chargement dépenses globales:",
      error,
    );
    return [];
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Services main

  // Services realtime
  subscribeToRealtime,

  // Services produits - mise à jour
  updateProduct,

  // Services produits - modification groupée

  // Services achats
  createPurchase,
  createExpensePurchase,
  loadOrphanPurchases,
  updatePurchase,
  deletePurchase,

  // Utilitaires de merge
  // mergeProductsWithPurchases,
  applyProductUpdates,

  // Utilitaires de parsing
  formatStockData,
  parseStockData,
};
