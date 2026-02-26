<script lang="ts">
  // utils
  import {
    getProductTypeInfo,
    formatPurchasesWithBadges,
  } from "$lib/utils/products-display";
  import { detectOverrideMismatch } from "$lib/utils/productsUtils";
  import {
    formatDateDayMonthShort,
    DayMonthMoment,
  } from "$lib/utils/date-helpers";
  import { calculateDateDisplayInfo } from "$lib/utils/dateRange";

  // Types
  import { ProductModel } from "$lib/models/ProductModel.svelte";

  // Icons
  import {
    Store,
    Users,
    ShoppingCart,
    LoaderCircle,
    ShoppingBasket,
    Snowflake,
    CookingPot,
    Utensils,
    CircleCheckBig,
    ClipboardPenLine,
    MessageCircleMore,
    CircleAlert,
    Warehouse,
    Clock,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    PackageCheck,
    Check,
    Package,
  } from "@lucide/svelte";

  // UI Components
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import DateBadge from "$lib/components/ui/DateBadge.svelte";
  import IconSprite from "../ui/IconSprite.svelte";

  // Stores
  import { globalState, hoverHelp } from "$lib/stores/GlobalState.svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { fade, slide } from "svelte/transition";

  // Récupérer les icônes de statut depuis le parent pour éviter la duplication
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

  // Données réactives dérivées du productModel
  const product = $derived(productModel.data);
  const productInDateRange = $derived(productModel.stats);
  const typeInfo = $derived(getProductTypeInfo(product.productType));
  const purchasesBadges = $derived(
    formatPurchasesWithBadges(product.purchases || []),
  );
  const totalNeededOverride = $derived(product.totalNeededOverrideParsed);
  const overrideMismatch = $derived(detectOverrideMismatch(product));
</script>

<!-- Card du produit -->
<div
  transition:fade
  class="card bg-base-100 {globalState.isMobile &&
    'border-base-300 border shadow'} {product.status === 'isSyncing'
    ? 'border-accent bg-accent/30 animate-pulse border-2'
    : ''}"
>
  <div class="card-body p-2">
    <!-- Première ligne: Titre/Type à gauche, Store/Who à droite -->
    <div class="flex items-start justify-between">
      <!-- Section gauche: Titre & Type (prend la place disponible) -->
      <div
        class="flex flex-1 cursor-pointer flex-wrap items-center gap-4"
        role="button"
        tabindex="0"
        onclick={() => onOpenModal(product.$id, "recettes")}
        onkeydown={(e) =>
          e.key === "Enter" && onOpenModal(product.$id, "recettes")}
        onmouseenter={() =>
          (hoverHelp.msg = "Afficher les informations sur ce produit")}
        onmouseleave={() => hoverHelp.reset()}
      >
        <!-- Nom du produit & type icon -->
        <div
          class="text-primary flex items-center gap-2 text-base font-semibold"
        >
          <typeInfo.icon class="h-4 w-4" />{product.productName}
          {#if product.previousNames && product.previousNames.length > 0}
            <div class="text-base-content/60 text-sm font-normal">
              Ancien: {product.previousNames[0]}
            </div>
          {/if}
          {#if !product.productHugoUuid}
            <div
              class="tooltip"
              data-tip="Ajouté manuellement, ne fait pas partie des recette"
            >
              <ClipboardPenLine class="text-warning h-4 w-4" />
            </div>
          {/if}
        </div>
        <!-- icone and sync spinner -->
        <div class="flex gap-1">
          {#if product.pF}
            <div
              class="bg-success/20 flex h-6 w-6 items-center justify-center rounded-full"
              title="Produit frais"
            >
              <ShoppingBasket class="text-success h-4 w-4" />
            </div>
          {/if}
          {#if product.pS}
            <div
              class="bg-info/20 flex h-6 w-6 items-center justify-center rounded-full"
              title="Produit surgelé"
            >
              <Snowflake class="text-info h-4 w-4" />
            </div>
          {/if}
        </div>
        {#if product.status === "isSyncing"}
          <div
            class="text-accent flex items-center gap-1"
            title="Synchronisation en cours..."
          >
            <LoaderCircle class="h-4 w-4 animate-spin" />
          </div>
        {/if}

        <!-- 📅 Dates concernées (desktop only: sinon wrap degeu) -->
        {#if !globalState.isMobile && productInDateRange.concernedDates.length > 0}
          <div class="text-base-content/60">
            <div class="flex flex-wrap items-center gap-1">
              {#each productInDateRange.concernedDates as date (date)}
                {@const recipes =
                  productInDateRange.recipesByDate.get(date) || []}
                {@const dateDisplayInfo =
                  productModel.data.dateDisplayInfo[date] ||
                  calculateDateDisplayInfo(date)}
                <DateBadge {dateDisplayInfo} {recipes} />
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Section droite: Store & Who (horizontal, wrap) -->
      {#if shouldShowActionButtons}
        <div class="ml-4 flex gap-2 self-start">
          <!-- Store -->
          <button
            title="Modifier le magasin"
            class="btn btn-soft btn-xs sm:btn-sm group relative {product
              .storeInfo?.storeName
              ? 'btn-success'
              : ''}"
            onclick={() => onOpenModal(product.$id, "magasins")}
            onkeydown={(e) =>
              e.key === "Enter" && onOpenModal(product.$id, "magasins")}
            onmouseenter={() =>
              (hoverHelp.msg = "Définissez le magasin où acheter le produit")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <Store size={18} />
            {#if product.storeInfo?.storeName}
              <div class="ml-1">
                {product.storeInfo.storeName}
              </div>
              {#if product.storeInfo?.storeComment}
                <div class="ml-1">
                  <Tooltip
                    tip={product.storeInfo.storeComment}
                    icon={MessageCircleMore}
                    iconSize={14}
                  />
                </div>
              {/if}
            {:else}
              <div class="ml-1 text-sm font-medium">?</div>
            {/if}
          </button>

          <!-- Who -->
          <button
            title="Modifier les volontaires"
            class="btn btn-xs sm:btn-sm btn-soft group relative {product.who &&
            product.who?.length > 0
              ? 'btn-success'
              : ''}"
            onclick={() => onOpenModal(product.$id, "volontaires")}
            onkeydown={(e) =>
              e.key === "Enter" && onOpenModal(product.$id, "volontaires")}
            onmouseenter={() =>
              (hoverHelp.msg =
                "Déclarez qui est responsable de l'achat de ce produit")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <Users size={18} />
            {#if product.who && product.who.length}
              {#if product.who.length > 1}
                <div class="ml-1 flex gap-1">
                  {product.who
                    .slice(0, 2)
                    .map((person) => person.slice(0, 5))
                    .join(" | ")}...
                  {#if product.who.length > 2}
                    <span class="text-base-content/50 text-xs"
                      >+{product.who.length - 2}</span
                    >
                  {/if}
                </div>
              {:else if product.who.length === 1}
                {product.who}
              {/if}
            {:else}
              <div class="ml-1 text-sm font-medium">?</div>
            {/if}
          </button>
        </div>
      {:else}
        <!-- Affichage lecture seule en mode archive -->
        <div class="mx-4 flex gap-2 opacity-60">
          {#if product.storeInfo?.storeName}
            <div class="flex items-center gap-1 text-sm">
              <Store size={16} />
              {product.storeInfo.storeName}
            </div>
          {/if}
          {#if product.who && product.who.length > 0}
            <div class="flex items-center gap-1 text-sm">
              <Users size={16} />
              {product.who.join(", ")}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 📅 Dates concernées (mobile only) -->
    {#if globalState.isMobile && productInDateRange.concernedDates.length > 0}
      <div class="text-base-content/60">
        <div class="flex flex-wrap gap-1">
          {#each productInDateRange.concernedDates as date (date)}
            {@const recipes = productInDateRange.recipesByDate.get(date) || []}
            {@const dateDisplayInfo =
              productModel.data.dateDisplayInfo[date] ||
              calculateDateDisplayInfo(date)}
            <DateBadge {dateDisplayInfo} {recipes} />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Deuxième ligne: Groupe Besoins + Achats + Manquants (flex wrap) -->
    <div class="flex min-h-14 flex-wrap gap-3" id="card-needs-missing">
      <!-- Besoins -->
      <div class="flex min-w-75 flex-1 flex-col">
        <div class="text-base-content/60 ms-1 text-sm">
          Besoins total sur la période
        </div>
        <div
          id="needs-card"
          role="button"
          tabindex="0"
          class=" bg-base-300/80 group hover:ring-accent/60 relative flex flex-1 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg p-3 shadow-sm hover:ring-2"
          onclick={() => onOpenModal(product.$id, "recettes")}
          onkeydown={(e) =>
            e.key === "Enter" && onOpenModal(product.$id, "recettes")}
          onmouseenter={() =>
            (hoverHelp.msg = "Afficher les informations sur ce produit")}
          onmouseleave={() => hoverHelp.reset()}
        >
          <div class="ms-2 flex items-end justify-center gap-4">
            <div
              class="text-base font-bold {productInDateRange.hasMissing &&
              shouldShowActionButtons
                ? 'text-error'
                : 'text-success'}"
            >
              <!-- affichage override -->
              {#if totalNeededOverride?.totalOverride}
                <div
                  class="tooltip flex items-center gap-2"
                  data-tip="Besoin total modifié manuellement"
                >
                  <span class="text-base-content/70 line-through"
                    >{productInDateRange.formattedQuantities}</span
                  >
                  <ClipboardPenLine class="h-4 w-4" />
                  {totalNeededOverride.totalOverride.q}
                  {totalNeededOverride.totalOverride.u}
                </div>
              {:else}
                <span> {productInDateRange.formattedQuantities}</span>
              {/if}
            </div>
            {#if productInDateRange.nbRecipes || productInDateRange.totalAssiettes}
              <div class="text-base-content/90 flex items-center gap-2">
                <span class="flex items-center gap-1">
                  {productInDateRange.nbRecipes}
                  <CookingPot class="h-3 w-3" />
                </span>
                <span class="flex items-center gap-1">
                  {productInDateRange.totalAssiettes}
                  <Utensils class="h-3 w-3" />
                </span>
              </div>
            {/if}
          </div>

          <!-- Bouton d'achat rapide -->
          {#if shouldShowActionButtons && productInDateRange.hasMissing}
            <button
              class="btn btn-sm btn-outline btn-primary ms-auto"
              onclick={(e) => {
                e.stopPropagation();
                onQuickValidation(product, productInDateRange);
              }}
              onmouseenter={() =>
                (hoverHelp.msg = "Ajouter aux achats effectués")}
              onmouseleave={() => hoverHelp.reset()}
            >
              <span class="text-xs"
                ><span class="font-light">manque : </span>
                {productInDateRange.formattedMissingQuantities}</span
              >
              <span class="text-primary">
                <IconSprite name="add-to-cart" size={16} /></span
              >
            </button>
          {:else if shouldShowActionButtons}
            <CircleCheckBig size={24} class="text-success ms-auto" />
          {/if}
          {#if shouldShowActionButtons && overrideMismatch?.hasMismatch}
            <div
              id="override_alert"
              class="alert alert-warning alert-outline mt-1"
            >
              <CircleAlert size={18} />
              <span>
                Les menus ont été modifié depuis la définition manuelle des
                besoins:
                {#if overrideMismatch.platesChanged}
                  {overrideMismatch.details?.oldPlates}→{overrideMismatch
                    .details?.newPlates} couverts
                {/if}
                {#if overrideMismatch.recipesChanged}
                  {overrideMismatch.details?.oldRecipes}→{overrideMismatch
                    .details?.newRecipes}
                  recettes
                {/if}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Achats -->
      <div class="flex min-w-[300px] flex-1 flex-col">
        <div class="text-base-content/60 ms-1 text-sm">
          Achat / reccup effectué
        </div>

        <div
          class="group hover:ring-accent/60 bg-base-300/80 relative flex flex-1 cursor-pointer items-start justify-between gap-2 rounded-lg p-3 shadow-sm transition-colors hover:ring-2"
          role="button"
          tabindex="0"
          onclick={() => onOpenModal(product.$id, "achats")}
          onkeydown={(e) =>
            e.key === "Enter" && onOpenModal(product.$id, "achats")}
          onmouseenter={() => (hoverHelp.msg = "Déclarez des achats effectués")}
          onmouseleave={() => hoverHelp.reset()}
        >
          <!-- Liste des achats -->
          <ShoppingCart class="h-4 w-4 opacity-60" />
          <div
            class="text-base-content/30 blocktransition-opacity ms-2 text-xs italic {!shouldShowActionButtons
              ? 'hidden'
              : 'group-hover:block'} sm:hidden"
          >
            ajouter un achat
          </div>
          <div class="ms-auto flex flex-wrap gap-1.5">
            <!-- Badge de stock actuel -->
            {#if product.stockParsed}
              <div
                class="badge badge-outline badge-lg badge-secondary flex h-auto flex-col items-center gap-1"
              >
                <div class="flex items-center gap-1">
                  <Warehouse class="text-secondary h-4 w-4" />
                  <span class="text-sm font-medium text-nowrap">
                    {product.stockParsed.quantity}
                    {product.stockParsed.unit}
                  </span>
                </div>
                <span class="text-xs opacity-75">
                  stock: {formatDateDayMonthShort(product.stockParsed.dateTime)}
                </span>
              </div>
            {/if}

            {#each purchasesBadges as purchase, index (index)}
              {@const IconComponent = statusIcons[purchase.icon]}
              <div
                class="badge badge-outline badge-lg flex h-auto flex-col items-center gap-1 {purchase.badgeClass}"
              >
                <div class="flex items-center gap-1">
                  <IconComponent class="h-4 w-4" />
                  <span class="text-sm font-medium text-nowrap">
                    {purchase.quantity}
                    {purchase.unit}
                  </span>
                </div>
                {#if purchase.status === "ordered"}
                  <span class="text-xs opacity-75">
                    {#if purchase.deliveryDate}
                      livré le: {purchase.deliveryDate}
                    {:else}
                      livraison ?
                    {/if}
                  </span>
                {/if}
              </div>
            {/each}

            {#if purchasesBadges.length === 0 && !product?.stockParsed}
              <div class="text-base-content/50 text-xs italic">aucun</div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
