<script lang="ts">
  import { Store, X, Check, TriangleAlert } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import StoreInput from "../ui/StoreInput.svelte";
  import CommentTextarea from "../ui/CommentTextarea.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import type { BatchUpdateResult, StoreInfo } from "$lib/types/store.types";

  interface Props {
    productIds: string[];
    products: any[];
    onClose: () => void;
    onSuccess?: (result: BatchUpdateResult) => void;
  }

  let { productIds, products, onClose, onSuccess }: Props = $props();

  // État local du modal
  let loading = $state(false);
  let error = $state<string | null>(null);
  let result = $state<BatchUpdateResult | null>(null);

  // État local pour les données du magasin
  // svelte-ignore state_referenced_locally
  let storeName = $state(
    products.length > 0 && products[0].storeInfo
      ? products[0].storeInfo.storeName
      : "",
  );

  // svelte-ignore state_referenced_locally
  let storeComment = $state(
    products.length > 0 && products[0].storeInfo
      ? products[0].storeInfo.storeComment || ""
      : "",
  );

  // État local pour suivre les sélections actuelles (synchronisé avec BtnGroupCheck)
  let currentSelection = $state<Record<string, boolean>>({});

  // État pour le mode de sélection des produits
  let selectionMode = $state<"empty" | "all">("empty");

  // Initialiser la sélection en fonction du mode et des productIds fournis
  $effect(() => {
    const newSelection: Record<string, boolean> = {};
    products.forEach((product) => {
      if (productIds.includes(product.$id)) {
        if (selectionMode === "empty") {
          // Sélectionner les produits sans magasin attribué
          newSelection[product.$id] =
            !product.storeInfo || !product.storeInfo.storeName;
        } else {
          // Sélectionner tous les produits
          newSelection[product.$id] = true;
        }
      }
    });
    currentSelection = newSelection;
  });

  // Préparer les données pour BtnGroupCheck avec état de sélection
  const badgeItems = $derived(
    products.map((product) => ({
      id: product.$id,
      label: product.productName,
      title: product.productName,
      selected: currentSelection[product.$id],
    })),
  );

  // Items actuellement sélectionnés (source de vérité unique)
  const selectedBadgeItems = $derived(
    badgeItems.filter((item) => item.selected),
  );

  const title = $derived(
    `Attribuer un magasin (${selectedBadgeItems.length} produits sélectionnés)`,
  );

  const isFormValid = $derived.by(() => {
    if (selectedBadgeItems.length === 0) return false;
    return storeName.trim().length > 0;
  });

  // Actions
  async function handleSubmit() {
    if (!isFormValid || loading) return;

    error = null;
    result = null;

    // Extraire les données depuis selectedBadgeItems
    const selectedProductIds = selectedBadgeItems.map((item) => item.id);
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.$id),
    );

    // 🚀 UX IMMÉDIAT : Marquer les produits comme "isSyncing"
    productsStore.setSyncStatus(selectedProductIds, true);

    // Signaler l'opération en arrière-plan
    globalState.backgroundOperation = {
      isRunning: true,
      name: `Mise à jour magasin (${selectedProductIds.length} produits)`,
      progress: 0,
    };

    // ⚡ FERMER LE MODAL IMMÉDIATEMENT POUR UX
    onClose();

    const storeInfo: StoreInfo = {
      storeName: storeName.trim(),
      storeComment: storeComment.trim(),
    };

    // Utiliser track() avec des messages statiques pour suivre l'opération après la fermeture du modal
    try {
      const updateResult = await toastService.track(
        productsStore
          .batchUpdateProducts(
            selectedProductIds,
            selectedProducts,
            "store",
            storeInfo,
          )
          .then((result) => {
            // Ajouter les détails dans la console pour le débogage
            console.log(
              `[StoreEditModal] Mise à jour groupée: ${result.success ? "succès" : "échec"}, ${result.updatedCount} produits modifiés`,
            );

            // Vérifier le succès et gérer les erreurs
            if (!result.success) {
              throw new Error(result.error || "Erreur lors de la mise à jour");
            }

            return result;
          }),
        {
          // FIXIT : pas ces message: juste un success "batchupdate ..."
          loading: `Mise à jour du magasin pour ${selectedProductIds.length} produits...`,
          success: "Magasin mis à jour avec succès",
          error: "Erreur lors de la mise à jour du magasin",
        },
      );

      // Notifier le succès callback optionnel
      onSuccess?.(updateResult);
    } catch (error) {
      // L'erreur est déjà affichée dans le toast, mais on nettoie l'état
      console.error("[StoreEditModal] Erreur mise à jour:", error);

      // 🔧 NETTOYAGE : Retirer le statut "isSyncing" en cas d'erreur
      productsStore.clearSyncStatus();
    } finally {
      loading = false;
      // Reset background operation
      globalState.backgroundOperation = {
        isRunning: false,
        name: "",
        progress: 0,
      };
    }
  }

  function handleClose() {
    if (loading) return; // Empêcher la fermeture pendant le chargement
    onClose();
  }

  function handleToggleProduct(productId: string) {
    currentSelection[productId] = !currentSelection[productId];
  }
</script>

<ModalContainer isOpen={true} onClose={handleClose}>
  <ModalHeader {title} onClose={handleClose}>
    <Store class="text-secondary" />
  </ModalHeader>

  <ModalContent>
    <div class="space-y-6">
      <!-- Erreur -->
      {#if error}
        <div class="alert alert-error max-md:alert-vertical">
          <TriangleAlert class="h-4 w-4" />
          <span>{error}</span>
        </div>
      {/if}

      <!-- Formulaire Store -->
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StoreInput
            bind:value={storeName}
            suggestions={productsStore.uniqueStores}
            disabled={loading}
            id="store-name-input"
          />
        </div>

        <div>
          <CommentTextarea
            bind:value={storeComment}
            disabled={loading}
            id="store-comment-textarea"
          />
        </div>
      </div>

      <!-- Liste des produits -->
      <div>
        <h4 class="mb-1 font-medium">Produits concernés</h4>

        <!-- Mode de sélection -->
        <div role="tablist" class="tabs mb-1 flex justify-end">
          <button
            onclick={() => (selectionMode = "empty")}
            class="tab {selectionMode === 'empty' ? 'tab-active' : ''}"
            >Produits sans magasin attribué</button
          >
          <button
            onclick={() => (selectionMode = "all")}
            class="tab {selectionMode === 'all' ? 'tab-active' : ''}"
            >Tous les produits du groupe</button
          >
        </div>

        <BtnGroupCheck
          items={badgeItems}
          onToggleItem={handleToggleProduct}
          size="sm"
          color="success"
        />
      </div>
    </div>
  </ModalContent>

  <ModalFooter>
    <button class="btn btn-ghost" onclick={handleClose} disabled={loading}>
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
        <Check class="h-4 w-4" />
        Appliquer à {selectedBadgeItems.length} produit(s)
      {/if}
    </button>
  </ModalFooter>
</ModalContainer>
