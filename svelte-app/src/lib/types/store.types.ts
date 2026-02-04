import type { Main, Products, Purchases } from "./appwrite.d";

/**
 * Types pour les statuts d'achat
 */
export type PurchaseStatus =
  | "requested" // Contacté fournisseur, attente confirmation
  | "ordered" // Confirmé par fournisseur
  | "pending" // Date livraison atteinte, attente réception
  | "delivered" // Reçu confirmé
  | "cancelled" // Annulé
  | null; // Compatibilité (achat direct)

/**
 * Statistiques unifiées par produit pour une plage de dates
 * Optimisation : 1 seule itération pour calculer toutes les données
 */
export interface ProductRangeStats {
  /** Quantités nécessaires (calculées) - format court */
  quantities: NumericQuantity[];
  /** Quantités formatées pour affichage */
  formattedQuantities: string;
  /** Nombre de recettes dans la plage */
  nbRecipes: number;
  /** Total d'assiettes dans la plage */
  totalAssiettes: number;

  /** Résultat brut du calcul de stock (positifs ET négatifs) */
  stockResult: NumericQuantity[];
  /** Quantités disponibles (uniquement positifs) */
  availableQuantities: NumericQuantity[];
  /** Quantités manquantes (valeurs absolues des négatifs) */
  missingQuantities: NumericQuantity[];

  formattedMissingQuantities: string;
  /** Résultat formaté pour affichage */
  formattedAvailableQuantities: string;
  /** Indique si le produit a des quantités disponibles */
  hasAvailable: boolean;
  /** Indique si le produit a des quantités manquantes */
  hasMissing: boolean;

  /** Dates où le produit est utilisé dans la plage (triées chronologiquement) */
  concernedDates: string[];
  /** Recettes par date pour les dates dans la plage */
  recipesByDate: Map<string, RecipeOccurrence[]>;
}

/** Format long pour les formulaires et états */
export type FormQuantity = {
  quantity: number;
  unit: string;
};

/**
 * Types pour la gestion des événements principaux
 */
export interface MainEventData {
  $id: string;
  mainId: string;
  name: string;
  allDates: string;
}

/**
 * Types pour la gestion des magasins
 */

export interface StoreInfo {
  storeName: string;
  storeComment?: string;
}

/**
 * Types pour les quantités
 */
export interface QuantityInfo {
  quantity: string;
  unit: string;
}

/**
 * Types pour le besoin consolidé par date
 */
export interface NeededConsolidated {
  dateTimeService: string;
  neededConsolidatedForDate: QuantityInfo[];
  needRawForDate: QuantityInfo[];
  conversionRules: string[];
  recipeNames: string[];
  totalAssiettes: number;
}

/**
 * Type pour l'entrée de stock (uniquement)
 */
export interface StockEntry {
  quantity: string;
  unit: string;
  notes: string;
  dateTime: string;
}

/**
 * Types pour les quantités avec valeur numérique (pour les calculs)
 */
export interface NumericQuantity {
  q: number;
  u: string;
}

/**
 * Type pour le total nécessaire Manuellement redéfini par l'utilisateur (stocké dans Appwrite)
 */
export interface TotalNeededOverrideData {
  // L'override manuel
  totalOverride: NumericQuantity;
  comment: string;

  // Snapshot du contexte AU MOMENT de l'override
  // Permet de détecter si les recettes/couverts ont changé depuis
  totalComputedWhenOverride: NumericQuantity[]; // Calcul automatique à ce moment-là
  platesNbWhenOverride: number; // Nombre total de couverts (totalAssiettes)
  recipesNbWhenOverride: number; // Nombre de recettes utilisées (nbRecipes)
}

// ✅ EnrichedProduct = Données BRUTES Appwrite + Hugo statiques + Calculées
export interface EnrichedProduct {
  // MÉTADONNÉES APPWRITE (brutes)
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
  $databaseId?: string;
  $sequence?: number;
  $tableId?: string;

  // DONNÉES MÉTIER DE BASE (brutes Appwrite / Hugo)
  productHugoUuid: string | null;
  productName: string;
  productType: string;
  pF: boolean;
  pS: boolean;
  nbRecipes: number;
  totalAssiettes: number;
  isSynced: boolean;
  mainId: Main | string; // ou Main (géré au sync)
  totalNeededRaw: NumericQuantity[];

  // DONNÉES INTERACTIVES / COLLABORATIVES (brutes Appwrite)
  status: string;
  who: string[] | null;
  store: string; // ← Brut JSON
  stockReel: string | null; // ← Brut JSON
  previousNames: string[] | null;
  isMerged: boolean;
  mergedFrom: string[] | null;
  mergeDate: string | null;
  mergeReason: string | null;
  mergedInto: string | null;
  totalNeededOverride: string | null; // ← Brut JSON

  // RELATIONS (brutes Appwrite)
  purchases: Purchases[];

  // DONNÉES STATIQUES HUGO (jamais modifiées, locales)
  byDate: Record<string, ByDateEntry>;
  // DONNÉES CALCULÉES/PARSÉES (pour l'UI, dérivées des brutes)
  storeInfo: StoreInfo | null; // Parsé de store
  stockParsed: StockEntry | null; // Parsé de stockReel
  totalNeededArray: NumericQuantity[]; // Calculé de byDateParsed
  totalPurchasesArray: NumericQuantity[]; // Calculé de purchases
  missingQuantityArray: NumericQuantity[]; // Calculé
  stockOrTotalPurchases: string; // Calculé
  displayTotalNeeded: string; // Formaté pour UI
  displayTotalPurchases: string; // Formaté pour UI
  displayMissingQuantity: string; // Formaté pour UI
  displayTotalOverride: string; // Formaté pour UI depuis totalNeededOverride
  totalNeededOverrideParsed: TotalNeededOverrideData | null; // Parsé de totalNeededOverride

  // Informations d'affichage des dates précalculées
  dateDisplayInfo: Record<string, DateDisplayInfo>; // Map dateStr → displayInfo

  // Specs pour produits manuels
  specs: string | null;
  specsParsed: ManualSpecs | null;
}

export interface ManualSpecs {
  quantity?: NumericQuantity;
  pF?: boolean;
  pS?: boolean;
}

/**
 * Interface pour les informations d'affichage de date précalculées
 */
export interface DateDisplayInfo {
  formattedDate: string; // Date formatée "lun 23"
  timeIcon: "sun" | "moon" | "cloud" | null; // Icône horaire
}

/**
 * Type pour le formulaire d'achat
 */
export interface PurchaseFormData {
  quantity: number | null;
  unit: string;
  store: string;
  who: string;
  price: number | null;
  notes: string;
  status: "ordered" | "delivered" | null;
  orderDate: string | null;
  deliveryDate: string | null;
}

/**
 * Type pour le formulaire de stock
 */
export interface StockFormData {
  quantity: number | null;
  unit: string;
  notes: string;
  dateTime: string;
}

/**
 * Type pour le formulaire de magasin
 */
export interface StoreFormData {
  name: string | null;
  comment: string | null;
}

/**
 * Type pour le formulaire de volontaire
 */
export type WhoFormData = string[];

/**
 * Type pour tous les formulaires
 */
export interface ModalForms {
  purchase: PurchaseFormData;
  stock: StockFormData;
  store: StoreFormData;
  who: WhoFormData;
}

import { ProductModel } from "../models/ProductModel.svelte";

/**
 * Type principal pour ProductModalState
 * Utilisation : const modalState: ProductModalStateType = createProductModalState(productId);
 */
export interface ProductModalStateType {
  // État UI
  readonly loading: boolean;
  readonly error: string | null;

  // Données du produit (dérivées du store)
  readonly product: EnrichedProduct | null;
  readonly productModel: ProductModel | null;
  readonly recipes: RecipeWithDate[];
  readonly whoList: string[];
  readonly stockParsed: StockEntry | null;
  readonly purchasesList: Purchases[];

  // État d'édition
  readonly editingPurchaseId: string | null;
  readonly editingPurchaseData: Purchases | null;

  // Formulaires locaux
  readonly forms: ModalForms;

  // États UI pour les composants
  readonly uiStates: {
    overrideManagerEditMode: boolean;
  };

  // Gestion de l'onglet courant
  readonly currentTab: string;
  setCurrentTab(tab: string): void;

  // Actions - Purchases
  addPurchase(): Promise<void>;
  startEditPurchase(purchase: Purchases): void;
  cancelEditPurchase(): void;
  updateEditedPurchase(purchase: Purchases): Promise<void>;
  removePurchase(purchaseId: string): Promise<void>;

  // Actions - Stock
  setStock(): Promise<void>;
  removeStock(): Promise<void>;

  // Actions - Volunteers
  setWho(newWhoList: string[]): Promise<void>;

  // Actions - Store
  updateStore(storeInfo: StoreInfo): Promise<void>;

  // Actions - Override
  setOverride(overrideData: TotalNeededOverrideData): Promise<void>;
  removeOverride(): Promise<void>;

  // Sauvegarde globale et suivi des changements
  saveAllChanges(): Promise<void>;
  readonly hasChanges: {
    store: boolean;
    stock: boolean;
    who: boolean;
  };
  readonly hasAnyChanges: boolean;

  // Réinitialisation
  resetForms(): void;

  // Utilitaires
  formatQuantity(quantity: number, unit: string): string;
  formatDate(dateString: string): string;

  // Validation
  readonly isPurchaseFormValid: boolean;
  readonly isStockFormValid: boolean;
}

// Types pour les données brutes venant de Appwrite (non enrichies)
export interface ProductData {
  $productType: string;
  assiettes: number; // Assiettes de cet ingredient dans la recette
  ingredient: string; // Nom de l'ingredient
  name: string;
  poids: string; // Poids en gr. ou ml
  quantite: string;
  recette: string; // Nom de la recette
  team: string; // Nom de l'équipe (si applicable)
  unit: string;
  uuid: string;
}

// ✅ NOUVEAUX : Types pour la structure byDate
export interface RecipeOccurrence {
  r: string; // recipeName
  q: number; // quantité brute (optionnel, si différent de qEq)
  u: string; // unité brute (optionnel, si différent de uEq)
  qEq: number; // quantité équivalente (convertie)
  uEq: string; // unité équivalente
  a: number; // assiettes
  cRule?: string; // conversion rule (optionnel)
}

export interface ByDateEntry {
  totalConsolidated: NumericQuantity[];
  recipes: RecipeOccurrence[];
  totalAssiettes: number;
  recipeCount: number;
  // totalRaw est optionnel, seulement si conversions
  totalRaw?: NumericQuantity[];
}

export interface RecipeWithDate extends RecipeOccurrence {
  date: string; // ✅ Date du service
  dateTimeService: string; // ✅ Date ISO complète
}

// =============================================================================
// TYPES POUR LA MODIFICATION GROUPÉE
// =============================================================================

export type GroupEditType = "store" | "who";

export interface GroupEditOptions {
  mode?: "replace" | "add"; // Mode d'application pour les champs de type tableau
}

export interface GroupEditFormData {
  // Store data
  storeName: string;
  storeComment: string;

  // Who data
  whoNames: string[];
}

export interface GroupEditState {
  readonly productIds: string[];
  readonly products: EnrichedProduct[];
  readonly editType: GroupEditType;
  readonly loading: boolean;
  readonly error: string | null;
  readonly result: BatchUpdateResult | null;

  // Form data
  formData: GroupEditFormData;

  // Actions
  updateFormData(data: Partial<GroupEditFormData>): void;
  submitUpdate(): Promise<BatchUpdateResult>;
  reset(): void;
}

export interface BatchUpdateResult {
  success: boolean;
  transactionId?: string;
  updatedCount: number;
  updateType: string;
  error?: string;
  timestamp: string;
}

export interface GroupEditModalProps {
  productIds: string[];
  products: EnrichedProduct[];
  editType: GroupEditType;
  onClose: () => void;
  onSuccess?: (result: BatchUpdateResult) => void;
}
