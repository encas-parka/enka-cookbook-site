<script lang="ts">
  import {
    Eraser,
    UtensilsCrossed,
    Salad,
    Cookie,
    Flame,
    Cloud,
    Calendar,
    FunnelX,
  } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import AutocompleteInput from "$lib/components/ui/AutocompleteInput.svelte";
  import BadgeList from "$lib/components/ui/BadgeList.svelte";
  import { globalState } from "../../stores/GlobalState.svelte";
  import CheckboxBadge from "../ui/CheckboxBadge.svelte";

  interface Filters {
    categories: string[];
    regimes: string[];
    temperature: string;
    cuisson: string;
    saison: string;
    testedStatus: "all" | "tested" | "untested";
    ingredients: string[];
  }

  interface Props {
    filters: Filters;
    disabled?: boolean;
    availableCategories: string[];
    availableRegimes: string[];
    availableIngredients: string[];
    onReset: () => void;
  }

  let {
    filters = $bindable(),
    disabled = false,
    availableCategories,
    availableRegimes,
    availableIngredients,
    onReset,
  }: Props = $props();

  // Gestion des checkboxes multiples
  function toggleArrayItem(array: string[], item: string) {
    const index = array.indexOf(item);
    if (index === -1) {
      array.push(item);
    } else {
      array.splice(index, 1);
    }
    // Trigger reactivity
    filters = { ...filters };
  }

  // Gestion des ingrédients avec autocomplete
  let ingredientSearch = $state("");

  function addIngredient(ingredient: string) {
    if (!filters.ingredients.includes(ingredient)) {
      filters.ingredients.push(ingredient);
      // Trigger reactivity
      filters = { ...filters };
    }
  }

  function removeIngredient(ingredient: string, index: number) {
    const idx = filters.ingredients.indexOf(ingredient);
    if (idx !== -1) {
      filters.ingredients.splice(idx, 1);
      // Trigger reactivity
      filters = { ...filters };
    }
  }

  // Filtrer les ingrédients disponibles pour l'autocomplétion
  let availableIngredientsForAutocomplete = $derived(
    availableIngredients.filter((ing) => !filters.ingredients.includes(ing)),
  );
</script>

<div class="space-y-4 sm:mt-16" class:opacity-30={disabled}>
  <div class="mb-4 flex items-center justify-between">
    <h4 class="text-lg font-bold">Filtres</h4>
    <button class="btn btn-warning btn-sm" onclick={onReset} {disabled}>
      <FunnelX class="h-4 w-4" />
      Effacer
    </button>
  </div>

  <!-- Catégories -->
  <Fieldset legend="Catégories" iconComponent={UtensilsCrossed}>
    <div class="flex flex-wrap gap-3">
      {#each availableCategories as category}
        <CheckboxBadge
          checked={filters.categories.includes(category)}
          label={category}
          onchange={() => toggleArrayItem(filters.categories, category)}
          {disabled}
        />
      {/each}
    </div>
  </Fieldset>

  <!-- Régimes -->
  <Fieldset legend="Régimes" iconComponent={Salad}>
    <div class="flex flex-wrap gap-3">
      {#each availableRegimes as regime}
        <CheckboxBadge
          checked={filters.regimes.includes(regime)}
          label={regime}
          onchange={() => toggleArrayItem(filters.regimes, regime)}
          {disabled}
        />
      {/each}
    </div>
  </Fieldset>

  <!-- Ingrédients -->
  <Fieldset legend="Ingrédients" iconComponent={Cookie}>
    <!-- Input avec autocomplétion -->
    <div class="mb-3">
      <AutocompleteInput
        items={availableIngredientsForAutocomplete}
        onSelect={addIngredient}
        placeholder="Ajouter un ingrédient..."
        {disabled}
        minQueryLength={1}
        bind:value={ingredientSearch}
      />
    </div>

    <!-- Liste des ingrédients sélectionnés -->
    <div>
      <div class="mb-2 text-xs font-medium">
        Ingrédients sélectionnés ({filters.ingredients.length})
      </div>
      <BadgeList
        items={filters.ingredients}
        onRemove={removeIngredient}
        badgeClass="badge-success"
        {disabled}
        itemKey={(item, index) => item}
      />
    </div>
  </Fieldset>

  <!-- Recettes testées -->
  <Fieldset legend="Testé">
    <div class="bg-base-100 flex gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm flex-1 {filters.testedStatus === 'all' &&
          'btn-secondary'}"
        type="button"
        aria-label="Toutes"
        onclick={() => (filters.testedStatus = "all")}>Toutes</button
      >
      <button
        class="btn btn-sm flex-1 {filters.testedStatus === 'tested' &&
          'btn-success'}"
        type="button"
        aria-label="Testées"
        onclick={() => (filters.testedStatus = "tested")}>Testées</button
      >
      <button
        class="btn btn-sm flex-1 {filters.testedStatus === 'untested' &&
          'btn-error'}"
        type="button"
        aria-label="Non testées"
        onclick={() => (filters.testedStatus = "untested")}>À tester</button
      >
    </div>
  </Fieldset>

  <!-- Service (Température) -->
  <Fieldset legend="Service" iconComponent={Flame}>
    <div class="bg-base-100 flex gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm flex-1 {filters.temperature === '' &&
          'btn-secondary'}"
        type="button"
        aria-label="Indifférent"
        onclick={() => (filters.temperature = "")}>Indifférent</button
      >
      <button
        class="btn btn-sm flex-1 {filters.temperature === 'Chaud' &&
          'btn-error'}"
        type="button"
        aria-label="Servir chaud"
        onclick={() => (filters.temperature = "Chaud")}>Chaud</button
      >
      <button
        class="btn btn-sm flex-1 {filters.temperature === 'Froid' &&
          'btn-info'}"
        type="button"
        aria-label="Servir froid"
        onclick={() => (filters.temperature = "Froid")}>Froid</button
      >
    </div>
  </Fieldset>

  <!-- Cuisson -->
  <Fieldset legend="Cuisson" iconComponent={Cloud}>
    <div class="bg-base-100 flex gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm flex-1 {filters.cuisson === '' && 'btn-secondary'}"
        type="button"
        aria-label="Indifférent"
        onclick={() => (filters.cuisson = "")}>Indifférent</button
      >
      <button
        class="btn btn-sm flex-1 {filters.cuisson === 'Oui' && 'btn-warning'}"
        type="button"
        aria-label="Avec cuisson"
        onclick={() => (filters.cuisson = "Oui")}>Avec</button
      >
      <button
        class="btn btn-sm flex-1 {filters.cuisson === 'Non' && 'btn-success'}"
        type="button"
        aria-label="Sans cuisson"
        onclick={() => (filters.cuisson = "Non")}>Sans</button
      >
    </div>
  </Fieldset>

  <!-- Saison -->
  <Fieldset legend="Saison" iconComponent={Calendar}>
    <div class="bg-base-100 flex flex-wrap gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm flex-1 {filters.saison === '' && 'btn-secondary'}"
        type="button"
        aria-label="Indifférent"
        onclick={() => (filters.saison = "")}>Toutes</button
      >
      <button
        class="btn btn-sm flex-1 {filters.saison === 'printemps' &&
          'btn-success'}"
        type="button"
        aria-label="Printemps"
        onclick={() => (filters.saison = "printemps")}>Printemps</button
      >
      <button
        class="btn btn-sm flex-1 {filters.saison === 'ete' && 'btn-warning'}"
        type="button"
        aria-label="Été"
        onclick={() => (filters.saison = "ete")}>Été</button
      >
      <button
        class="btn btn-sm flex-1 {filters.saison === 'automne' && 'btn-accent'}"
        type="button"
        aria-label="Automne"
        onclick={() => (filters.saison = "automne")}>Automne</button
      >
      <button
        class="btn btn-sm flex-1 {filters.saison === 'hiver' && 'btn-info'}"
        type="button"
        aria-label="Hiver"
        onclick={() => (filters.saison = "hiver")}>Hiver</button
      >
    </div>
  </Fieldset>
</div>
