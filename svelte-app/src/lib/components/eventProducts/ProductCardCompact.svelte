<script lang="ts">
  // utils
  import {
    getProductTypeInfo,
    formatPurchasesWithBadges,
  } from "$lib/utils/products-display";

  // Types
  import { ProductModel } from "$lib/models/ProductModel.svelte";

  // Icons
  import {
    Store,
    Users,
    ShoppingCart,
    Snowflake,
    CookingPot,
    Utensils,
    ClipboardPenLine,
    ShoppingBasket,
    Clock,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    PackageCheck,
    Check,
    Package,
    LoaderCircle,
    Smartphone,
    ScrollText,
    ClipboardX,
  } from "@lucide/svelte";

  // Stores
  import { globalState, hoverHelp } from "$lib/stores/GlobalState.svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";

  // Status icon mapping (same as ProductCard)
  const statusIcons = {
    Package,
    MessageCircleQuestionMark: ShoppingCart,
    ShoppingCart,
    Clock,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    PackageCheck,
    Check,
  };

  interface Props {
    productModel: ProductModel;
    shouldShowActionButtons: boolean;
    onOpenModal: (productId: string, tab?: string) => void;
    onQuickValidation: (product: any, productInDateRange: any) => void;
  }

  let {
    productModel,
    shouldShowActionButtons,
    onOpenModal,
    onQuickValidation,
  }: Props = $props();

  // Reactive data from productModel
  const product = $derived(productModel.data);
  const productInDateRange = $derived(productModel.stats);
  const typeInfo = $derived(getProductTypeInfo(product.productType));
  const purchasesBadges = $derived(
    formatPurchasesWithBadges(product.purchases || []),
  );
  const totalNeededOverride = $derived(product.totalNeededOverrideParsed);
</script>

<!-- Compact inline card -->
<div
  class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 {product.status ===
  'isSyncing'
    ? 'bg-accent/10 animate-pulse'
    : ''}"
>
  <!-- ═══ GROUP 1: Identity + Store/Who ═══ -->
  <div class="flex min-w-0 flex-wrap items-center gap-3">
    <!-- Identity sub-group → opens modal on "recettes" -->
    <button
      class="hover:bg-base-100 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-0.5 transition-colors"
      onclick={() => onOpenModal(product.id, "recettes")}
      title="Voir les recettes"
    >
      <typeInfo.icon size={16} class="text-primary/70 shrink-0" />
      <span class="font-semibold">{product.productName}</span>
      {#if product.pF}
        <ShoppingBasket size={13} class="text-success shrink-0" />
      {/if}
      {#if product.pS}
        <Snowflake size={13} class="text-info shrink-0" />
      {/if}
      {#if !product.productHugoUuid}
        <ClipboardPenLine size={13} class="text-warning shrink-0" />
      {/if}
      {#if product.status === "isSyncing"}
        <LoaderCircle size={13} class="text-accent shrink-0 animate-spin" />
      {/if}
    </button>

    <!-- Store + Who sub-group (truncated) -->
    <div class="flex max-w-64 min-w-0 items-center gap-2">
      <button
        class="hover:bg-base-200/60 flex cursor-pointer items-center gap-1 rounded-sm px-0.5 text-sm font-medium transition-colors {product
          .storeInfo?.storeName
          ? 'text-success/80'
          : 'text-base-content/40'}"
        onclick={() => onOpenModal(product.id, "magasins")}
        title="Modifier le magasin"
      >
        <Store size={13} class="shrink-0" />
        <span class="max-w-24 truncate"
          >{product.storeInfo?.storeName ?? "?"}</span
        >
      </button>
      <button
        class="hover:bg-base-200/60 flex cursor-pointer items-center gap-1 rounded-sm px-0.5 text-sm font-medium transition-colors {product.who &&
        product.who.length > 0
          ? 'text-success/80'
          : 'text-base-content/40'}"
        onclick={() => onOpenModal(product.id, "volontaires")}
        title="Modifier les volontaires"
      >
        <Users size={13} class="shrink-0" />
        <span class="max-w-24 truncate"
          >{product.who && product.who.length > 0
            ? product.who.join(", ")
            : "?"}</span
        >
      </button>
    </div>
    <div class="ms-auto flex gap-2">
      {#if productInDateRange.nbRecipes}
        <span class="text-base-content/50 flex items-center gap-0.5 text-sm">
          {productInDateRange.nbRecipes}<CookingPot size={12} />
        </span>
      {/if}
      {#if productInDateRange.totalAssiettes}
        <span class="text-base-content/50 flex items-center gap-0.5 text-sm">
          {productInDateRange.totalAssiettes}<Utensils size={12} />
        </span>
      {/if}
    </div>
  </div>

  <!-- ═══ GROUP 2: Needs + Purchases (right-aligned) ═══ -->
  <!--
    Mobile: flex-wrap → natural flow, safe overflow
    sm+:    grid 2 cols [min-content auto] → vertical alignment of icons & values
  -->
  <div class=" ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
    <!-- ── Row 1: Need ── -->
    <!-- Need value (grid col 2) -->
    <button
      class="hover:bg-base-100 flex min-h-6 cursor-pointer rounded-sm px-0.5 text-base font-semibold transition-colors {productInDateRange.hasMissing &&
      shouldShowActionButtons
        ? 'text-error'
        : 'text-success'}"
      onclick={() => onOpenModal(product.id, "recettes")}
      title="Voir le détail des besoins"
    >
      <div class="flex items-center gap-0.5">
        <span class="text-base-content/30 text-xs font-light"
          ><ClipboardX class="me-1 inline size-4" />
        </span>
        {#if totalNeededOverride?.totalOverride}
          <span class="text-base-content/40 mr-0.5 text-xs line-through">
            {productInDateRange.formattedQuantities}
          </span>
          {productInDateRange.formattedMissingQuantities}
          <span class="text-base-content/60 text-sm font-normal"
            >/
            {totalNeededOverride.totalOverride.q}
            {totalNeededOverride.totalOverride.u}</span
          >
        {:else}
          <span>{productInDateRange.formattedMissingQuantities}</span>
          <span class="text-base-content/60 text-sm font-normal">
            / {productInDateRange.formattedQuantities}
          </span>
        {/if}
      </div>
    </button>

    <!-- ── Row 2: Purchases ── -->
    <button
      class="hover:bg-base-100 bg-success/5 flex min-h-6 cursor-pointer flex-wrap items-center justify-end gap-2 rounded px-1 transition-colors"
      onclick={() => onOpenModal(product.id, "achats")}
      title="Voir les achats"
    >
      <div class="flex items-center gap-1">
        <ShoppingCart size={13} class="text-base-content/30 shrink-0" />
        <span class="text-base-content/50 text-xs font-light"> achats: </span>
      </div>

      {#if purchasesBadges.length > 0}
        <!-- Purchase values (grid col 2) -->

        {#each purchasesBadges as purchase, i (i)}
          {@const IconComponent = statusIcons[purchase.icon]}
          <span
            class="flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap"
          >
            <IconComponent size={13} class={purchase.badgeClass} />
            <span class={purchase.badgeClass}
              >{purchase.quantity} {purchase.unit}</span
            >
          </span>
          {#if purchase.status === "ordered"}
            <span class="text-base-content/40 text-xs whitespace-nowrap">
              liv. {purchase.deliveryDate ?? "?"}
            </span>
          {/if}
        {/each}
      {:else}
        <span class="text-base-content/60 text-xs font-light"> aucun... </span>
      {/if}
    </button>
  </div>
</div>
