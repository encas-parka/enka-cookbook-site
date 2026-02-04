<script lang="ts">
  import { TriangleAlert, Check, ShoppingCart, X } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type { EnrichedProduct } from "$lib/types/store.types";
  import { formatDateWdDayMonthShort } from "$lib/utils/date-helpers";
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import InfoCollapse from "../ui/InfoCollapse.svelte";
  import StoreInput from "../ui/StoreInput.svelte";
  import WhoInput from "../ui/WhoInput.svelte";
  import CommentTextarea from "../ui/CommentTextarea.svelte";
  import PriceInput from "../ui/PriceInput.svelte";
  import StatusSelect from "../ui/StatusSelect.svelte";

  // Modal Components
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  interface Props {
    products: EnrichedProduct[];
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { products, onClose, onSuccess }: Props = $props();

  // État local du modal
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Données du formulaire
  let formData = $state({
    store: "",
    who: "",
    expense: null as number | null,
    notes: "",
    status: "delivered" as "ordered" | "delivered" | null,
    deliveryDate: null as string | null,
  });

  // État des produits actifs/inactifs
  let activeProductIds = $state<Set<string>>(new Set());

  $effect(() => {
    activeProductIds = new Set(products.map((p) => p.$id));
  });

  const activeProducts = $derived(
    products.filter((p) => activeProductIds.has(p.$id)),
  );

  const isFormValid = $derived.by(() => {
    if (activeProducts.length === 0) return false;
    return true;
  });

  const title = $derived.by(() => {
    const dateRange = productsStore.dateRange;
    let dateText = "";

    if (dateRange?.start && dateRange?.end) {
      if (dateRange.start === dateRange.end) {
        dateText = ` - ${formatDateWdDayMonthShort(dateRange.start)}`;
      } else {
        dateText = ` - Du ${formatDateWdDayMonthShort(dateRange.start)} au ${formatDateWdDayMonthShort(dateRange.end)}`;
      }
    }

    return `Achat groupé (${activeProducts.length} produit${activeProducts.length > 1 ? "s" : ""})${dateText}`;
  });

  async function handleSubmit() {
    if (!isFormValid || loading) return;

    loading = true;
    error = null;

    const invoiceId = `FACTURE_${Date.now()}`;
    const productIds = activeProducts.map((p) => p.$id);
    productsStore.setSyncStatus(productIds, true);

    globalState.backgroundOperation = {
      isRunning: true,
      name: `Achat groupé (${activeProducts.length} produits)`,
      progress: 0,
    };

    const productsData: Array<{
      productId: string;
      isSynced: boolean;
      missingQuantities: Array<{ q: number; u: string }>;
    }> = [];

    for (const product of activeProducts) {
      const productModel = productsStore.getProductModelById(product.$id);
      const missingQuantities = (productModel?.stats.missingQuantities || [])
        .filter((qty) => qty.q < 0)
        .map((qty) => ({ q: Math.abs(qty.q), u: qty.u }));

      productsData.push({
        productId: product.$id,
        isSynced: product.isSynced,
        missingQuantities,
      });
    }

    const invoiceData = {
      invoiceId,
      invoiceTotal: formData.expense || undefined,
      store: formData.store.trim() || undefined,
      notes:
        formData.notes || `Achat groupé pour ${activeProducts.length} produits`,
      who: formData.who.trim() || undefined,
      purchaseStatus: formData.status || "delivered",
      purchaseDeliveryDate: formData.deliveryDate || null,
    };

    console.log(
      `[GroupPurchaseModal] Création achat groupé avec sync pour ${productsData.length} produits...`,
    );

    onClose();

    try {
      await toastService.track(
        productsStore
          .createGroupPurchase(productsData, invoiceData)
          .then((batchResult) => {
            console.log(
              `[GroupPurchaseModal] Achat groupé créé: ${batchResult.success ? "succès" : "échec"}, ${batchResult.totalProductsCreated} produits synchronisés, ${batchResult.totalPurchasesCreated} achats créés, ${batchResult.totalExpensesCreated} dépenses globales`,
            );

            if (!batchResult.success) {
              throw new Error(
                batchResult.error ||
                  "Erreur lors de la création de l'achat groupé",
              );
            }

            // Clear sync status on success (fallback in case notification doesn't arrive)
            productsStore.clearSyncStatus();
            console.log(
              "[GroupPurchaseModal] ✅ Sync status cleared on success",
            );

            onSuccess?.();
            return batchResult;
          }),
        {
          loading: `Création de l'achat groupé en cours...`,
          success: "Achat groupé créé avec succès",
          error: "Erreur lors de la création de l'achat groupé",
        },
      );
    } catch (error) {
      console.error(
        "[GroupPurchaseModal] Erreur création achat groupé:",
        error,
      );
      productsStore.clearSyncStatus();
    } finally {
      loading = false;
      globalState.backgroundOperation = {
        isRunning: false,
        name: "",
        progress: 0,
      };
    }
  }

  function handleToggleProduct(productId: string) {
    const newActiveIds = new Set(activeProductIds);
    if (newActiveIds.has(productId)) {
      newActiveIds.delete(productId);
    } else {
      newActiveIds.add(productId);
    }
    activeProductIds = newActiveIds;
  }

  const badgeItems = $derived(
    products.map((product) => {
      const productModel = productsStore.getProductModelById(product.$id);
      return {
        id: product.$id,
        label: product.productName,
        title: `${product.productName} - Manque: ${productModel?.stats.formattedMissingQuantities || "-"}`,
        badge: productModel?.stats.formattedMissingQuantities || "-",
      };
    }),
  );
</script>

<ModalContainer
  isOpen={true}
  {onClose}
  hasUnsavedChanges={false}
  fullscreenOnMobile={true}
>
  <ModalHeader {title} showBackButton={true} {onClose} />

  <ModalContent>
    <div class="space-y-6">
      <!-- Erreur -->
      {#if error}
        <div class="alert alert-error">
          <TriangleAlert class="h-4 w-4" />
          <span>{error}</span>
        </div>
      {/if}

      <!-- InfoCollapse -->
      <div>
        <InfoCollapse
          contentVisible="Un 'achat' sera créé avec les quantités manquantes pour chaque produit sur la période sélectionnée."
          class="bg-base-200"
        >
          <p>
            Cette fonctionnalité permet de créer un achat groupé pour plusieurs
            produits en une seule fois. Les quantités déclarées dans les achats
            correspondront aux quantités manquantes <strong
              >pour la période sélectionnée</strong
            >, c'est à dire le besoin total pour chaque produit sur cette
            période moins les achats ou stocks déjà déclarés.
          </p>
          <p>
            Pour le suivi des dépenses, vous pouvez renseigner votre nom et le
            montant dépensé.
          </p>
        </InfoCollapse>
      </div>

      <!-- Formulaire d'achat -->
      <div class="space-y-4">
        <h4 class="font-medium">Détails de l'achat</h4>

        <div class="flex flex-col gap-4 sm:flex-row">
          <!-- Magasin -->
          <div class="flex-1">
            <StoreInput
              bind:value={formData.store}
              suggestions={productsStore.uniqueStores}
              disabled={loading}
            />
          </div>

          <!-- Qui -->
          <div class="flex-1">
            <WhoInput
              bind:value={formData.who}
              suggestions={productsStore.uniqueWho}
              disabled={loading}
            />
          </div>
        </div>

        <!-- Dépense -->
        <PriceInput bind:value={formData.expense} disabled={loading} />

        <!-- Statut -->
        <StatusSelect
          bind:status={formData.status}
          bind:deliveryDate={formData.deliveryDate}
          disabled={loading}
        />

        <!-- Notes -->
        <CommentTextarea bind:value={formData.notes} disabled={loading} />
      </div>

      <!-- Liste des produits -->
      {#if badgeItems.length > 0}
        <div>
          <h4 class="mb-2 font-medium">Produits concernés</h4>
          <div class="text-base-content/70 mb-4 text-sm">
            Les quantités manquantes du
            <span class="badge badge-info badge-sm">
              {formatDateWdDayMonthShort(productsStore.dateRange.start)}
            </span>
            au
            <span class="badge badge-info badge-sm">
              {formatDateWdDayMonthShort(productsStore.dateRange.end)}
            </span>
            pour les produits suivants seront déclarées "achetées"
          </div>
          <BtnGroupCheck
            items={badgeItems}
            onToggleItem={handleToggleProduct}
            size="sm"
            color="success"
          />
        </div>
      {:else}
        <div class="alert alert-warning alert-soft font-medium">
          Aucun besoin dans le groupe séléctionné
        </div>
      {/if}
    </div>
  </ModalContent>

  <ModalFooter>
    <div class="flex">
      <button class="btn btn-ghost" onclick={onClose} disabled={loading}>
        Annuler
      </button>

      <button
        class="btn btn-primary"
        onclick={handleSubmit}
        disabled={loading || !isFormValid}
      >
        {#if loading}
          <span class="loading loading-spinner loading-sm"></span>
          En cours...
        {:else}
          <ShoppingCart class="h-4 w-4" />
          <span
            >Valider <span class="hidden sm:inline"
              >{activeProducts.length} produit{activeProducts.length > 1
                ? "s"
                : ""}</span
            ></span
          >
        {/if}
      </button>
    </div>
  </ModalFooter>
</ModalContainer>
