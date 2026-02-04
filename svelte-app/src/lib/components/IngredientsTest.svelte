<script lang="ts">
  import { onMount } from "svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";

  let searchQuery = $state("");
  let selectedType = $state("");

  // Résultats filtrés
  const filteredIngredients = $derived.by(() => {
    let results = recipeDataStore.ingredients;

    // Filtre par recherche
    if (searchQuery.trim()) {
      results = recipeDataStore.searchIngredients(searchQuery);
    }

    // Filtre par type
    if (selectedType) {
      results = results.filter((ing) => ing.t === selectedType);
    }

    return results;
  });

  onMount(async () => {
    try {
      await recipeDataStore.initialize();
    } catch (error) {
      console.error("Erreur d'initialisation:", error);
    }
  });
</script>

<div class="container mx-auto p-4">
  <h1 class="mb-4 text-2xl font-bold">Test recipeDataStore</h1>

  {#if recipeDataStore.loading}
    <div class="alert alert-info">
      <span>Chargement des ingrédients...</span>
    </div>
  {:else if recipeDataStore.error}
    <div class="alert alert-error">
      <span>Erreur: {recipeDataStore.error}</span>
    </div>
  {:else}
    <!-- Stats -->
    <div class="stats mb-4 shadow">
      <div class="stat">
        <div class="stat-title">Total Ingrédients</div>
        <div class="stat-value">{recipeDataStore.count}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Types</div>
        <div class="stat-value">{recipeDataStore.availableTypes.length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Allergènes</div>
        <div class="stat-value">
          {recipeDataStore.availableAllergens.length}
        </div>
      </div>
    </div>

    <!-- Filtres -->
    <div class="mb-4 flex gap-4">
      <input
        type="text"
        placeholder="Rechercher un ingrédient..."
        class="input input-bordered flex-1"
        bind:value={searchQuery}
      />
      <select class="select select-bordered" bind:value={selectedType}>
        <option value="">Tous les types</option>
        {#each recipeDataStore.availableTypes as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
    </div>

    <!-- Liste des ingrédients -->
    <div class="overflow-x-auto">
      <table class="table-zebra table">
        <thead>
          <tr>
            <th>UUID</th>
            <th>Nom</th>
            <th>Type</th>
            <th>Allergènes</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredIngredients as ingredient (ingredient.u)}
            <tr>
              <td><code class="text-xs">{ingredient.u}</code></td>
              <td class="font-medium">{ingredient.n}</td>
              <td>
                <span class="badge badge-outline">{ingredient.t}</span>
              </td>
              <td>
                {#if ingredient.a && ingredient.a.length > 0}
                  {#each ingredient.a as allergen}
                    <span class="badge badge-warning badge-sm mr-1"
                      >{allergen}</span
                    >
                  {/each}
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="4" class="text-center text-gray-400">
                Aucun ingrédient trouvé
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="mt-4 text-sm text-gray-500">
      Affichage de {filteredIngredients.length} / {recipeDataStore.count} ingrédients
      {#if recipeDataStore.lastSync}
        • Dernière sync: {new Date(recipeDataStore.lastSync).toLocaleString()}
      {/if}
    </div>
  {/if}
</div>
