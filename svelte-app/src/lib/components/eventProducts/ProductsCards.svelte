<script lang="ts">
  import { productsStore } from "$lib/stores/ProductsStore.svelte";

  import {
    Store,
    Users,
    ShoppingCart,
    CircleCheckBig,
    SquarePen,
    Clock,
    LayoutGrid,
    List,
  } from "@lucide/svelte";

  import { globalState, hoverHelp } from "$lib/stores/GlobalState.svelte";
  import {
    DayMonthMoment,
    formatDateDayMonthShort,
    formatDateWdDayMonthShort,
  } from "$lib/utils/date-helpers";
  import { fade } from "svelte/transition";

  import ProductCard from "./ProductCard.svelte";
  import ProductCardCompact from "./ProductCardCompact.svelte";
  import {
    getProductTypeInfo,
    formatPurchasesWithBadges,
  } from "@/lib/utils/products-display";

  interface Props {
    onOpenModal: (productId: string, tab?: string) => void;
    onOpenGroupEditModal: (
      type: "store" | "who",
      productIds: string[],
      products: any[],
    ) => void;
    onOpenGroupPurchaseModal: (products: any[]) => void;
    onQuickValidation: (product: any, productInDateRange: any) => void;
    currentEvent?: any;
    disabled?: boolean;
  }

  let {
    onOpenModal,
    onOpenGroupEditModal,
    onOpenGroupPurchaseModal,
    onQuickValidation,
    currentEvent,
    disabled = false,
  }: Props = $props();

  const groupedProducts = $derived(productsStore.groupedProducts);
  const allGroupEntries = $derived(Object.entries(groupedProducts));
  const filters = $derived(productsStore.filters);

  // View mode: 'card' (default) or 'compact'
  let viewMode = $state<"card" | "compact">("card");

  // Pagination progressive (lazy loading, 1 groupe à la fois)
  let currentPage = $state(1);
  let sentinel = $state<HTMLElement | undefined>();

  const paginatedGroupEntries = $derived(allGroupEntries.slice(0, currentPage));

  const formatedStartDateRange = formatDateWdDayMonthShort(
    productsStore.dateStore.start,
  );
  const formatedEndDateRange = formatDateWdDayMonthShort(
    productsStore.dateStore.end,
  );

  // Dérivé pour déterminer si les boutons d'action doivent être affichés
  const shouldShowActionButtons = $derived(
    !productsStore.dateStore.isEventPassed &&
      !productsStore.dateStore.hasPastDatesInRange,
  );

  const groupHeadClass = $derived(
    filters.completionStatus === "completed"
      ? "bg-emerald-800"
      : filters.completionStatus === "incomplete"
        ? "bg-amber-800"
        : "bg-primary",
  );

  // Gestion de la visibilité des headers sticky avec IntersectionObserver
  let groupElements = $state<(HTMLElement | undefined)[]>([]);
  let headerVisibility = $state<Map<string, boolean>>(new Map());
  let activeObservers: IntersectionObserver[] = [];

  // Observer chaque groupe — recrée les observers quand les clés changent
  let prevGroupKeysSignature = "";
  $effect(() => {
    const currentKeys = Object.keys(groupedProducts);
    const signature = currentKeys.join(",");
    if (signature === prevGroupKeysSignature) return;
    prevGroupKeysSignature = signature;

    // Nettoyer les anciens observers (runed useIntersectionObserver ne le faisait pas)
    activeObservers.forEach((o) => o.disconnect());
    activeObservers = [];

    // Reset : tous les headers repassent visible par défaut (?? true)
    headerVisibility = new Map();

    groupElements.forEach((groupEl, index) => {
      if (!groupEl) return;

      const groupKey = currentKeys[index];
      if (!groupKey) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;

          headerVisibility = new Map(headerVisibility).set(
            groupKey,
            entry.isIntersecting,
          );
        },
        {
          threshold: [0, 1],
        },
      );
      observer.observe(groupEl);
      activeObservers.push(observer);
    });
  });

  // Lazy loading : charger le groupe suivant quand la sentinelle est visible
  $effect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          paginatedGroupEntries.length < allGroupEntries.length
        ) {
          currentPage++;
        }
      },
      { threshold: 0.1, rootMargin: "10px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Plus de reset de pagination : Array.slice(0, n) gère n > length naturellement.
  // Le lazy loading via la sentinelle charge les groupes additionnels si besoin.
  // Évite la cascade de re-renders (reset → sentinel → ++ → re-render → …).
</script>

<div
  class="space-y-4 rounded-lg print:hidden {disabled
    ? 'pointer-events-none opacity-60'
    : ''}"
>
  <!-- View mode toggle -->
  <div class="flex justify-end px-1">
    <div class="join">
      <button
        class="btn join-item {viewMode === 'card'
          ? 'btn-active btn-primary'
          : 'btn-soft'}"
        onclick={() => (viewMode = "card")}
        title="Vue cartes"
      >
        <LayoutGrid size={14} />
        cartes
      </button>
      <button
        class="btn join-item {viewMode === 'compact'
          ? 'btn-active btn-primary'
          : 'btn-soft'}"
        onclick={() => (viewMode = "compact")}
        title="Vue compacte"
      >
        <List size={14} />
        compact
      </button>
    </div>
  </div>

  {#each paginatedGroupEntries as [groupKey, gProducts], groupIndex (groupKey)}
    {@const groupProducts = gProducts}
    <!-- Conteneur du groupe observable pour IntersectionObserver -->
    <div bind:this={groupElements[groupIndex]}>
      {#if groupKey !== ""}
        <!-- Header de groupe sticky -->
        {@const groupTypeInfo = getProductTypeInfo(groupKey)}
        {@const isVisible = headerVisibility.get(groupKey) ?? true}
        <div
          class="{groupHeadClass} @container sticky {globalState.isMobile
            ? globalState.headerVisible
              ? 'top-12'
              : 'top-0'
            : 'top-12 rounded-lg'} z-2 flex flex-wrap items-center justify-between gap-y-1 px-4 py-0.5 shadow-md transition-all duration-300 sm:py-2 @md:flex-nowrap print:shadow-none {isVisible
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'}"
        >
          <!-- Nom du groupe -->
          <div
            class="flex items-center gap-2 font-bold text-shadow-md/20 @md:min-w-48"
          >
            {#if filters.groupBy === "store"}
              <div class="text-primary-content flex items-center gap-2">
                <Store class="size-4 md:size-5" />
                {groupKey} ({groupProducts!.length})
              </div>
            {:else if filters.groupBy === "productType"}
              <div class="text-primary-content flex items-center gap-2">
                <groupTypeInfo.icon class="size-4 md:size-5" />
                <span>{groupTypeInfo.displayName}</span>
                <span class="text-sm opacity-70">({groupProducts!.length})</span
                >
              </div>
            {:else}
              📦 {groupKey} ({groupProducts!.length})
            {/if}
          </div>

          {#if !globalState.isMobile}
            <div class="text-primary-content px-2 text-sm text-shadow-md">
              {#if productsStore.dateStore.isFullRange && productsStore.dateStore.start !== productsStore.dateStore.end}
                <div class="font-semibold">Sur toute la période</div>
              {:else if productsStore.dateStore.start !== productsStore.dateStore.end}
                du <span class="font-semibold">
                  {DayMonthMoment(productsStore.dateStore.start)}
                </span>
                au
                <span class="font-semibold">
                  {DayMonthMoment(productsStore.dateStore.end)}</span
                >
              {:else}
                le <span class="font-semibold"
                  >{DayMonthMoment(productsStore.dateStore.start)}
                </span>
              {/if}
            </div>
          {:else}
            <div class="text-primary-content">
              {#if !productsStore.dateStore.isFullRange && productsStore.dateStore.start !== productsStore.dateStore.end}
                <span class="font-semibold"
                  >{DayMonthMoment(productsStore.dateStore.start)} → {DayMonthMoment(
                    productsStore.dateStore.end,
                  )}</span
                >
              {:else}
                le <span class="font-semibold"
                  >{DayMonthMoment(productsStore.dateStore.start, true)}</span
                >
              {/if}
            </div>
          {/if}

          <!-- Actions groupées -->
          {#if shouldShowActionButtons}
            <div
              class="ms-auto mt-1 flex flex-wrap items-center justify-end gap-2"
            >
              <button
                class="btn btn-sm btn-primary btn-soft"
                onclick={() =>
                  onOpenGroupEditModal(
                    "store",
                    groupProducts!.map((p) => p.data.$id),
                    groupProducts!.map((p) => p.data),
                  )}
                onmouseenter={() =>
                  (hoverHelp.msg =
                    "Définissez un magasin où seront acheté tous les produits de ce groupe")}
                onmouseleave={() => hoverHelp.reset()}
                title="Attribuer un magasin à tous les produits de ce groupe"
              >
                <Store size={16} />
                <span class="hidden @md:block">Magasin</span>
                <SquarePen size={16} />
              </button>

              <button
                class="btn btn-sm btn-primary btn-soft"
                onclick={() =>
                  onOpenGroupEditModal(
                    "who",
                    groupProducts!.map((p) => p.data.$id),
                    groupProducts!.map((p) => p.data),
                  )}
                onmouseenter={() =>
                  (hoverHelp.msg =
                    "Définissez qui est responsable de l'achat de tous les produits de ce groupe")}
                onmouseleave={() => hoverHelp.reset()}
                title="Gérer les volontaires pour tous les produits de ce groupe"
              >
                <Users size={16} />
                <span class="hidden @md:block"> Volontaires </span>
                <SquarePen size={16} />
              </button>

              <!-- Bouton validation groupée -->
              {#if groupProducts!.some((p) => p.data.displayMissingQuantity !== "✅ Complet")}
                <button
                  class="btn btn-sm btn-primary btn-soft"
                  onclick={() =>
                    onOpenGroupPurchaseModal(groupProducts!.map((p) => p.data))}
                  title="Ouvrir le modal d'achat groupé"
                  onmouseenter={() =>
                    (hoverHelp.msg =
                      "Déclarez tout ou partie des produits de ce groupe comme acheté")}
                  onmouseleave={() => hoverHelp.reset()}
                >
                  <ShoppingCart size={16} />
                  <span class="hidden @md:block"> Achat groupé </span>
                  <CircleCheckBig size={16} />
                </button>
              {/if}
            </div>
          {:else if productsStore.dateStore.hasPastDatesInRange}
            <div class="flex flex-wrap items-center justify-end gap-2">
              <div
                class="alert px-4 py-1"
                title="Contient des dates passées - actions non disponibles"
              >
                <Clock size={16} />
                <span class="hidden @md:block">
                  Période partiellement passée
                </span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Cards des produits du groupe -->
      {#if viewMode === "compact"}
        <div class="divide-neutral/20 my-2 mb-8 divide-y">
          {#each groupProducts as productModel (productModel.data.$id)}
            <ProductCardCompact
              {productModel}
              {shouldShowActionButtons}
              {onOpenModal}
              {onQuickValidation}
            />
          {/each}
        </div>
      {:else}
        <div class="mt-4 mb-8 space-y-4 sm:space-y-2">
          {#each groupProducts as productModel (productModel.data.$id)}
            <ProductCard
              {productModel}
              {shouldShowActionButtons}
              {onOpenModal}
              {onQuickValidation}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  <!-- Sentinelle pour lazy loading -->
  {#if paginatedGroupEntries.length < allGroupEntries.length}
    <div bind:this={sentinel} class="py-8 text-center print:hidden">
      <span class="loading loading-spinner loading-md"></span>
    </div>
  {/if}
</div>

<!-- Vue TABLEAU pour l'impression (Alternative compacte) -->
<div class="print-only w-full">
  {#each Object.entries(groupedProducts) as [groupKey, groupProducts] (groupKey)}
    <div class="break-inside-avoid">
      {#if groupKey !== ""}
        <div class="mt-6 mb-2">
          <div class="border-b-2 border-gray-800 pb-1 font-bold uppercase">
            {groupKey === "Non défini" ? "Groupe inconnu" : groupKey}
            <span class="ml-2 text-sm font-normal normal-case opacity-70"
              >({groupProducts.length} produits)</span
            >
            <span class="float-right ml-auto text-xs font-normal opacity-50">
              {#if productsStore.dateStore.isFullRange}
                Toute la période
              {:else if productsStore.dateStore.start !== productsStore.dateStore.end}
                du {formatedStartDateRange} au {formatedEndDateRange}
              {:else}
                le {formatedStartDateRange}
              {/if}
            </span>
          </div>
        </div>
      {/if}

      <div class="overflow-x-auto">
        <table class="table-compact table w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-400 bg-gray-100 text-left">
              <th class="w-1/12 border px-2 py-1">Check</th>
              <th class="w-4/12 border px-2 py-1">Produit</th>
              <th class="w-2/12 border px-2 py-1">Besoin</th>
              {#if filters.groupBy === "store"}
                <th class="w-3/12 border px-2 py-1">Qui / Type</th>
              {:else}
                <th class="w-3/12 border px-2 py-1">Store / Qui</th>
              {/if}
              <th class="w-2/12 border px-2 py-1 text-right">Acheté</th>
            </tr>
          </thead>
          <tbody>
            {#each groupProducts as productModel (productModel.data.$id)}
              {@const product = productModel.data}
              {@const productInDateRange = productModel.stats}
              {@const consolidatedPurchases = formatPurchasesWithBadges(
                product.purchases || [],
              )}

              <tr class="break-inside-avoid border-b border-gray-300">
                <td class="border px-2 py-1 text-center">
                  <div class="mx-auto h-4 w-4 border border-gray-400"></div>
                </td>
                <td
                  class="border px-2 py-1 font-medium"
                  style="max-width: 200px;"
                >
                  <div class="truncate">{product.productName}</div>
                  {#if product.previousNames && product.previousNames.length > 0}
                    <span
                      class="block truncate text-[9pt] font-normal opacity-60"
                      >(Ancien: {product.previousNames[0]})</span
                    >
                  {/if}
                </td>
                <td class="border px-2 py-1 text-sm font-bold text-nowrap">
                  {#if product.totalNeededOverrideParsed?.totalOverride}
                    {product.totalNeededOverrideParsed.totalOverride.q}
                    {product.totalNeededOverrideParsed.totalOverride.u}
                  {:else}
                    {productInDateRange.formattedQuantities}
                  {/if}
                </td>
                <td class="border px-2 py-1 text-sm" style="max-width: 160px;">
                  {#if filters.groupBy === "store"}
                    <!-- Si groupé par STORE, on montre WHO et TYPE -->
                    <div class="flex items-baseline gap-1">
                      {#if product.who?.length}
                        <span
                          class="truncate font-medium"
                          style="max-width: 80px;"
                          >{product.who
                            .map((w) =>
                              w.length > 8 ? w.slice(0, 8) + "…" : w,
                            )
                            .join(", ")}</span
                        >
                      {/if}
                      <span class="text-[9pt] text-nowrap opacity-70">
                        {product.productType || "Autre"}
                      </span>
                    </div>
                  {:else}
                    <!-- Sinon (groupé par TYPE ou aucun), on montre STORE et WHO -->
                    <div class="flex items-baseline gap-1">
                      {#if product.storeInfo?.storeName}
                        <span
                          class="truncate font-medium"
                          style="max-width: 80px;"
                        >
                          {product.storeInfo.storeName}
                        </span>
                      {/if}
                      {#if product.who?.length}
                        <span
                          class="truncate text-[9pt] opacity-70"
                          style="max-width: 80px;"
                        >
                          {product.who
                            .map((w) =>
                              w.length > 8 ? w.slice(0, 8) + "…" : w,
                            )
                            .join(", ")}
                        </span>
                      {/if}
                    </div>
                  {/if}
                </td>
                <td class="border px-2 py-1 text-right text-sm text-nowrap">
                  {#if product.stockParsed}
                    <span class="font-medium">
                      📦 {product.stockParsed.quantity}
                    </span>
                  {/if}
                  {#if consolidatedPurchases.length}
                    <span
                      >{consolidatedPurchases
                        .map((p) => `${p.quantity} ${p.unit}`)
                        .join(", ")}</span
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/each}
</div>

{#if Object.values(groupedProducts).flat().length === 0}
  <div class="py-8 text-center">
    <div class="alert alert-info max-md:alert-vertical">
      <svg
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      </svg>
      {#if currentEvent && currentEvent.meals && currentEvent.meals.length > 0 && currentEvent.meals.every((meal) => !meal.recipes || meal.recipes.length === 0)}
        <span>Aucune recette pour le moment</span>
      {:else}
        <span>Aucun produit trouvé avec les filtres actuels</span>
      {/if}
    </div>
  </div>
{/if}
