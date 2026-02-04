<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import type { RecipeForDisplay } from "$lib/types/recipes.types";
  import RecipeRegimeBadges from "$lib/components/recipes/RecipeRegimeBadges.svelte";
  import { Printer, Users } from "@lucide/svelte";
  import RecipeIngredientsList from "$lib/components/recipes/RecipeIngredientsList.svelte";
  import RecipePreparation from "$lib/components/recipes/RecipePreparation.svelte";
  import RecipeAlerts from "$lib/components/recipes/RecipeAlerts.svelte";
  import RecipeVariants from "$lib/components/recipes/RecipeVariants.svelte";
  import { ChefHat, PencilIcon, Copy } from "@lucide/svelte";
  import { navigate } from "$lib/router";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { globalState } from "../stores/GlobalState.svelte";
  import { onDestroy } from "svelte";
  import { getTypeDisplay } from "$lib/utils/recipeUtils";
  import RecipeMetadata from "$lib/components/recipes/RecipeMetadata.svelte";
  import { fade } from "svelte/transition";
  import { route } from "$lib/router";

  // ✅ sv-router : les params sont accessibles via route.params
  let recipeId = $derived(route.params.uuid);

  // État local
  let loading = $state(true);
  let error = $state<string | null>(null);
  let recipeDetails = $state<RecipeForDisplay | null>(null);
  let currentServings = $state(4); // Valeur par défaut

  // Réactivité du lock depuis le store (seule info venant de l'index en temps réel)
  const lockedBy = $derived(
    recipeDetails ? recipesStore.getRecipeLockStatus(recipeDetails.$id) : null,
  );

  // Réagir aux changements d'UUID
  $effect(() => {
    if (recipeId) {
      loadRecipe(recipeId);
    } else {
      error = "UUID de recette manquant";
      loading = false;
    }
  });

  // Extraire les allergènes des ingrédients
  const allergens = $derived.by(() => {
    if (!recipeDetails?.ingredients) return [];
    const uniqueAllergens = new Set<string>();
    recipeDetails.ingredients.forEach((ing) => {
      if (ing.allergens && Array.isArray(ing.allergens)) {
        ing.allergens.forEach((a) => uniqueAllergens.add(a));
      }
    });
    return Array.from(uniqueAllergens).sort();
  });

  // Charger la recette
  async function loadRecipe(uuid: string) {
    loading = true;
    error = null;

    try {
      // Charger les détails (source unique de vérité)
      const details = await recipesStore.getRecipeByUuid(uuid);
      if (!details) {
        error = "Impossible de charger les détails de la recette";
        return;
      }
      recipeDetails = details;

      // Initialiser le nombre de couverts
      currentServings = details.plate;
    } catch (err) {
      console.error("Erreur lors du chargement de la recette:", err);
      error = err instanceof Error ? err.message : "Erreur lors du chargement";
    } finally {
      loading = false;
    }
  }

  // Gérer le changement de servings
  function handleServingsChange(servings: number) {
    currentServings = servings;
  }

  // Gérer l'input des servings
  function handleServingsInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value);
    if (!isNaN(value) && value > 0) {
      currentServings = value;
    }
  }

  // Créer un index Map pour RecipeAlternatives avec les noms
  const recipesIndexMap = $derived.by(() => {
    const map = new Map();
    recipesStore.recipesIndex.forEach((recipe) => {
      map.set(recipe.$id, { n: recipe.title });
    });
    return map;
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: recipeDetails?.title || "Recette",
      actions: navActions,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });

  // Récupérer l'affichage avec la priorité : catégorie > type
  const typeDisplay = $derived.by(() =>
    recipeDetails
      ? getTypeDisplay(
          recipeDetails.typeR,
          recipeDetails.categories || undefined,
        )
      : { label: "", iconId: "no-cat" },
  );
</script>

{#snippet navActions()}
  {#if globalState.isAuthenticated && recipeDetails}
    <div class="flex items-center gap-4">
      <button
        class="btn btn-circle btn-primary max-sm:hidden"
        onclick={() => window.print()}><Printer size={18} /></button
      >
      <!-- Bouton Créer une version alternative (disponible pour tous) -->
      <button
        class="btn btn-secondary btn-sm"
        onclick={() => navigate(`/recipe/${recipeDetails?.$id}/duplicate`)}
      >
        <Copy size={18} />

        <span class="hidden sm:block">Créer une version alternative</span>
      </button>

      <!-- Bouton Éditer (réservé aux utilisateurs avec droits d'écriture) -->
      {#if (recipeDetails.permissionWrite && globalState.userId && recipeDetails.permissionWrite.includes(globalState.userId)) || (recipeDetails.createdBy && recipeDetails.createdBy === globalState.userId)}
        <button
          class="btn btn-primary btn-sm"
          onclick={() => navigate(`/recipe/${recipeDetails?.$id}/edit`)}
        >
          <PencilIcon size={18} />
          <span class="hidden sm:block">Éditer</span>
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="mx-auto max-w-7xl px-4 py-8" in:fade>
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="loading loading-spinner loading-lg"></div>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <div>
        <h3 class="font-bold">Erreur</h3>
        <div>{error}</div>
      </div>
    </div>
  {:else if recipeDetails}
    <div class="card bg-base-100">
      <div class="card-body not-md:px-1">
        <!-- En-tête -->
        <div class="mb-4 print:mb-2">
          <div class="flex items-center justify-between gap-x-10 gap-y-4">
            <div class="flex flex-wrap items-center gap-4">
              <h1
                class="text-primary flex items-center gap-3 print:text-xl print:text-black"
              >
                <svg class="me-2 size-9 shrink-0 stroke-3 print:stroke-black">
                  <use href={`/icons/sprite.svg#${typeDisplay.iconId}`} />
                </svg>
                {recipeDetails.title}
              </h1>

              <!-- version -->
              {#if recipeDetails.versionLabel}
                <div class="text-primary text-lg font-medium print:text-sm">
                  {recipeDetails.versionLabel}
                </div>
              {/if}
            </div>

            <!-- Badges régimes -->
            {#if recipeDetails?.regime && recipeDetails.regime.length > 0}
              <div class="">
                <RecipeRegimeBadges
                  regimes={recipeDetails.regime}
                  iconOnly={false}
                />
              </div>
            {/if}
          </div>
          <!-- {#if recipeDetails.auteur}
            <p class="text-base-content/60 text-lg print:text-sm">
              une recette de {recipeDetails.auteur}
            </p>
          {/if} -->
        </div>

        <!-- Description -->
        {#if recipeDetails.description || (recipeDetails.categories && recipeDetails.categories.length > 0)}
          <div class="mb-2 flex flex-wrap gap-2 print:hidden">
            {#each recipeDetails.categories as category}
              <div class="mb-2">
                <span class="badge badge-primary badge-soft">{category}</span>
              </div>
            {/each}
            <p class="text-base-content/70 text-base italic">
              {recipeDetails.description}
            </p>
          </div>
        {/if}

        <!-- badge info -->
        <div class="border-base-300 mb-6 border-b pb-4 print:mb-1 print:pb-2">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Badges allergènes -->

            <div class="flex gap-2">
              <!-- Badges température -->
              {#if recipeDetails?.serveHot !== undefined}
                <div class="mb-2">
                  {#if recipeDetails.serveHot}
                    <span class="badge badge-warning">Servir Chaud</span>
                  {:else}
                    <span class="badge badge-info">Servir Froid</span>
                  {/if}
                </div>
              {/if}

              <!-- Badges cuisson -->
              {#if recipeDetails?.cuisson !== undefined}
                <div class="mb-2">
                  {#if recipeDetails.cuisson}
                    <span class="badge badge-warning">Avec Cuisson</span>
                  {:else}
                    <span class="badge badge-info">Sans Cuisson</span>
                  {/if}
                </div>
              {/if}
            </div>

            {#if allergens.length > 0}
              <div class="flex w-fit flex-wrap items-center gap-2">
                <span class="text-base-content/70 font-semibold"
                  >Allergenes :</span
                >
                {#each allergens as allergen}
                  <span class="badge badge-error">{allergen}</span>
                {/each}
              </div>
            {/if}
            <!-- Badges matériel -->
            {#if recipeDetails?.materiel && recipeDetails.materiel.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each recipeDetails.materiel as item}
                  <span class="badge">{item}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Contrôle des quantités -->
        <div
          class="mb-6 flex flex-wrap items-center justify-between gap-6 print:hidden"
        >
          <div class="flex items-center gap-4">
            <label
              for="servings-input"
              class="flex items-center gap-2 font-medium"
            >
              <Users class="h-5 w-5" />
              Nombre de couverts à servir :
            </label>
            <input
              id="servings-input"
              type="number"
              min="1"
              value={currentServings}
              oninput={handleServingsInput}
              class="input input-bordered input-primary w-24"
            />
          </div>

          <!-- Alertes de validation -->
          {#if recipeDetails.check !== undefined}
            <RecipeAlerts
              isChecked={recipeDetails.check}
              defaultServings={recipeDetails.plate}
            />
          {/if}
        </div>

        <div class="flex justify-between">
          <p class="print-only font-medium">
            Quantité pour {currentServings} couverts
          </p>
          {#if recipeDetails.quantite_desc}
            <p class="text-end text-base">{recipeDetails.quantite_desc}</p>
          {/if}
        </div>
        <!-- Contenu principal : Ingrédients + Préparation -->
        <div
          class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 print:mt-2 print:grid-cols-10 print:gap-4"
          style="break-before: avoid;"
        >
          <!-- Ingrédients (1/3 à l'écran, 3/10 à l'impression) -->
          <div class=" lg:col-span-1 print:col-span-3">
            <div class="sticky top-4 print:static">
              <RecipeIngredientsList
                ingredients={recipeDetails.ingredients}
                servings={currentServings}
                defaultServings={recipeDetails.plate}
              />
            </div>
          </div>

          <!-- Préparation (2/3 à l'écran, 7/10 à l'impression) -->
          <div class="lg:col-span-2 print:col-span-7">
            <RecipePreparation
              preparation={recipeDetails.preparation}
              preparation24h={recipeDetails.preparation24h || undefined}
              astuces={recipeDetails.astuces || []}
            />
          </div>
        </div>
      </div>
    </div>
    <!-- Variantes de la recette -->
    {#if recipeId}
      <div class="mt-8 print:hidden">
        <RecipeVariants {recipeId} />
      </div>
    {/if}
    <!-- Métadonnées -->
    <RecipeMetadata
      auteur={recipeDetails.auteur}
      createdBy={recipeDetails.createdBy}
      id={recipeDetails.$id}
      createdAt={recipeDetails.$createdAt}
      updatedAt={recipeDetails.$updatedAt}
    />
  {/if}
</div>
