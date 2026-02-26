<script lang="ts">
  import { User, UserPlus, X, Check, TriangleAlert } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import type { BatchUpdateResult } from "$lib/types/store.types";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import WhoInput from "../ui/WhoInput.svelte";

  // Modal Components
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

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

  // État local pour les volontaires
  let whoNames = $state<string[]>([]);
  let newVolunteerName = $state("");

  // État pour le mode de sélection des produits
  let selectionMode = $state<"empty" | "all">("empty");
  let currentSelection = $state<Record<string, boolean>>({});

  // Initialiser la sélection
  $effect(() => {
    const newSelection: Record<string, boolean> = {};
    products.forEach((product) => {
      if (productIds.includes(product.$id)) {
        if (selectionMode === "empty") {
          newSelection[product.$id] = !product.who || product.who.length === 0;
        } else {
          newSelection[product.$id] = true;
        }
      }
    });
    currentSelection = newSelection;
  });

  const badgeItems = $derived(
    products.map((product) => ({
      id: product.$id,
      label: product.productName,
      title: product.productName,
      selected: currentSelection[product.$id],
    })),
  );

  const selectedBadgeItems = $derived(
    badgeItems.filter((item) => item.selected),
  );

  const volunteerItems = $derived.by(() => {
    const allVolunteers = new Set([...productsStore.uniqueWho, ...whoNames]);
    return Array.from(allVolunteers).map((who) => ({
      id: who,
      label: who,
      selected: whoNames.includes(who),
    }));
  });

  const title = $derived(
    `Gérer les volontaires (${selectedBadgeItems.length} produit${selectedBadgeItems.length > 1 ? "s" : ""})`,
  );

  const isFormValid = $derived.by(() => {
    if (selectedBadgeItems.length === 0) return false;
    return whoNames.length > 0;
  });

  async function handleSubmit() {
    if (!isFormValid || loading) return;

    error = null;

    const selectedProductIds = selectedBadgeItems.map((item) => item.id);
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.$id),
    );

    productsStore.setSyncStatus(selectedProductIds, true);

    globalState.backgroundOperation = {
      isRunning: true,
      name: `Mise à jour volontaires (${selectedProductIds.length} produits)`,
      progress: 0,
    };

    onClose();

    try {
      await toastService.track(
        productsStore
          .batchUpdateProducts(selectedProductIds, selectedProducts, "who", {
            names: whoNames,
          })
          .then((result) => {
            console.log(
              `[WhoEditModal] Mise à jour groupée: ${result.success ? "succès" : "échec"}, ${result.updatedCount} produits modifiés`,
            );

            if (!result.success) {
              throw new Error(result.error || "Erreur lors de la mise à jour");
            }

            // Clear sync status on success (fallback in case notification doesn't arrive)
            productsStore.clearSyncStatus();
            console.log("[WhoEditModal] ✅ Sync status cleared on success");

            onSuccess?.(result);
            return result;
          }),
        {
          loading: `Mise à jour des mandatés pour ${selectedProductIds.length} produits...`,
          success: "Mise à jour effectué",
          error: "Erreur lors de la mise à jour des volontaires",
        },
      );
    } catch (error) {
      console.error("[WhoEditModal] Erreur mise à jour:", error);
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

  function handleAddVolunteer(name: string) {
    const trimmedName = name.trim();
    if (trimmedName && !whoNames.includes(trimmedName)) {
      whoNames = [...whoNames, trimmedName];
    }
  }

  function handleRemoveVolunteer(volunteer: string) {
    whoNames = whoNames.filter((v) => v !== volunteer);
  }

  function handleToggleVolunteer(volunteerId: string) {
    if (whoNames.includes(volunteerId)) {
      handleRemoveVolunteer(volunteerId);
    } else {
      handleAddVolunteer(volunteerId);
    }
  }

  function handleQuickAdd() {
    if (newVolunteerName.trim()) {
      handleAddVolunteer(newVolunteerName);
      newVolunteerName = "";
    }
  }

  function handleToggleProduct(productId: string) {
    currentSelection[productId] = !currentSelection[productId];
  }
</script>

<ModalContainer
  isOpen={true}
  {onClose}
  hasUnsavedChanges={false}
  fullscreenOnMobile={true}
  maxWidth={"lg"}
>
  <ModalHeader {title} showBackButton={true} {onClose} />

  <ModalContent>
    <div class="space-y-10">
      <!-- Erreur -->
      {#if error}
        <div class="alert alert-error max-md:alert-vertical">
          <TriangleAlert class="h-4 w-4" />
          <span>{error}</span>
        </div>
      {/if}

      <!-- Formulaire Who -->
      <div class="space-y-4">
        <h4 class="font-medium">
          Volontaires à assigner pour l'approvisionnement de ce produit
        </h4>

        <!-- Ajout rapide -->
        <div class="flex gap-2">
          <div class="">
            <WhoInput
              bind:value={newVolunteerName}
              disabled={loading}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
            />
          </div>

          <button
            class="btn btn-square btn-primary"
            onclick={handleQuickAdd}
            disabled={loading || !newVolunteerName.trim()}
          >
            <UserPlus size={16} />
          </button>
        </div>

        <!-- Gestion des volontaires avec BtnGroupCheck -->
        <div>
          <h5
            class="text-base-content/70 mb-2 hidden text-sm {volunteerItems.length &&
              'inline'}"
          >
            Sélection rapide
          </h5>
          <BtnGroupCheck
            items={volunteerItems}
            onToggleItem={handleToggleVolunteer}
            size="lg"
            color="info"
          />
        </div>
      </div>

      <!-- Liste des produits -->
      <div>
        <!-- Mode de sélection -->
        <div class=" my-4 flex flex-wrap items-start justify-between gap-4">
          <div class="font-medium">Produits concernés</div>
          <div class="flex flex-wrap gap-2">
            <button
              name="selectionMode"
              class="btn btn-sm {selectionMode === 'empty' && 'btn-secondary'}"
              onclick={() => (selectionMode = "empty")}
            >
              <span class="hidden sm:inline">Produits sans volontaire</span>
              <span class="sm:hidden">Sans volontaire</span>
            </button>
            <button
              name="selectionMode"
              class="btn btn-sm {selectionMode === 'all' && 'btn-secondary'}"
              onclick={() => (selectionMode = "all")}
            >
              Tous les produits
            </button>
          </div>
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
        <Check class="h-4 w-4" />
        Appliquer à {selectedBadgeItems.length} produit{selectedBadgeItems.length >
        1
          ? "s"
          : ""}
      {/if}
    </button>
  </ModalFooter>
</ModalContainer>
