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
    ChevronDown,
    ChevronUp,
  } from "@lucide/svelte";

  // UI Components
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import DateBadge from "$lib/components/ui/DateBadge.svelte";
  import IconSprite from "../ui/IconSprite.svelte";
  import ProductRecipeDetails from "./ProductRecipeDetails.svelte";

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
    showRecipeDetails: boolean;
  }

  let {
    productModel,
    shouldShowActionButtons,
    onOpenModal,
    onQuickValidation,
    showRecipeDetails,
  }: Props = $props();

  // Toggle local du détail des recettes (par carte), combiné au réglage
  // global : global ON déplie tout, local permet un dépliage ponctuel
  let localShowDetails = $state(false);
  const showDetails = $derived(showRecipeDetails || localShowDetails);

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
  out:fade
  class="card overflow-x-clip bg-base-100 {globalState.isMobile &&
    'border border-base-300 shadow'} {product.status === 'isSyncing'
    ? 'animate-pulse border-2 border-accent bg-accent/30'
    : ''}"
>
  <div class="card-body p-2">
    <!-- Première ligne: Titre/Type à gauche, Store/Who à droite -->
    <div class="flex items-start justify-between">
      <!-- Section gauche: Titre & Type (prend la place disponible) -->
      <div class="flex flex-1 flex-wrap items-center gap-4">
        <!-- Nom du produit & type icon -->
        <div
          class="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-primary"
          role="button"
          tabindex="0"
          onclick={() => onOpenModal(product.id, "recettes")}
          onkeydown={(e) =>
            e.key === "Enter" && onOpenModal(product.id, "recettes")}
          onmouseenter={() =>
            (hoverHelp.msg = "Afficher les informations sur ce produit")}
          onmouseleave={() => hoverHelp.reset()}
        >
          <typeInfo.icon class="h-4 w-4 shrink-0" />{product.productName}
          {#if product.mergedFrom?.length}
            <div class="text-xs font-normal text-base-content/70">
              dont: {product.mergedFrom.map((f) => f.name).join(", ")}
            </div>
          {/if}
          {#if product.previousNames && product.previousNames.length > 0}
            <div class="text-sm font-normal text-base-content/60">
              Ancien: {product.previousNames[0]}
            </div>
          {/if}
          {#if !product.ingredientRef}
            <div
              class="tooltip"
              data-tip="Ajouté manuellement, ne fait pas partie des recette"
            >
              <ClipboardPenLine class="h-4 w-4 text-warning" />
            </div>
          {/if}
          <!-- icone and sync spinner -->
          {#if product.pF}
            <div
              class="flex size-6 items-center justify-center rounded-full bg-success/20"
              title="Produit frais"
            >
              <ShoppingBasket size={16} class="text-success " />
            </div>
          {/if}
          {#if product.pS}
            <div
              class="flex size-6 items-center justify-center rounded-full bg-info/20"
              title="Produit surgelé"
            >
              <Snowflake class="h-4 w-4 text-info" />
            </div>
          {/if}
        </div>
        {#if product.status === "isSyncing"}
          <div
            class="flex items-center gap-1 text-accent"
            title="Synchronisation en cours..."
          >
            <LoaderCircle class="h-4 w-4 animate-spin" />
          </div>
        {/if}

        <!-- 📅 Dates concernées (desktop only: sinon wrap degeu) -->
        {#if !globalState.isMobile && productInDateRange.concernedDates.length > 0}
          <div class="text-base-content/60">
            {#if showRecipeDetails}
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
            {:else}
              <button
                type="button"
                class="flex cursor-pointer flex-wrap items-center gap-1 rounded-md transition-colors hover:bg-base-200/40"
                onclick={() => (localShowDetails = !localShowDetails)}
                onmouseenter={() =>
                  (hoverHelp.msg = "Cliquez pour voir le détail des recettes")}
                onmouseleave={() => hoverHelp.reset()}
                aria-expanded={localShowDetails}
                title={localShowDetails
                  ? "Masquer le détail des recettes"
                  : "Voir le détail des recettes"}
              >
                {#each productInDateRange.concernedDates as date (date)}
                  {@const recipes =
                    productInDateRange.recipesByDate.get(date) || []}
                  {@const dateDisplayInfo =
                    productModel.data.dateDisplayInfo[date] ||
                    calculateDateDisplayInfo(date)}
                  <DateBadge {dateDisplayInfo} {recipes} />
                {/each}
                {#if localShowDetails}
                  <ChevronUp size={14} />
                {:else}
                  <ChevronDown size={14} />
                {/if}
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Section droite: Store & Who (horizontal, wrap) -->
      {#if shouldShowActionButtons}
        <div class="ml-4 flex gap-2 self-start">
          <!-- Store -->
          <button
            title="Modifier le magasin"
            class="group btn relative btn-soft btn-sm {product.storeInfo
              ?.storeName
              ? 'btn-success'
              : ''}"
            onclick={() => onOpenModal(product.id, "magasins")}
            onkeydown={(e) =>
              e.key === "Enter" && onOpenModal(product.id, "magasins")}
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
              <div class="ml-1 text-sm font-medium opacity-60">?</div>
            {/if}
          </button>

          <!-- Who -->
          <button
            title="Modifier les volontaires"
            class="group btn relative btn-soft btn-sm {product.who &&
            product.who?.length > 0
              ? 'btn-success'
              : ''}"
            onclick={() => onOpenModal(product.id, "volontaires")}
            onkeydown={(e) =>
              e.key === "Enter" && onOpenModal(product.id, "volontaires")}
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
                    <span class="text-xs text-base-content/50"
                      >+{product.who.length - 2}</span
                    >
                  {/if}
                </div>
              {:else if product.who.length === 1}
                {product.who}
              {/if}
            {:else}
              <div class="ml-1 text-sm font-medium opacity-60">?</div>
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
        {#if showRecipeDetails}
          <div class="flex flex-wrap gap-1">
            {#each productInDateRange.concernedDates as date (date)}
              {@const recipes =
                productInDateRange.recipesByDate.get(date) || []}
              {@const dateDisplayInfo =
                productModel.data.dateDisplayInfo[date] ||
                calculateDateDisplayInfo(date)}
              <DateBadge {dateDisplayInfo} {recipes} />
            {/each}
          </div>
        {:else}
          <button
            type="button"
            class="flex cursor-pointer flex-wrap items-center gap-1 rounded-md transition-colors hover:bg-base-200/40"
            onclick={() => (localShowDetails = !localShowDetails)}
            aria-expanded={localShowDetails}
            title={localShowDetails
              ? "Masquer le détail des recettes"
              : "Voir le détail des recettes"}
          >
            {#each productInDateRange.concernedDates as date (date)}
              {@const recipes =
                productInDateRange.recipesByDate.get(date) || []}
              {@const dateDisplayInfo =
                productModel.data.dateDisplayInfo[date] ||
                calculateDateDisplayInfo(date)}
              <DateBadge {dateDisplayInfo} {recipes} />
            {/each}
            {#if localShowDetails}
              <ChevronUp size={14} />
            {:else}
              <ChevronDown size={14} />
            {/if}
          </button>
        {/if}
      </div>
    {/if}

    <!-- Deuxième ligne: Groupe Besoins + Achats + Manquants (flex wrap) -->
    <div class="flex min-h-12 flex-wrap gap-3" id="card-needs-missing">
      <!-- Besoins -->
      <div class="flex min-w-75 flex-1 flex-col">
        <div class="ms-1 text-sm text-base-content/60">
          Besoins total sur la période
        </div>
        <div
          id="needs-card"
          role="button"
          tabindex="0"
          class=" group relative flex flex-1 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-base-300/80 p-2 shadow-sm hover:ring-2 hover:ring-accent/60"
          onclick={() => onOpenModal(product.id, "recettes")}
          onkeydown={(e) =>
            e.key === "Enter" && onOpenModal(product.id, "recettes")}
          onmouseenter={() =>
            (hoverHelp.msg = "Afficher les informations sur ce produit")}
          onmouseleave={() => hoverHelp.reset()}
        >
          <div class="ms-2 flex items-end justify-center gap-4">
            <div
              class="text-base font-semibold {productInDateRange.hasMissing &&
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
              <div class="flex items-center gap-2 text-base-content/90">
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
              class="btn ms-auto btn-outline btn-primary sm:btn-sm"
              onclick={(e) => {
                e.stopPropagation();
                onQuickValidation(product, productInDateRange);
              }}
              onmouseenter={() =>
                (hoverHelp.msg = "Ajouter aux achats effectués")}
              onmouseleave={() => hoverHelp.reset()}
            >
              <span
                ><span class="font-light">manque : </span>
                {productInDateRange.formattedMissingQuantities}</span
              >
              <IconSprite name="add-to-cart" size={16} />
            </button>
          {:else if shouldShowActionButtons}
            <CircleCheckBig size={24} class="ms-auto text-success" />
          {/if}
          {#if shouldShowActionButtons && overrideMismatch?.hasMismatch}
            <div
              id="override_alert"
              class="mt-1 alert alert-outline px-2 py-1 text-xs alert-warning"
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
      <div class="flex flex-1 flex-col md:min-w-75">
        <div class="ms-1 text-sm text-base-content/60">
          Achat / reccup effectué
        </div>

        <div
          class="group relative flex flex-1 cursor-pointer items-start justify-between gap-2 rounded-lg bg-base-300/80 p-2 shadow-sm transition-colors hover:ring-2 hover:ring-accent/60"
          role="button"
          tabindex="0"
          onclick={() => onOpenModal(product.id, "achats")}
          onkeydown={(e) =>
            e.key === "Enter" && onOpenModal(product.id, "achats")}
          onmouseenter={() => (hoverHelp.msg = "Déclarez des achats effectués")}
          onmouseleave={() => hoverHelp.reset()}
        >
          <!-- Liste des achats -->
          <ShoppingCart class="h-4 w-4 opacity-60" />
          <div
            class="blocktransition-opacity ms-2 text-xs text-base-content/30 italic {!shouldShowActionButtons
              ? 'hidden'
              : 'group-hover:block'} sm:hidden"
          >
            ajouter un achat
          </div>
          <div class="ms-auto flex flex-wrap gap-1.5">
            <!-- Badge de stock actuel -->
            {#if product.stockParsed}
              <div
                class="badge flex h-auto flex-col items-center gap-1 badge-outline badge-lg badge-secondary"
              >
                <div class="flex items-center gap-1">
                  <Warehouse class="h-4 w-4 text-secondary" />
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
                class="badge flex h-auto flex-col items-center gap-1 badge-outline badge-lg {purchase.badgeClass}"
              >
                <div class="flex items-center gap-1">
                  <IconComponent class="h-4 w-4" />
                  <span class="font-medium text-nowrap">
                    {purchase.quantity}
                    {purchase.unit}
                  </span>
                </div>
                {#if purchase.status === "ordered"}
                  <span class="text-sm opacity-75">
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
              <div class="text-xs text-base-content/50 italic">aucun</div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    {#if showDetails}
      <div transition:slide={{ duration: 200 }}>
        <ProductRecipeDetails
          recipesByDate={productInDateRange.recipesByDate}
          concernedDates={productInDateRange.concernedDates}
        />
      </div>
    {/if}
  </div>
</div>
