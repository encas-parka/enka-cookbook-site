<script lang="ts">
  import type {
    RecipeForDisplay,
    RecettesTypeR,
  } from "$lib/types/recipes.types";
  import { recipeDrawer } from "$lib/stores/RecipeDrawer.svelte";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { getTypeDisplay } from "$lib/utils/recipeUtils";
  import RecipeIngredientsList from "./RecipeIngredientsList.svelte";
  import RecipePreparation from "./RecipePreparation.svelte";
  import RecipeRegimeBadges from "./RecipeRegimeBadges.svelte";
  import { Users, X } from "@lucide/svelte";
  import {
    Drawer,
    DrawerOverlay,
    DrawerContent,
    DrawerHandle,
  } from "@abhivarde/svelte-drawer";

  let recipe = $state<RecipeForDisplay | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Suivre le dernier recipeId fetché pour éviter un re-fetch inutile
  let lastFetchedId: string | null = null;

  $effect(() => {
    const isOpen = recipeDrawer.isOpen;
    const recipeId = recipeDrawer.recipeId;

    if (isOpen && recipeId) {
      // Ne pas re-fetch si l'ID n'a pas changé
      if (recipeId === lastFetchedId) return;

      lastFetchedId = recipeId;
      error = null;
      isLoading = true;

      recipesStore
        .getRecipeByUuid(recipeId)
        .then((data) => {
          recipe = data;
          isLoading = false;
        })
        .catch((err) => {
          console.error("[RecipeDetailDrawer] Erreur fetch:", err);
          error = "Impossible de charger la recette.";
          isLoading = false;
        });
    }

    // Quand le drawer se ferme, on reset lastFetchedId pour permettre un futur fetch
    if (!isOpen) {
      lastFetchedId = null;
    }
  });

  function handleClose() {
    recipeDrawer.closeRecipeDrawer();
  }

  function formatPlates(plates: number): string {
    if (plates === 1) return "1 couvert";
    return `${plates} couverts`;
  }

  function getRecipeColor(typeR: RecettesTypeR): string {
    if (typeR === "entree") return "bg-lime-100 border-lime-200";
    if (typeR === "plat") return "bg-orange-100 border-orange-200";
    if (typeR === "dessert") return "bg-pink-100 border-pink-200";
    if (typeR === "autre") return "bg-purple-100 border-purple-200";
    return "bg-base-200";
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case "entree":
        return "Entrée";
      case "plat":
        return "Plat";
      case "dessert":
        return "Dessert";
      case "autre":
        return "Autre";
      default:
        return type;
    }
  }
</script>

<Drawer bind:open={recipeDrawer.isOpen} direction="right">
  <DrawerOverlay class="fixed inset-0 z-1050 bg-black/40 backdrop-blur-sm" />
  <DrawerContent
    class="bg-base-100 fixed top-0 right-0 bottom-0 z-1060 flex h-full w-[90vw] max-w-lg flex-row shadow-xl"
  >
    <DrawerHandle class="mx-1 my-auto items-center bg-black/20 px-1" />

    <!-- Contenu scrollable avec padding pour HeaderNav -->
    <div
      class="min-h-0 flex-1 overflow-y-auto pb-24 md:pt-12"
      style="touch-action: pan-y;"
      role="presentation"
      onpointerdown={(e) => e.stopPropagation()}
      ontouchstart={(e) => e.stopPropagation()}
    >
      <!-- Bouton fermer -->
      <button
        class="btn btn-circle absolute top-5 right-3 z-10 md:top-15"
        onclick={handleClose}
        aria-label="Fermer"
      >
        <X class="h-5 w-5" />
      </button>

      {#if isLoading}
        <div class="flex flex-col items-center justify-center py-20">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-base-content/60 mt-4">Chargement…</p>
        </div>
      {:else if error}
        <div class="p-6">
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        </div>
      {:else if recipe}
        {@const typeDisplay = getTypeDisplay(
          recipe.typeR,
          recipe.categories || undefined,
        )}
        <div class="p-6">
          <!-- Header -->
          <div class="border-base-300 border-b pb-4">
            <!-- Ligne titre -->
            <div class="flex items-center gap-2 pr-10">
              <svg class="size-6 shrink-0">
                <use href={`/icons/sprite.svg#${typeDisplay.iconId}`} />
              </svg>
              <div class="text-xl font-bold">{recipe.title}</div>
            </div>

            <!-- Ligne badges -->
            <div class="mt-3 flex flex-wrap items-center gap-3">
              {#if recipe.typeR}
                <div class="badge font-medium {getRecipeColor(recipe.typeR)}">
                  {getTypeLabel(recipe.typeR)}
                </div>
              {/if}
              {#if recipe.regime}
                <RecipeRegimeBadges
                  regimes={recipe.regime}
                  iconOnly={true}
                  colorClass="success"
                />
              {/if}
            </div>
          </div>

          <!-- Infos -->
          <div class="flex flex-wrap items-center gap-4 py-4">
            <div class="text-base-content/80 flex items-center gap-2 text-lg">
              <Users class="h-4 w-4" />
              <span>{formatPlates(recipeDrawer.servings)}</span>
            </div>
            <div class="flex flex-wrap gap-1">
              {#if recipe.serveHot}
                <span class="badge badge-error badge-sm badge-soft"
                  >Servir Chaud</span
                >
              {:else}
                <span class="badge badge-info badge-sm badge-soft"
                  >Servir Froid</span
                >
              {/if}
              {#if recipe.cuisson}
                <span class="badge badge-warning badge-sm badge-soft"
                  >Avec Cuisson</span
                >
              {:else}
                <span class="badge badge-success badge-sm badge-soft"
                  >Sans Cuisson</span
                >
              {/if}
            </div>
            {#if recipe.materiel && recipe.materiel.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each recipe.materiel as item (item)}
                  <span class="badge badge-ghost badge-sm">{item}</span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Description -->
          {#if recipe.quantite_desc}
            <p class="text-base-content/70 pb-4 text-sm italic">
              {recipe.quantite_desc}
            </p>
          {/if}

          <!-- Grille corps : Ingrédients + Préparation -->
          <div class="flex-col gap-6">
            <div class="flex w-full space-y-4">
              <RecipeIngredientsList
                ingredients={recipe.ingredients}
                servings={recipeDrawer.servings}
                defaultServings={recipe.plate}
              />
            </div>
            <div class="flex-1 space-y-4">
              <RecipePreparation
                preparation={recipe.preparation}
                preparation24h={recipe.preparation24h || undefined}
                astuces={recipe.astuces || []}
              />
            </div>
          </div>
        </div>
      {/if}
    </div>
  </DrawerContent>
</Drawer>
