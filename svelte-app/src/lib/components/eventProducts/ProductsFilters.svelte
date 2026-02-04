<script lang="ts">
  import {
    FunnelIcon,
    FunnelX,
    Search,
    ShoppingBasket,
    Snowflake,
    Store,
    Thermometer,
    User,
    X,
  } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { getProductTypeInfo } from "$lib/utils/products-display";
  import TimelineRange from "../ui/TimelineRange.svelte";
  import Fieldset from "../ui/Fieldset.svelte";
  import { slide } from "svelte/transition";
  import { hoverHelp } from "@/lib/stores/GlobalState.svelte";

  const filters = $derived(productsStore.filters);
  const uniqueStores = $derived(productsStore.uniqueStores);
  const uniqueWho = $derived(productsStore.uniqueWho);
  const uniqueProductTypes = $derived(productsStore.uniqueProductTypes);
  const isSearchActive = $derived(productsStore.isSearchActive);
</script>

<div class="mt-16 mb-4 flex items-center justify-between">
  <h3 class="flex items-center gap-2 text-lg font-semibold">
    <FunnelIcon class="h-5 w-5" />
    Filtres
  </h3>
  <button
    class="btn btn-sm btn-error btn-outline"
    onclick={() => productsStore.clearFilters()}
    disabled={!productsStore.hasFilters}
  >
    <FunnelX class="h-4 w-4" />
    Tout effacer
  </button>
</div>

<div class="mb-4 grid grid-cols-1 items-center justify-between gap-4">
  <div class="">
    <label class="label" for="search-input">
      <span class="label-text">Recherche</span>
    </label>
    <div class="input flex items-center gap-2">
      <Search class="h-4 w-4" />
      <input
        id="search-input"
        type="text"
        placeholder="Nom du produit..."
        class="grow"
        value={filters.searchQuery}
        oninput={(e) => productsStore.setSearchQuery(e.currentTarget.value)}
      />
      <button
        class="btn btn-xs btn-circle btn-error btn-outline opacity-60"
        onclick={() => productsStore.setSearchQuery("")}
        disabled={!filters.searchQuery}
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>

  {#if !productsStore.hasSingleDateEvent}
    <Fieldset legend="Date incluses" bgClass="bg-base-100">
      <TimelineRange dateStore={productsStore.dateStore} />

      {#if productsStore.hasPastDatesInRange}
        <div class="alert alert-warning" transition:slide>
          Cette période contient des dates passées. Les achats ne sont plus
          possibles pour ces dates.
        </div>
      {/if}
    </Fieldset>
  {/if}

  {#if isSearchActive}
    <div class="alert alert-warning text-sm" transition:slide>
      <span>🔎 Les filtres sont désactivés pendant une recherche par nom.</span>
    </div>
  {/if}

  <div
    class="space-y-4 {isSearchActive ? 'pointer-events-none opacity-50' : ''}"
    class:transition-opacity={true}
  >
    <!-- Filtre de statut de complétion -->
    <div class="flex flex-col" class:disabled-look={isSearchActive}>
      <label class="label flex" for="completion-status">
        <span class="label-text">Statut :</span>
      </label>
      <div
        class="bg-base-100 flex gap-1 rounded-xl p-2 font-semibold"
        id="completion-status"
      >
        <button
          class="btn flex-1 {filters.completionStatus === 'all' &&
            'btn-primary'}"
          type="button"
          aria-label="Tous"
          onclick={() => productsStore.setCompletionStatus("all")}>Tous</button
        >
        <button
          class="btn flex-1 {filters.completionStatus === 'incomplete' &&
            'btn-warning'}"
          type="button"
          aria-label="Incomplets"
          onclick={() => productsStore.setCompletionStatus("incomplete")}
          ><span class="add-to-cart"></span> Manque</button
        >
        <button
          class="btn flex-1 {filters.completionStatus === 'completed' &&
            'btn-success'}"
          type="button"
          aria-label="Complétés"
          onclick={() => productsStore.setCompletionStatus("completed")}
          ><span class="cart-icon"></span> Complet</button
        >
      </div>
    </div>

    <!-- Groupement -->
    <div class="mb-4 flex flex-col">
      <label class="label flex" for="grouping-select">
        <span class="label-text">Groupement par:</span>
      </label>
      <div
        class=" bg-base-100 flex gap-1 rounded-xl p-2 font-semibold"
        id="grouping-select"
      >
        <button
          class="btn flex-1 {filters.groupBy === 'none' && 'btn-secondary'}"
          type="button"
          aria-label="Aucun"
          onclick={() => productsStore.setGroupBy("none")}>Aucun</button
        >
        <button
          class="btn flex-1 {filters.groupBy === 'store' && 'btn-secondary'}"
          type="button"
          aria-label="Par magasin"
          onclick={() => productsStore.setGroupBy("store")}>Magasins</button
        >
        <button
          class="btn flex-1 {filters.groupBy === 'productType' &&
            'btn-secondary'}"
          type="button"
          aria-label="Par type"
          onclick={() => productsStore.setGroupBy("productType")}>Type</button
        >
      </div>
    </div>

    <!-- Filtres par type, température, magasin et qui -->
    {#if uniqueProductTypes.length > 0}
      <Fieldset legend="Types & Température" iconComponent={Thermometer}>
        <div class="mb-2 flex flex-wrap items-center gap-2" role="group">
          {#each uniqueProductTypes as type (type)}
            {@const typeInfo = getProductTypeInfo(type)}
            <button
              class="btn btn-sm {filters.selectedProductTypes.length === 0
                ? 'btn-soft btn-secondary'
                : filters.selectedProductTypes.includes(type)
                  ? 'btn-secondary'
                  : 'btn-dash btn-secondary'}"
              onclick={() => productsStore.toggleProductType(type)}
            >
              <typeInfo.icon class="mr-1 h-5 w-5" />
              {typeInfo.displayName}
            </button>
          {/each}
        </div>
        <!-- Filtres température -->
        <div
          class="bg-base-100 flex flex-wrap gap-1 rounded-xl p-2 font-semibold"
          role="group"
        >
          <button
            class="btn btn-sm flex-1 {filters.temperatureFilter === 'all'
              ? 'btn-secondary'
              : 'btn-soft btn-secondary'}"
            onclick={() => productsStore.setTemperatureFilter("all")}
            type="button"
            aria-label="Tous"
            onmouseenter={() =>
              (hoverHelp.msg = "Ne pas filter en fonction des températures")}
            onmouseleave={() => hoverHelp.reset()}>Tous</button
          >
          <button
            class="btn btn-sm flex-1 {filters.temperatureFilter === 'frais'
              ? 'btn-success'
              : 'btn-soft btn-success'}"
            onclick={() => productsStore.setTemperatureFilter("frais")}
            type="button"
            aria-label="Frais uniquement"
            onmouseenter={() =>
              (hoverHelp.msg = "Afficher les produits frais uniquement")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <ShoppingBasket class="h-4 w-4" />
            Frais
          </button>
          <button
            class="btn btn-sm flex-1 {filters.temperatureFilter === 'not-frais'
              ? 'btn-error'
              : 'btn-soft btn-error'}"
            onclick={() => productsStore.setTemperatureFilter("not-frais")}
            type="button"
            aria-label="Sans frais"
            onmouseenter={() => (hoverHelp.msg = "Exclure les produits frais")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <ShoppingBasket class="h-4 w-4" />
            <span class="line-through">Frais</span>
          </button>
          <button
            class="btn btn-sm flex-1 {filters.temperatureFilter === 'surgele'
              ? 'btn-info'
              : 'btn-soft btn-info'}"
            onclick={() => productsStore.setTemperatureFilter("surgele")}
            type="button"
            aria-label="Surgelés uniquement"
            onmouseenter={() =>
              (hoverHelp.msg = "Afficher les produits surgelés uniquement")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <Snowflake class="h-4 w-4" />
            Surgelés
          </button>
          <button
            class="btn btn-sm flex-1 {filters.temperatureFilter ===
            'not-surgele'
              ? 'btn-error'
              : 'btn-soft btn-error'}"
            onclick={() => productsStore.setTemperatureFilter("not-surgele")}
            type="button"
            aria-label="Sans surgelés"
            onmouseenter={() =>
              (hoverHelp.msg = "Exclure les produits surgelé")}
            onmouseleave={() => hoverHelp.reset()}
          >
            <Snowflake class="h-4 w-4" />
            <span class="line-through">surgelés</span>
          </button>
        </div>
        {#if filters.selectedProductTypes.length > 0 || filters.selectedTemperatures.length > 0 || filters.temperatureFilter !== "all"}
          <button
            class="btn btn-sm btn-circle btn-outline text-error ms-auto"
            onclick={() => productsStore.clearTypeAndTemperatureFilters()}
            title="Effacer les filtres de types et température"
          >
            <FunnelX size={16} />
          </button>
        {:else}
          <div class="text-base-content/60 p-1 text-end text-xs italic">
            aucun filtre sélectionné
          </div>
        {/if}
      </Fieldset>
    {/if}
    {#if uniqueStores.length > 0}
      <Fieldset legend="Magasins" iconComponent={Store}>
        <div class="flex flex-wrap items-center gap-2" role="group">
          {#each uniqueStores as store (store)}
            <button
              class="btn btn-sm {filters.selectedStores.length === 0
                ? 'btn-soft btn-secondary'
                : filters.selectedStores.includes(store)
                  ? 'btn-secondary'
                  : 'btn-dash btn-secondary'}"
              onclick={() => productsStore.toggleStore(store)}
            >
              {store}
            </button>
          {/each}
          {#if filters.selectedStores.length > 0}
            <button
              class="btn btn-xs btn-circle btn-outline text-error ms-auto"
              onclick={() => productsStore.clearStoreFilters()}
              title="Effacer les filtres de magasins"
            >
              <FunnelX size={16} />
            </button>
          {/if}
        </div>
      </Fieldset>
    {/if}

    {#if uniqueWho.length > 0}
      <Fieldset legend="Qui" iconComponent={User}>
        <div class="flex flex-wrap items-center gap-2" role="group">
          {#each uniqueWho as who (who)}
            <button
              class="btn btn-sm {filters.selectedWho.length === 0
                ? ' btn-soft btn-secondary'
                : filters.selectedWho.includes(who)
                  ? ' btn-secondary'
                  : 'btn-dash btn-secondary'}"
              onclick={() => productsStore.toggleWho(who)}
            >
              {who}
            </button>
          {/each}
          {#if filters.selectedWho.length > 0}
            <button
              class="btn btn-xs btn-circle btn-outline btn-error ms-auto"
              onclick={() => productsStore.clearWhoFilters()}
              title="Effacer les filtres de qui"
            >
              <FunnelX size={16} />
            </button>
          {/if}
        </div>
      </Fieldset>
    {/if}
  </div>
</div>
