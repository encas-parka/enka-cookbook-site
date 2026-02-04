<script lang="ts">
  import {
    X,
    CookingPot,
    ShoppingCart,
    Archive,
    Users,
    Store,
    History,
    Check,
  } from "@lucide/svelte";

  // Stores and Global States
  import { ProductModalState } from "$lib/stores/ProductModalState.svelte";

  // Components
  import PurchaseManager from "./PurchaseManager.svelte";
  import StockManager from "./StockManager.svelte";
  import VolunteerManager from "./VolunteerManager.svelte";
  import StoreManager from "./StoreManager.svelte";
  import RecipesManager from "./RecipesManager.svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { getProductTypeInfo } from "@/lib/utils/products-display";

  // Modal Components
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  let {
    productId,
    initialTab = "recettes",
    onClose,
  } = $props<{
    productId: string;
    initialTab?: string;
    onClose: () => void;
  }>();

  // État du modal
  let modalState = $state<ProductModalState | null>(null);

  $effect(() => {
    modalState = new ProductModalState(productId, initialTab);
  });

  let isArchiveMode = $derived(productsStore.isEventPassed);
  let isLoading = $derived(modalState === null || modalState.product === null);

  function handleTabClick(tab: string) {
    modalState?.setCurrentTab(tab);
  }

  function saveAllAndClose() {
    modalState?.saveAllChanges().then(() => {
      modalState?.resetForms();
      onClose();
    });
  }

  function handleModalClose() {
    modalState?.resetForms();
    onClose();
  }

  // Indicateur de modifications non sauvegardées
  let hasUnsavedChanges = $derived(modalState?.hasAnyChanges ?? false);

  // Type info pour les badges
  const productTypeInfo = $derived(() => {
    if (!modalState?.product) return null;
    return getProductTypeInfo(modalState.product.productType);
  });
</script>

<ModalContainer
  isOpen={!!productId}
  onClose={handleModalClose}
  {hasUnsavedChanges}
  fullscreenOnMobile={true}
  maxWidth="lg"
  modalClass="h-10/12"
>
  {#if isLoading}
    <!-- Header de chargement -->
    <ModalHeader
      title="Chargement..."
      showBackButton={true}
      onClose={handleModalClose}
    />
  {:else}
    <!-- Header principal -->
    <ModalHeader
      title={modalState?.product?.productName || "Produit"}
      showBackButton={true}
      onClose={handleModalClose}
    ></ModalHeader>

    <!-- Header avec indicateur d'archive -->
    {#if isArchiveMode}
      <div
        class="alert alert-warning border-warning/20 m-4 border-b px-4 py-2 text-xs"
      >
        <History class="h-4 w-4" />
        <span class="font-medium">Mode consultation</span>
        <span class="opacity-75">Événement terminé</span>
      </div>
    {/if}

    <!-- Onglets -->
    <div class="border-base-300 mb-4 flex-none border-b px-4">
      <div class="tabs tabs-border" role="tablist">
        <button
          role="tab"
          class="tab {modalState?.currentTab === 'recettes'
            ? 'tab-active'
            : ''}"
          onclick={() => handleTabClick("recettes")}
        >
          <CookingPot class="mr-1 h-4 w-4" />
          <span class="hidden sm:inline">Recettes</span>
          {#if modalState?.product?.nbRecipes && modalState.product.nbRecipes > 0}
            <span class="badge badge-sm badge-secondary ml-1">
              {modalState.product.nbRecipes}
            </span>
          {:else}
            <span class="badge badge-sm badge-ghost ml-1">0</span>
          {/if}
        </button>

        <button
          role="tab"
          class="tab {modalState?.currentTab === 'magasins'
            ? 'tab-active'
            : ''}"
          onclick={() => handleTabClick("magasins")}
        >
          <Store class="mr-1 h-4 w-4" />
          <span class="hidden sm:inline">Magasin</span>
          {#if modalState?.hasChanges?.store}
            <div class="bg-warning ml-1 h-2 w-2 rounded-full"></div>
          {/if}
        </button>

        <button
          role="tab"
          class="tab {modalState?.currentTab === 'volontaires'
            ? 'tab-active'
            : ''}"
          onclick={() => handleTabClick("volontaires")}
        >
          <Users class="mr-1 h-4 w-4" />
          <span class="hidden sm:inline">Volontaires</span>
          {#if modalState?.hasChanges?.who}
            <div class="bg-warning ml-1 h-2 w-2 rounded-full"></div>
          {:else if modalState?.product?.who && modalState.product.who.length > 0}
            <span class="badge badge-sm badge-secondary ml-1">
              {modalState.product.who.length}
            </span>
          {:else}
            <span class="badge badge-sm badge-ghost ml-1">0</span>
          {/if}
        </button>

        <button
          role="tab"
          class="tab {modalState?.currentTab === 'stock' ? 'tab-active' : ''}"
          onclick={() => handleTabClick("stock")}
        >
          <Archive class="mr-1 h-4 w-4" />
          <span class="hidden sm:inline">Stock</span>
          {#if modalState?.hasChanges?.stock}
            <div class="bg-warning ml-1 h-2 w-2 rounded-full"></div>
          {:else if modalState?.stockParsed}
            <span class="badge badge-sm badge-secondary ml-1">1</span>
          {:else}
            <span class="badge badge-sm badge-ghost ml-1">0</span>
          {/if}
        </button>

        <button
          role="tab"
          class="tab {modalState?.currentTab === 'achats' ? 'tab-active' : ''}"
          onclick={() => handleTabClick("achats")}
        >
          <ShoppingCart class="mr-1 h-4 w-4" />
          <span class="hidden sm:inline">Achats</span>
          {#if modalState?.purchasesList && modalState.purchasesList.length > 0}
            <span class="badge badge-sm badge-secondary ml-1">
              {modalState.purchasesList.length}
            </span>
          {:else}
            <span class="badge badge-sm badge-ghost ml-1">0</span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Contenu -->
    <ModalContent>
      {#if modalState?.error}
        <div class="alert alert-error max-md:alert-vertical mb-4">
          <X class="h-4 w-4" />
          <span>Erreur : {modalState.error}</span>
        </div>
      {/if}

      <div>
        {#key modalState?.currentTab}
          {#if modalState?.currentTab === "recettes"}
            <RecipesManager {modalState} {isArchiveMode} />
          {:else if modalState?.currentTab === "achats"}
            <PurchaseManager {modalState} {isArchiveMode} />
          {:else if modalState?.currentTab === "stock"}
            <StockManager {modalState} {isArchiveMode} />
          {:else if modalState?.currentTab === "volontaires"}
            <VolunteerManager {modalState} {isArchiveMode} />
          {:else if modalState?.currentTab === "magasins"}
            <StoreManager {modalState} {isArchiveMode} />
          {/if}
        {/key}
      </div>
    </ModalContent>

    <!-- Footer -->
    <ModalFooter>
      <button class="btn btn-ghost" onclick={handleModalClose}>
        {modalState?.hasAnyChanges ? "Annuler" : "Fermer"}
      </button>
      {#if modalState?.hasAnyChanges}
        <button
          class="btn btn-primary"
          onclick={saveAllAndClose}
          disabled={modalState.loading}
        >
          {#if modalState.loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Check class="h-4 w-4" />
            Tout enregistrer
          {/if}
        </button>
      {/if}
    </ModalFooter>
  {/if}
</ModalContainer>
