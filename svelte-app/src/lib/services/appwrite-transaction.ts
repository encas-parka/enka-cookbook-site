// =============================================================================
// SERVICES D'ACHAT GROUPÉ AVEC SYNC
// =============================================================================
import { executeWithRetry } from "../utils/retry.utils";
import { getAppwriteInstances, getAppwriteConfig } from "./appwrite";

export interface GroupPurchaseProductData {
  productId: string;
  isSynced: boolean;
  missingQuantities: Array<{ q: number; u: string }>;
}

export interface GroupPurchaseInvoiceData {
  invoiceId: string;
  invoiceTotal?: number;
  store?: string;
  notes?: string;
  who?: string;
  purchaseStatus?: string | null; // Statut des achats groupés
  purchaseDeliveryDate?: string | null; // Date de livraison pour les achats
}

// 🔧 Données d'achat simplifiées pour la fonction cloud
export interface GroupPurchaseData {
  productId: string;
  quantity: number;
  unit: string;
  status?: string;
  notes?: string;
  store?: string;
  who?: string;
  deliveryDate?: string | null;
  createdBy?: string | null;
}

export interface GroupPurchaseResult {
  success: boolean;
  transactionId?: string;
  productsCreated: number;
  purchasesCreated: number;
  expenseCreated: boolean;
  totalOperations: number;
  invoiceId: string;
  error?: string;
  timestamp: string;
}

export interface GroupPurchaseBatchResult {
  success: boolean;
  results: GroupPurchaseResult[];
  totalProductsCreated: number;
  totalPurchasesCreated: number;
  totalExpensesCreated: number;
  error?: string;
}

/**
 * Calcule le nombre total d'achats à créer (purchases + éventuelle expense)
 * @param productsData - Données des produits à traiter
 * @param invoiceData - Données de la facture (pour savoir s'il faut créer une expense)
 * @returns Nombre total d'achats
 */
function calculateTotalPurchases(
  productsData: GroupPurchaseProductData[],
  invoiceData: GroupPurchaseInvoiceData,
): number {
  const purchasesCount = productsData.reduce((total, product) => {
    return total + product.missingQuantities.length;
  }, 0);

  // Ajouter 1 pour l'expense globale si invoiceTotal est défini
  const expenseCount = invoiceData.invoiceTotal ? 1 : 0;

  return purchasesCount + expenseCount;
}

/**
 * Prépare les données pour l'envoi à la fonction cloud
 * @param productsBatch - Lot de produits à traiter
 * @param invoiceData - Données de la facture
 * @param mainId - ID de l'événement principal
 * @returns Données formatées pour la fonction cloud
 */
async function prepareBatchData(
  productsBatch: GroupPurchaseProductData[],
  invoiceData: GroupPurchaseInvoiceData,
  mainId: string,
): Promise<{
  mainId: string;
  purchasesData: GroupPurchaseData[];
  invoiceData: GroupPurchaseInvoiceData;
  fromUserId: string;
}> {
  // Récupérer l'utilisateur connecté
  let currentUserId: string | null = null;
  try {
    const { account } = await getAppwriteInstances();
    const user = await account.get();
    currentUserId = user.$id;
  } catch (error) {
    console.warn(
      "[Appwrite Transaction] Impossible de récupérer l'utilisateur connecté:",
      error,
    );
  }

  // Préparer les données d'achat avec le statut et deliveryDate fournis
  const purchaseStatus = invoiceData.purchaseStatus || "delivered";
  let deliveryDate = invoiceData.purchaseDeliveryDate || null;

  // 🎯 LOGIQUE : Assigner automatiquement deliveryDate pour les achats livrés sans date
  if (purchaseStatus === "delivered" && !deliveryDate) {
    deliveryDate = new Date().toISOString();
  }

  const purchasesData: GroupPurchaseData[] = productsBatch.flatMap((product) =>
    product.missingQuantities.map((quantity) => ({
      productId: product.productId,
      quantity: quantity.q,
      unit: quantity.u,
      status: purchaseStatus,
      notes: invoiceData.notes || "",
      store: invoiceData.store || "",
      who: invoiceData.who || undefined,
      price: undefined, // Gardé pour cohérence (sera null dans Appwrite)
      orderDate: null, // Sera généré par la fonction cloud
      deliveryDate,
      createdBy: currentUserId,
    })),
  );

  return {
    mainId,
    purchasesData,
    invoiceData,
    fromUserId: currentUserId || "",
  };
}

/**
 * Découpe les produits en lots respectant la limite de 100 achats par lot
 * @param productsData - Tous les produits à traiter
 * @param invoiceData - Données de la facture
 * @param maxPurchasesPerBatch - Limite de purchases par lot (défaut: 100)
 * @returns Lots de produits
 */
function splitIntoBatches(
  productsData: GroupPurchaseProductData[],
  invoiceData: GroupPurchaseInvoiceData,
  maxPurchasesPerBatch = 98,
): GroupPurchaseProductData[][] {
  const batches: GroupPurchaseProductData[][] = [];
  let currentBatch: GroupPurchaseProductData[] = [];
  let currentBatchPurchases = 0;

  // L'expense globale compte dans le premier lot
  const hasExpense = !!invoiceData.invoiceTotal;
  let expenseAdded = false;

  for (const product of productsData) {
    const purchaseCount = product.missingQuantities.length;

    // Vérifier si on peut ajouter ce produit au lot actuel
    let wouldExceedLimit =
      currentBatchPurchases + purchaseCount > maxPurchasesPerBatch;

    // Si on n'a pas encore ajouté l'expense et qu'on a de la place, on réserve la place
    if (hasExpense && !expenseAdded && currentBatch.length > 0) {
      wouldExceedLimit =
        currentBatchPurchases + purchaseCount + 1 > maxPurchasesPerBatch;
    }

    if (wouldExceedLimit && currentBatch.length > 0) {
      // Démarrer un nouveau lot
      batches.push(currentBatch);
      currentBatch = [product];
      currentBatchPurchases = purchaseCount;
      expenseAdded = false; // L'expense sera ajoutée dans le prochain lot si nécessaire
    } else {
      // Ajouter au lot actuel
      currentBatch.push(product);
      currentBatchPurchases += purchaseCount;
    }
  }

  // Ajouter le dernier lot
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Exécute un lot d'achat groupé via la fonction cloud
 * @param batchData - Données du lot à exécuter
 * @returns Promise<GroupPurchaseResult> - Résultat du lot
 */
async function executeGroupPurchaseBatch(batchData: {
  mainId: string;
  purchasesData: GroupPurchaseData[];
  invoiceData: GroupPurchaseInvoiceData;
  fromUserId: string;
}): Promise<GroupPurchaseResult> {
  try {
    const config = getAppwriteConfig();
    const { functions } = await getAppwriteInstances();

    const payload = {
      operation: "createGroupPurchaseWithSync",
      data: batchData,
    };

    console.log(
      `[Appwrite Interactions] Exécution du lot: ${batchData.purchasesData.length} achats à créer`,
    );

    const execution = await functions.createExecution(
      config.APPWRITE_CONFIG.functions.batchUpdate,
      JSON.stringify(payload),
      false, // async = false pour attendre le résultat
      "/",
      "POST" as any,
    );

    if (execution.status !== "completed") {
      throw new Error(`Exécution échouée avec statut: ${execution.status}.`);
    }

    const result = JSON.parse(execution.responseBody) as GroupPurchaseResult;

    if (result.success) {
      console.log(
        `[Appwrite Interactions] Lot exécuté avec succès: ${result.purchasesCreated} achats créés`,
      );
    } else {
      console.error(`[Appwrite Interactions] Lot échoué:`, result.error);
    }

    return result;
  } catch (error) {
    console.error("[Appwrite Interactions] Erreur exécution lot:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";

    return {
      success: false,
      productsCreated: 0,
      purchasesCreated: 0,
      expenseCreated: false,
      totalOperations: 0,
      invoiceId: batchData.invoiceData.invoiceId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Crée des achats groupés avec synchronisation de produits
 *
 * Service principal pour les achats groupés. Gère automatiquement la limitation
 * des 100 opérations par transaction Appwrite en divisant l'opération en lots.
 *
 * @param mainId - ID de l'événement principal
 * @param productsData - Données des produits avec leurs quantités manquantes
 * @param invoiceData - Données de la facture commune
 * @returns Promise<GroupPurchaseBatchResult> - Résultat de l'opération groupée
 *
 * Flux :
 * 1. Validation des données d'entrée
 * 2. Calcul du nombre total d'achats (purchases + expense)
 * 3. Découpage en lots de 100 achats maximum
 * 4. Exécution séquentielle de chaque lot avec retry automatique
 * 5. Agrégation des résultats
 */
export async function createGroupPurchaseWithSync(
  mainId: string,
  productsData: GroupPurchaseProductData[],
  invoiceData: GroupPurchaseInvoiceData,
): Promise<GroupPurchaseBatchResult> {
  // 1. Validation
  if (!productsData?.length) {
    return {
      success: false,
      results: [],
      totalProductsCreated: 0,
      totalPurchasesCreated: 0,
      totalExpensesCreated: 0,
      error: "Aucun produit à traiter",
    };
  }

  // 2. Calculer le nombre total d'achats
  const totalPurchases = calculateTotalPurchases(productsData, invoiceData);
  console.log(
    `[Appwrite Interactions] Achat groupé: ${productsData.length} produits, ${totalPurchases} achats à créer`,
  );

  // 3. Diviser en lots de 100 achats maximum
  const batches = splitIntoBatches(productsData, invoiceData, 98);

  console.log(
    `[Appwrite Interactions] Découpage en ${batches.length} lot(s) pour respecter la limite de 100 achats par lot`,
  );

  // 4. Exécuter chaque lot séquentiellement
  const results: GroupPurchaseResult[] = [];
  let totalProductsCreated = 0;
  let totalPurchasesCreated = 0;
  let totalExpensesCreated = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `[Appwrite Interactions] Exécution du lot ${i + 1}/${batches.length} (${batch.length} produits)`,
    );

    try {
      const batchData = await prepareBatchData(batch, invoiceData, mainId);

      // 🔄 RETRY LOGIC
      const result = await executeWithRetry(
        () => executeGroupPurchaseBatch(batchData),
        {
          operationName: `Lot ${i + 1}/${batches.length}`,
          maxAutoRetries: 1,
          autoRetryDelay: 2000,
        },
      );

      if (!result) {
        throw new Error("Opération annulée ou échouée après tentatives");
      }

      results.push(result);

      if (result.success) {
        totalProductsCreated += result.productsCreated;
        totalPurchasesCreated += result.purchasesCreated;
        totalExpensesCreated += result.expenseCreated ? 1 : 0;
      } else {
        // Arrêter en cas d'erreur sur un lot
        console.error(
          `[Appwrite Interactions] Erreur sur le lot ${i + 1}: ${result.error}`,
        );
        break;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      console.error(
        `[Appwrite Interactions] Erreur lors de l'exécution du lot ${i + 1}:`,
        error,
      );

      results.push({
        success: false,
        productsCreated: 0,
        purchasesCreated: 0,
        expenseCreated: false,
        totalOperations: 0,
        invoiceId: invoiceData.invoiceId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      } as GroupPurchaseResult);

      break; // Arrêter en cas d'erreur
    }
  }

  const success = results.every((r) => r.success);
  const hasError = results.some((r) => !r.success);

  return {
    success,
    results,
    totalProductsCreated,
    totalPurchasesCreated,
    totalExpensesCreated,
    error: hasError ? "Un ou plusieurs lots ont échoué" : undefined,
  };
}
