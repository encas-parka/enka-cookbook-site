<script lang="ts">
  import {
    Calendar,
    Users,
    Trash2,
    Copy,
    PencilLine,
    Plus,
    Utensils,
    ChefHat,
    X,
    Moon,
    CloudSun,
    Sun,
    type Icon as IconType,
    Check,
    RefreshCcw,
  } from "@lucide/svelte";
  import type { EventMeal, EventMealRecipe } from "$lib/types/events.d";
  import type {
    RecipeIndexEntry,
    RecettesTypeR,
  } from "$lib/types/recipes.types";
  import RecipeSearchCard from "./RecipeSearchCard.svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { formatDateShort } from "$lib/utils/products-display";
  import { fade } from "svelte/transition";
  import {
    extractDate,
    extractTime,
    dateToDateTime,
  } from "$lib/utils/date-helpers";
  import { flip } from "svelte/animate";
  import { untrack } from "svelte";

  interface Props {
    meal: EventMeal;
    onDelete: () => void;
    defaultGuests?: number;
    isEditing?: boolean;
    onEditToggle?: () => void;
    allDates?: string[];
    onEmptySearchSubmit?: () => void;
    disabled?: boolean;
  }

  let {
    meal = $bindable(),
    onDelete,
    defaultGuests = 100,
    isEditing = $bindable(false),
    onEditToggle,
    allDates = [],
    onEmptySearchSubmit,
    disabled = false,
  }: Props = $props();

  // Forcer le mode preview si disabled
  $effect(() => {
    if (disabled && isEditing) {
      isEditing = false;
    }
  });

  // État pour le focus automatique sur le champ de recherche
  let shouldFocusSearch = $state(false);

  // Initialisation des valeurs par défaut si vide
  // svelte-ignore state_referenced_locally
  if (!meal.guests) meal.guests = defaultGuests;
  if (!meal.recipes) meal.recipes = [];

  // Variables dérivées pour l'UI (extraction date et moment depuis meal.date)
  let displayTime = $derived(extractTime(meal.date || ""));

  // Initialiser les valeurs d'entrée avec les valeurs actuelles
  let newDateInput = $state(extractDate(meal.date || ""));
  let newTimeInput = $state(extractTime(meal.date || ""));

  let newDateTime = $derived(
    newTimeInput ? dateToDateTime(newDateInput, newTimeInput) : "",
  );

  // État pour savoir si la date actuelle du repas est en double dans allDates
  // On vérifie si meal.date apparaît plus d'une fois dans allDates
  let isDuplicateDate = $derived.by(() => {
    if (!meal.date) return false;

    // Compter combien de fois la date actuelle apparaît dans allDates
    const dateOccurrences = allDates.filter(
      (date) => date === meal.date,
    ).length;

    // Si la date apparaît plus d'une fois, c'est un doublon
    return dateOccurrences > 1;
  });

  function dateChange({ newDate = "", newMoment = "" }) {
    const currentMealDateTime = meal.date || "";

    if (newDate || newMoment) {
      meal.date = newDateTime;
    }
  }

  const TimeIcon: typeof IconType = $derived.by(() => {
    const time = displayTime || "";
    if (time === "matin") {
      return CloudSun;
    } else if (time === "midi") {
      return Sun;
    } else if (time === "soir") {
      return Moon;
    }
    return Moon;
  });

  // Ordre des types de recettes pour le tri
  const typeOrder: Record<RecettesTypeR, number> = {
    entree: 1,
    plat: 2,
    dessert: 3,
    autre: 4,
  };

  // Fonction pour trier les recettes par type
  function sortRecipesByType(recipes: EventMealRecipe[]) {
    return [...recipes].sort((a, b) => {
      const orderA = typeOrder[a.typeR];
      const orderB = typeOrder[b.typeR];
      return orderA - orderB;
    });
  }

  // Effect pour maintenir les recettes triées par type dans meal.recipes
  $effect(() => {
    const sorted = sortRecipesByType(meal.recipes);
    // Vérifier si le tri est nécessaire
    const needsSort = meal.recipes.some(
      (recipe, i) => recipe.recipeUuid !== sorted[i]?.recipeUuid,
    );
    if (needsSort) {
      untrack(() => {
        meal.recipes = sorted;
      });
    }
  });

  // État pour suivre si les couverts d'une recette ont été modifiés manuellement
  // État pour savoir si les couverts d'une recette sont en mode édition
  let editablePlates = $state<Record<string, boolean>>({});

  // Fonction helper pour générer une clé unique pour une recette dans un repas
  function getRecipeKey(recipeUuid: string): string {
    return `${meal.id}-${recipeUuid}`;
  }

  // Initialiser editablePlates
  $effect(() => {
    meal.recipes.forEach((recipe) => {
      const key = getRecipeKey(recipe.recipeUuid);
      if (editablePlates[key] === undefined) {
        editablePlates[key] = false;
      }
    });
  });

  // Effect pour synchroniser recipe.plates avec meal.guests
  // IMPORTANT : Utilise recipe.hasOwnPlatesNb (persisté) au lieu d'un state local
  $effect(() => {
    const targetGuests = meal.guests;

    meal.recipes.forEach((recipe) => {
      // Synchroniser uniquement si :
      // - Pas marqué comme modifié manuellement (champ persisté)
      // - Pas en mode édition
      // - La valeur actuelle est différente de meal.guests
      if (
        !recipe.hasOwnPlatesNb &&
        !editablePlates[getRecipeKey(recipe.recipeUuid)] &&
        recipe.plates !== targetGuests
      ) {
        untrack(() => {
          recipe.plates = targetGuests;
        });
      }
    });
  });

  function handleAddRecipe(recipe: RecipeIndexEntry) {
    // Vérifier si la recette existe déjà pour éviter les doublons
    const alreadyExists = meal.recipes.some((r) => r.recipeUuid === recipe.$id);
    if (alreadyExists) return; // Ignorer silencieusement l'ajout d'une recette déjà présente

    const newRecipe: EventMealRecipe = {
      recipeUuid: recipe.$id,
      plates: meal.guests,
      typeR: recipe.typeR,
      hasOwnPlatesNb: false, // Auto-sync par défaut pour les nouvelles recettes
    };

    // Créer une copie profonde pour éviter les liaisons
    meal.recipes = [...meal.recipes, { ...newRecipe }];
  }

  function removeRecipe(recipeUuid: string) {
    meal.recipes = meal.recipes.filter(
      (recipe) => recipe.recipeUuid !== recipeUuid,
    );
  }

  function getRecipeIndex(uuid: string) {
    const result = recipesStore.getRecipeIndexByUuid(uuid);
    return result;
  }

  function getRecipeShortUuid(uuid: string): string {
    return uuid.split("_")[0];
  }

  function isRecipeMissing(uuid: string): boolean {
    return !getRecipeIndex(uuid);
  }

  // État pour la modal de confirmation
  let showDeleteConfirm = $state(false);

  // Fonction de gestion du clic sur supprimer
  function handleDeleteClick() {
    if (meal.recipes.length > 0) {
      showDeleteConfirm = true;
    } else {
      onDelete();
    }
  }

  // Fonction de suppression confirmée
  function confirmDelete() {
    showDeleteConfirm = false;
    onDelete();
  }

  function handleCardClick() {
    if (disabled || (isEditing && onEditToggle)) {
      return;
    }
    if (!isEditing && onEditToggle) {
      onEditToggle();
    }
  }

  // Effect pour déclencher le focus quand isEditing change
  // $effect(() => {
  //   if (isEditing) {
  //     shouldFocusSearch = true;
  //     // Réinitialiser après un court délai
  //     setTimeout(() => {
  //       shouldFocusSearch = false;
  //     }, 100);
  //   }
  // });

  function getRecipeColor(typeR: RecettesTypeR, isMissing: boolean = false) {
    if (isMissing) return "badge-error";
    else if (typeR === "entree") return "bg-lime-100 border-lime-200";
    else if (typeR === "plat") return "bg-orange-100 border-orange-200";
    else if (typeR === "dessert") return "bg-pink-100 border-pink-200";
    else if (typeR === "autre") return "bg-purple-100 border-purple-200";
    else return "bg-base-200";
  }
</script>

<div
  class="card bg-base-100 border-base-200 border shadow-sm transition-all hover:shadow-md {isEditing
    ? 'ring-accent/40 ring-2'
    : ''} {isEditing || disabled
    ? ''
    : 'hover:ring-accent/60 cursor-pointer hover:ring-2'} {disabled
    ? 'opacity-75'
    : ''}"
  role="button"
  tabindex={isEditing || disabled ? -1 : 0}
  onclick={handleCardClick}
  onkeydown={(e) => {
    if ((e.key === "Enter" || e.key === " ") && !isEditing) handleCardClick();
  }}
>
  <div class="card-body p-4">
    <!-- Header avec Actions -->
    <div class="mb-2 flex items-start justify-between">
      <div class="flex flex-wrap items-center gap-4">
        <span
          class="text-primary text-lg font-medium {isDuplicateDate &&
            'text-error'}"
        >
          {meal.date ? formatDateShort(meal.date) : "Date non définie"}
        </span>
        <div
          class="font-base flex items-center gap-1 {isDuplicateDate &&
            'text-error'}"
        >
          <TimeIcon size={16} />
          <div>{displayTime ? displayTime.toUpperCase() : "REPAS"}</div>
        </div>
        <div class="text-base-content/80 flex items-center gap-1 font-semibold">
          <Users class="size-4 stroke-3" />
          {meal.guests} pers.
        </div>
      </div>

      <div class="flex gap-1">
        {#if isEditing}
          <button
            class="btn btn-ghost text-primary"
            onclick={() => {
              isEditing = false;
            }}
            title="Terminer l'édition"
            {disabled}
          >
            valider
          </button>

          <!-- <button
            class="btn btn-ghost btn-square"
            onclick={onDuplicate}
            title="Dupliquer"
            {disabled}
          >
            <Copy class="h-4 w-4" />
          </button> -->
          <button
            class="btn btn-ghost btn-square text-error"
            onclick={handleDeleteClick}
            title="Supprimer"
            {disabled}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            onclick={() => {
              isEditing = true;
              if (onEditToggle) onEditToggle();
            }}
            title="Éditer"
            {disabled}
          >
            <PencilLine class="h-4 w-4" />
          </button>
        {/if}
      </div>
    </div>

    {#if isEditing}
      <div class="mt-2 flex flex-wrap space-y-4">
        <!-- Configuration Repas -->
        <div class="flex flex-wrap gap-4">
          <!-- Date -->
          <fieldset class="">
            <label class="input {isDuplicateDate ? 'input-error' : ''}">
              <span class="label">Date</span>
              <input
                type="date"
                class="w-full"
                bind:value={newDateInput}
                onchange={() => dateChange({ newDate: newDateInput })}
              />
            </label>
            {#if isDuplicateDate}
              <p class="text-error mt-1 text-xs">
                Cette date/heure est déjà utilisée
              </p>
            {/if}
          </fieldset>

          <!-- Moment -->
          <label class="select">
            <span class="label"> Moment </span>
            <select
              class="w-full {isDuplicateDate ? 'select-error' : ''}"
              bind:value={newTimeInput}
              onchange={() => dateChange({ newMoment: newTimeInput })}
            >
              <option value="" disabled selected>Choisir un moment</option>
              <option value="matin">Matin</option>
              <option value="midi">Midi</option>
              <option value="soir">Soir</option>
            </select>
          </label>

          <!-- Couverts global meal -->
          <div>
            <label class="input">
              <span class="label">
                <Utensils class="text-base-content/50 me-1 h-4 w-4" />
                Couverts
              </span>
              <input
                type="number"
                class="w-full"
                bind:value={meal.guests}
                min="1"
              />
            </label>
            <p class="text-base-content/60 pl-2 text-xs">
              Peut etre modifié individuellement pour chaque recette
            </p>
          </div>
        </div>

        <!-- Liste des Recettes -->
        <div class="w-full space-y-2 py-4">
          <div class="flex items-center justify-between">
            <div
              class="text-base-content/70 flex items-center gap-2 font-medium"
            >
              <ChefHat class="size-5" />
              Recettes
            </div>
          </div>

          {#if meal.recipes.length >= 1}
            <div class="mb-4 space-y-2">
              {#each meal.recipes as recipe, i (recipe.recipeUuid)}
                {@const recipeIndex = getRecipeIndex(recipe.recipeUuid)}
                {@const isMissing = isRecipeMissing(recipe.recipeUuid)}
                <div
                  animate:flip={{ duration: 200 }}
                  class="bg-base-200 flex flex-wrap items-center gap-3 rounded-lg p-3 {isMissing &&
                    'border-error border-2'}"
                >
                  <!-- Icône -->
                  <div class="flex flex-1 items-center gap-2">
                    <div
                      class="{getRecipeColor(
                        recipe.typeR,
                        isMissing,
                      )} rounded-md border-2 p-2"
                    >
                      <ChefHat class="h-5 w-5" />
                    </div>

                    <!-- Infos Recette -->
                    <div class="min-w-56 flex-1">
                      <div class="font-medium">
                        {recipeIndex?.title ||
                          getRecipeShortUuid(recipe.recipeUuid)}
                        {#if isMissing}
                          <span class="text-error ms-2 text-sm font-normal">
                            (Recette introuvable)
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>

                  <!-- Contrôles d'édition -->
                  <div class="me-10 flex items-center gap-2">
                    <!-- Type -->
                    <select class="select w-24" bind:value={recipe.typeR}>
                      <option value="entree">Entrée</option>
                      <option value="plat">Plat</option>
                      <option value="dessert">Dessert</option>
                      <option value="autre">Autre</option>
                    </select>

                    <!-- Couverts -->
                    {#if editablePlates[getRecipeKey(recipe.recipeUuid)]}
                      <div
                        class="ring-base-300 flex items-center gap-1 rounded-xl p-1 ring-1"
                      >
                        <div class="input w-28">
                          <Utensils class="h-4 w-4 opacity-50" />
                          <input
                            type="number"
                            class="w-full text-center"
                            bind:value={recipe.plates}
                            min="1"
                          />
                        </div>

                        <button
                          class="btn btn-sm btn-circle me-1"
                          onclick={() => {
                            editablePlates[getRecipeKey(recipe.recipeUuid)] =
                              false;
                          }}
                          title="Valider"
                        >
                          <Check class="text-success h-4 w-4" />
                        </button>
                        <button
                          class="btn btn-sm btn-circle"
                          onclick={() => {
                            editablePlates[getRecipeKey(recipe.recipeUuid)] =
                              false;
                            recipe.hasOwnPlatesNb = false;
                            recipe.plates = meal.guests;
                          }}
                          title="Revenir au nombre de couvert du repas ({meal.guests})"
                        >
                          <RefreshCcw class="text-secondary h-4 w-4" />
                        </button>
                      </div>
                    {:else}
                      <button
                        class="btn {!recipe.hasOwnPlatesNb
                          ? 'btn-ghost'
                          : 'btn-soft btn-warning'}"
                        onclick={() => {
                          const key = getRecipeKey(recipe.recipeUuid);
                          editablePlates[key] = true;
                          recipe.hasOwnPlatesNb = true;
                        }}
                        title="Éditer les couverts"
                      >
                        <span class="font-normal">
                          {recipe.plates}
                          pers.
                        </span>
                        <PencilLine
                          size={14}
                          class="text-base-content/70  ms-1"
                        />
                      </button>
                    {/if}
                  </div>
                  <div class="ms-auto">
                    <!-- Supprimer -->
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => removeRecipe(recipe.recipeUuid)}
                      title="Retirer la recette"
                      {disabled}
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          <RecipeSearchCard
            onSelect={handleAddRecipe}
            defaultPlates={meal.guests}
            autoFocus={shouldFocusSearch}
            onEmptySubmit={onEmptySearchSubmit}
            {disabled}
          />
        </div>
      </div>
    {:else}
      <!-- Mode Preview -->
      <div class="space-y-2">
        {#if meal.recipes.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each meal.recipes as recipe (recipe.recipeUuid)}
              {@const recipeIndex = getRecipeIndex(recipe.recipeUuid)}
              {@const isMissing = isRecipeMissing(recipe.recipeUuid)}
              <div
                class="badge badge-lg {getRecipeColor(
                  recipe.typeR,
                  isMissing,
                )} h-auto gap-2 py-1 font-medium {isMissing
                  ? 'ring-error ring-1'
                  : ''}"
              >
                <ChefHat class="h-4 w-4" />
                <span
                  >{recipeIndex?.title ||
                    getRecipeShortUuid(recipe.recipeUuid)}</span
                >
                <span class="badge badge-sm badge-outline font-normal">
                  {recipe.plates}
                  <Utensils size={12} />
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-base-content/60 text-sm italic">Aucune recette</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Modal de confirmation de suppression -->
  <ConfirmModal
    isOpen={showDeleteConfirm}
    title="Supprimer le repas"
    message={`Ce repas contient ${meal.recipes.length} recette(s). Êtes-vous sûr de vouloir le supprimer ?`}
    variant="danger"
    confirmLabel="Supprimer"
    cancelLabel="Annuler"
    onConfirm={confirmDelete}
    onCancel={() => (showDeleteConfirm = false)}
  />
</div>
