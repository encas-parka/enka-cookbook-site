import { generateRecipesWithDates } from "../utils/productsUtils";
import type { Purchases } from "../types/appwrite";
import type {
  EnrichedProduct,
  StoreInfo,
  TotalNeededOverrideData,
  ProductModalStateType,
  ModalForms,
} from "../types/store.types";
import { formatDate } from "../utils/products-display";
import {
  formatSingleQuantity,
  convertAndFormatQuantity,
} from "../utils/QuantityFormatter";
import { UnitConverter } from "../utils/UnitConverter";
import { globalState } from "./GlobalState.svelte";
import { productsStore } from "./ProductsStore.svelte";

/**
 * ProductModalState - Responsabilités UNIQUEMENT :
 * 1. Gestion des formulaires locaux (purchase, stock, etc.)
 * 2. Gestion de l'état d'édition (quel item est en cours d'édition)
 * 3. Orchestration des appels Appwrite
 * 4. Gestion du loading/error UI
 *
 * Les données du produit (purchases, recipes, stock, etc.) sont
 * TOUJOURS lues en direct du ProductsStore, jamais copiées.
 */
export class ProductModalState implements ProductModalStateType {
  // État UI
  loading = $state(false);
  error = $state<string | null>(null);

  // État de l'onglet courant
  currentTab = $state("recettes");

  // Données dérivées du store - VIA LE MODEL
  productModel = $derived.by(() => {
    return productsStore.getProductModelById(this.productId);
  });

  product = $derived(this.productModel?.data ?? null);

  whoList = $derived(this.product?.who ?? []);
  stockParsed = $derived(this.product?.stockParsed ?? null);
  purchasesList = $derived(this.product?.purchases ?? []);

  recipes = $derived.by(() => {
    if (!this.product?.byDate) return [];
    return generateRecipesWithDates(this.product.byDate);
  });

  // Formulaires locaux
  forms = $state<ModalForms>({
    purchase: {
      quantity: null,
      unit: "",
      store: "",
      who: globalState.userName ?? "",
      price: null,
      notes: "",
      status: null,
      orderDate: null,
      deliveryDate: null,
    },
    stock: {
      quantity: null,
      unit: "",
      notes: "",
      dateTime: new Date().toISOString(),
    },
    store: {
      name: null,
      comment: null,
    },
    who: [],
  });

  // État UI pour les composants
  uiStates = $state({
    overrideManagerEditMode: false,
  });

  // État d'édition
  editingPurchaseId = $state<string | null>(null);

  editingPurchaseData = $derived.by(() => {
    if (!this.editingPurchaseId) return null;
    return (
      this.purchasesList.find((p) => p.$id === this.editingPurchaseId) ?? null
    );
  });

  // Snapshot pour la détection des changements
  private originalFormsSnapshot = $state<{
    purchase: ModalForms["purchase"];
    stock: ModalForms["stock"];
    store: ModalForms["store"];
    whoList: string[];
  } | null>(null);

  constructor(
    private productId: string,
    initialTab: string = "recettes",
  ) {
    this.currentTab = initialTab;

    // Initialisation immédiate
    this.initForms();
  }

  private initForms() {
    // On utilise le model pour avoir accès aux stats calculées (en fonction de la dateRange globale)
    const model = productsStore.getProductModelById(this.productId);
    if (!model || !model.data) return;

    // Utiliser les stats actuelles pour pré-remplir la quantité manquante
    // Si missingQuantities est vide, on met null
    const firstMissing = model.stats.missingQuantities[0];

    // Les quantités manquantes sont négatives, mais nous voulons les afficher en positif dans le formulaire
    // Et nous voulons convertir automatiquement les unités (gr->kg, ml->l) pour >= 1000
    if (firstMissing) {
      const { value: convertedQty, unit: convertedUnit } =
        convertAndFormatQuantity(Math.abs(firstMissing.q), firstMissing.u);
      this.forms.purchase.quantity = convertedQty;
      this.forms.purchase.unit = convertedUnit;
    } else {
      this.forms.purchase.quantity = null;
      this.forms.purchase.unit = model.data.totalNeededArray?.[0]?.u ?? "";
    }
    this.forms.purchase.store = model.data.storeInfo?.storeName ?? "";
    this.forms.purchase.who = globalState.userName ?? "";
    this.forms.purchase.status = "delivered";

    this.forms.stock.unit = model.data.totalNeededArray?.[0]?.u ?? "";

    this.forms.store.name = model.data.storeInfo?.storeName ?? "";
    this.forms.store.comment = model.data.storeInfo?.storeComment ?? null;

    this.forms.who = model.data.who ? [...model.data.who] : [];

    // Snapshot
    this.originalFormsSnapshot = {
      purchase: { ...this.forms.purchase },
      stock: { ...this.forms.stock },
      store: { ...this.forms.store },
      whoList: [...this.forms.who],
    };
  }

  // Détection des changements
  hasChanges = $derived.by(() => {
    if (!this.originalFormsSnapshot) {
      return { store: false, stock: false, who: false };
    }

    return {
      store:
        this.forms.store.name !== this.originalFormsSnapshot.store.name ||
        this.forms.store.comment !== this.originalFormsSnapshot.store.comment,
      stock: this.hasStockChanges(),
      who:
        JSON.stringify(this.forms.who) !==
        JSON.stringify(this.originalFormsSnapshot.whoList),
    };
  });

  hasAnyChanges = $derived(
    Boolean(
      this.originalFormsSnapshot &&
      (this.hasChanges.store || this.hasChanges.stock || this.hasChanges.who),
    ),
  );

  private hasStockChanges(): boolean {
    if (!this.isStockFormValid) return false;

    if (!this.stockParsed) return true;

    return (
      this.forms.stock.quantity!.toString() !== this.stockParsed.quantity ||
      this.forms.stock.unit !== this.stockParsed.unit ||
      (this.forms.stock.notes || "") !== (this.stockParsed.notes || "")
    );
  }

  // Validation
  get isPurchaseFormValid(): boolean {
    return (
      this.forms.purchase.quantity !== null &&
      this.forms.purchase.quantity !== 0 &&
      (this.forms.purchase.unit?.trim() ?? "") !== ""
    );
  }

  get isStockFormValid(): boolean {
    return (
      this.forms.stock.quantity !== null &&
      this.forms.stock.quantity > 0 &&
      (this.forms.stock.unit?.trim() ?? "") !== ""
    );
  }

  // Actions
  setCurrentTab(tab: string) {
    this.currentTab = tab;
  }

  async addPurchase() {
    if (!this.product) return;

    await this.withLoading(async () => {
      if (!this.forms.purchase.quantity || !this.forms.purchase.unit.trim()) {
        throw new Error("Veuillez remplir les champs obligatoires");
      }

      const { value: quantity, unit: unit } = convertAndFormatQuantity(
        this.forms.purchase.quantity,
        this.forms.purchase.unit,
      );

      const purchaseStatus = this.forms.purchase.status || "delivered";
      let deliveryDate = this.forms.purchase.deliveryDate || null;

      if (purchaseStatus === "delivered" && !deliveryDate) {
        deliveryDate = new Date().toISOString();
      }

      // Normaliser les unités pour le stockage (kg→gr., l.→ml)
      const normalized = UnitConverter.normalize(quantity, unit);
      const normalizedQuantity = normalized.quantity;
      const normalizedUnit = normalized.unit;

      // Utiliser ProductsStore (guard interne local/Appwrite)
      await productsStore.createPurchase(
        this.product!.$id,
        [{ q: normalizedQuantity, u: normalizedUnit }],
        {
          store: this.forms.purchase.store || undefined,
          who: this.forms.purchase.who || undefined,
          notes: this.forms.purchase.notes || "",
          price: this.forms.purchase.price || null,
          status: purchaseStatus,
          orderDate: this.forms.purchase.orderDate || null,
          deliveryDate,
          invoiceId: undefined,
        },
      );

      // Reset form
      const firstMissingAfterAdd = this.product!.missingQuantityArray[0];
      let resetQuantity: number | null = null;
      let resetUnit = this.product!.totalNeededArray[0]?.u ?? "";

      if (firstMissingAfterAdd) {
        const { value: convertedQty, unit: convertedUnit } =
          convertAndFormatQuantity(
            Math.abs(firstMissingAfterAdd.q),
            firstMissingAfterAdd.u,
          );
        resetQuantity = convertedQty;
        resetUnit = convertedUnit;
      }

      this.forms.purchase = {
        quantity: resetQuantity,
        unit: resetUnit,
        store: this.forms.purchase.store,
        who: this.forms.purchase.who,
        price: null,
        notes: "",
        status: null,
        orderDate: null,
        deliveryDate: null,
      };
    }, "Achat ajouté avec succès");
  }

  startEditPurchase(purchase: Purchases) {
    this.editingPurchaseId = purchase.$id;
  }

  cancelEditPurchase() {
    this.editingPurchaseId = null;
  }

  async updateEditedPurchase(updatedPurchase: Purchases) {
    if (!updatedPurchase.$id) return;

    await this.withLoading(async () => {
      // Normaliser les unités pour le stockage (kg→gr., l.→ml)
      const normalized = UnitConverter.normalize(
        updatedPurchase.quantity,
        updatedPurchase.unit,
      );

      const purchaseStatus = updatedPurchase.status || null;
      let deliveryDate = updatedPurchase.deliveryDate || null;

      if (purchaseStatus === "delivered" && !deliveryDate) {
        deliveryDate = new Date().toISOString();
      }

      // Utiliser ProductsStore
      await productsStore.updatePurchase(updatedPurchase.$id, {
        unit: normalized.unit,
        quantity: normalized.quantity,
        store: updatedPurchase.store || null,
        who: updatedPurchase.who || null,
        notes: updatedPurchase.notes || "",
        price: updatedPurchase.price || null,
        status: purchaseStatus,
        orderDate: updatedPurchase.orderDate || null,
        deliveryDate,
      });

      this.editingPurchaseId = null;
    }, "Achat modifié avec succès");
  }

  async removePurchase(purchaseId: string) {
    const purchase = this.purchasesList.find((p) => p.$id === purchaseId);
    if (!purchase) return;

    if (
      !confirm(`Supprimer cet achat (${purchase.quantity} ${purchase.unit}) ?`)
    ) {
      return;
    }

    await this.withLoading(async () => {
      // Utiliser ProductsStore
      await productsStore.deletePurchase(purchaseId);
    }, "Achat supprimé avec succès");
  }

  async setStock() {
    if (!this.product) return;

    await this.withLoading(async () => {
      if (!this.forms.stock.quantity || !this.forms.stock.unit) {
        throw new Error("Veuillez remplir les champs obligatoires");
      }

      // Normaliser les unités pour le stockage (kg→gr., l.→ml)
      const normalized = UnitConverter.normalize(
        this.forms.stock.quantity,
        this.forms.stock.unit,
      );

      const newEntry = {
        quantity: normalized.quantity.toString(),
        unit: normalized.unit,
        notes: this.forms.stock.notes,
        dateTime: this.forms.stock.dateTime,
      };

      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        stockReel: JSON.stringify(newEntry),
      });

      this.forms.stock.quantity = null;
      this.forms.stock.notes = "";
      this.forms.stock.dateTime = new Date().toISOString();
    }, "Stock mis à jour");
  }

  async removeStock() {
    if (!this.product) return;

    if (!confirm("Supprimer le stock actuel ?")) return;

    await this.withLoading(async () => {
      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        stockReel: null,
      });
    }, "Stock supprimé");
  }

  async setWho(newWhoList: string[]) {
    if (!this.product) return;

    await this.withLoading(async () => {
      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        who: newWhoList,
      });
    }, "Volontaires mis à jour");
  }

  async updateStore(storeInfo: StoreInfo) {
    if (!this.product) return;

    await this.withLoading(async () => {
      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        storeInfo,
      });
    }, "Magasin mis à jour");
  }

  async setOverride(overrideData: TotalNeededOverrideData) {
    if (!this.product) return;

    await this.withLoading(async () => {
      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        totalNeededOverride: JSON.stringify(overrideData),
      });
    }, "Override appliqué");
  }

  async removeOverride() {
    if (!this.product) return;

    if (
      !confirm("Supprimer l'override manuel et revenir au calcul automatique ?")
    )
      return;

    await this.withLoading(async () => {
      // Utiliser ProductsStore - updateProduct générique
      await productsStore.updateProduct(this.product!.$id, {
        totalNeededOverride: null,
      });
    }, "Override supprimé");
  }

  async saveAllChanges() {
    if (!this.product || !this.hasAnyChanges) return;

    await this.withLoading(async () => {
      const batchUpdates: any = {};

      if (
        this.hasChanges.stock &&
        this.forms.stock.quantity &&
        this.forms.stock.unit
      ) {
        const newEntry = {
          quantity: this.forms.stock.quantity.toString(),
          unit: this.forms.stock.unit,
          notes: this.forms.stock.notes,
          dateTime: this.forms.stock.dateTime,
        };
        batchUpdates.stockReel = JSON.stringify(newEntry);
      }

      if (this.hasChanges.who) {
        batchUpdates.who = this.forms.who;
      }

      if (this.hasChanges.store) {
        const storeInfo: StoreInfo = {
          storeName: this.forms.store.name || "",
          storeComment: this.forms.store.comment || undefined,
        };
        batchUpdates.storeInfo = storeInfo;
      }

      if (Object.keys(batchUpdates).length > 0) {
        // Utiliser ProductsStore (guard gère le mode)
        await productsStore.updateProductBatch(
          this.product!.$id,
          batchUpdates,
          (id) => productsStore.getEnrichedProductById(id) ?? undefined,
        );

        this.originalFormsSnapshot = {
          purchase: { ...this.forms.purchase },
          stock: { ...this.forms.stock },
          store: { ...this.forms.store },
          whoList: [...this.forms.who],
        };
      }
    }, "Modifications enregistrées");
  }

  resetForms() {
    this.uiStates.overrideManagerEditMode = false;
    this.editingPurchaseId = null;
    // Re-init forms with current product data
    this.initForms();
    console.log("[ProductModalState] Formulaires et états UI réinitialisés");
  }

  // Helpers
  private async withLoading<T>(
    operation: () => Promise<T>,
    successMessage?: string,
  ): Promise<T | null> {
    this.loading = true;
    this.error = null;
    try {
      const result = await operation();
      if (successMessage) {
        this.showToast("success", successMessage);
      }
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue";
      this.error = message;
      this.showToast("error", message);
      console.error("[ProductModalState]", err);
      return null;
    } finally {
      this.loading = false;
    }
  }

  private showToast(type: "success" | "error", message: string) {
    const event = new CustomEvent("toast", {
      detail: { type, message },
    });
    window.dispatchEvent(event);
  }

  // Utilitaires exposés
  formatQuantity = (quantity: number, unit: string) =>
    formatSingleQuantity(quantity, unit);
  formatDate = formatDate;
}
