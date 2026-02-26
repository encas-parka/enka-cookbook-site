<script lang="ts">
  import type { RecipeIngredient, Ingredient } from "$lib/types/recipes.types";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { getProductTypeInfo } from "$lib/utils/products-display";
  import { UnitConverter } from "$lib/utils/UnitConverter";
  import {
    Plus,
    Trash2,
    TriangleAlert,
    Search,
    ChevronDown,
  } from "@lucide/svelte";
  import { nanoid } from "nanoid";
  import CreateIngredientModal from "./CreateIngredientModal.svelte";
  import { toastService } from "@/lib/services/toast.service.svelte";
  import { slide } from "svelte/transition";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    ingredients: RecipeIngredient[];
    disabled?: boolean;
  }

  let { ingredients = $bindable(), disabled = false }: Props = $props();

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let searchQuery = $state("");
  let selectedIndex = $state(-1);
  let isOpen = $state(false);
  let showAllIngredients = $state(false); // Mode "tout afficher" quand on clique sur toggle
  let containerRef: HTMLDivElement | undefined = $state();
  let inputRef: HTMLInputElement | undefined = $state();

  // Modal de création
  let showCreateModal = $state(false);
  let searchQueryForModal = $state("");

  // Filtrage des ingrédients depuis le store
  let filteredIngredients = $derived(() => {
    // Si on est en mode "tout afficher" ou si la recherche est vide, retourner tous les ingrédients
    if (showAllIngredients || searchQuery.length === 0) {
      return recipeDataStore.ingredients;
    }
    // Sinon filtrer par la recherche
    return recipeDataStore.searchIngredients(searchQuery);
  });

  // Grouper les ingrédients par type
  let groupedIngredients = $derived(() => {
    const groups: Record<string, RecipeIngredient[]> = {};

    ingredients.forEach((ingredient) => {
      const type = ingredient.type || "autres";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ingredient);
    });

    // Trier alphabétiquement dans chaque groupe
    Object.keys(groups).forEach((type) => {
      groups[type].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      );
    });

    return groups;
  });

  // Initialiser le recipeDataStore si nécessaire
  $effect(() => {
    if (!recipeDataStore.isInitialized && !recipeDataStore.loading) {
      recipeDataStore.initialize().catch((err) => {
        console.error(
          "[RecipeIngredientsEditor] Erreur lors de l'initialisation du recipeDataStore:",
          err,
        );
      });
    }
  });

  // Gérer le selectedIndex de manière réactive
  $effect(() => {
    const ingredients = filteredIngredients();
    if (ingredients.length > 0 && selectedIndex === -1) {
      selectedIndex = 0;
    } else if (ingredients.length === 0) {
      selectedIndex = -1;
    }
  });

  // Réinitialiser l'index surligné quand les options changent
  $effect(() => {
    const ingredients = filteredIngredients();
    if (ingredients.length > 0 && selectedIndex >= ingredients.length) {
      selectedIndex = 0;
    }
  });

  // Gestion du click outside
  $effect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef && !containerRef.contains(event.target as Node)) {
          isOpen = false;
          searchQuery = "";
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  });

  // ============================================================================
  // FONCTIONS
  // ============================================================================

  function addIngredientFromSearch(ingredientUuid: string) {
    const ingredientData = recipeDataStore.getIngredientByUuid(ingredientUuid);
    if (!ingredientData) return;

    const newIngredient: RecipeIngredient = {
      uuid: nanoid(),
      name: ingredientData.n,
      originalQuantity: 0,
      originalUnit: "gr.",
      normalizedQuantity: 0,
      normalizedUnit: "gr.",
      comment: "",
      allergens: ingredientData.a || [],
      type: ingredientData.t || "",
    };

    ingredients = [...ingredients, newIngredient];
    searchQuery = "";
    showAllIngredients = false;
    isOpen = false;
    selectedIndex = -1;

    // Redonner le focus à l'input pour permettre la recherche continue
    inputRef?.focus();

    const typeName = getProductTypeInfo(newIngredient.type).displayName;
    toastService.success(`Ingredient ajouté dans ${typeName}`);
  }

  function openDropdown(showAll = false) {
    if (!disabled && !recipeDataStore.loading && !recipeDataStore.error) {
      showAllIngredients = showAll;
      isOpen = true;
      selectedIndex = 0;
    }
  }

  function closeDropdown() {
    isOpen = false;
    searchQuery = "";
    showAllIngredients = false;
    selectedIndex = -1;
  }

  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown(true); // Mode "tout afficher" quand on clique sur toggle
    }
  }

  function removeIngredient(uuid: string) {
    ingredients = ingredients.filter((ing) => ing.uuid !== uuid);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        const ingredients = filteredIngredients();
        if (!isOpen) {
          openDropdown(true);
        } else if (selectedIndex < ingredients.length - 1) {
          selectedIndex++;
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (isOpen && selectedIndex > 0) {
          selectedIndex--;
        }
        break;

      case "Enter":
        event.preventDefault();
        const currentIngredients = filteredIngredients();
        if (isOpen && currentIngredients.length > 0) {
          addIngredientFromSearch(currentIngredients[selectedIndex].u);
        } else if (!isOpen) {
          openDropdown(true);
        }
        break;

      case "Escape":
        event.preventDefault();
        closeDropdown();
        inputRef?.blur();
        break;

      case "Tab":
        if (isOpen) {
          closeDropdown();
        }
        break;
    }
  }

  /**
   * Fonction utilitaire pour obtenir un aperçu de la normalisation
   */
  function getNormalizedPreview(ingredient: RecipeIngredient): string {
    if (!ingredient.originalQuantity || ingredient.originalQuantity <= 0) {
      return "";
    }

    const conversion = UnitConverter.normalize(
      ingredient.originalQuantity,
      ingredient.originalUnit || "",
      ingredient.name,
    );

    if (!conversion.hasConversion) {
      return "";
    }

    return `≈ ${conversion.quantity} ${conversion.unit}`;
  }

  /**
   * Gère l'événement onBlur pour afficher un aperçu de la normalisation
   */
  function handleQuantityBlur(ingredient: RecipeIngredient) {
    // La normalisation se fera à la sauvegarde, mais on peut afficher un aperçu ici si besoin
    // Cette fonction peut être utilisée pour déclencher des effets visuels si nécessaire
  }

  /**
   * Ouvre la modal de création d'ingrédient
   */
  function openCreateModal() {
    searchQueryForModal = searchQuery.trim();
    showCreateModal = true;
    closeDropdown();
  }

  /**
   * Gère la création d'un ingrédient et l'ajoute à la recette
   */
  function handleIngredientCreated(newIngredient: Ingredient) {
    // Ajouter automatiquement l'ingrédient créé à la recette
    addIngredientFromSearch(newIngredient.u);
  }
</script>

<div class="space-y-4" id="recipe-ingredients-editor">
  <!-- Indicateur de chargement -->
  {#if recipeDataStore.loading}
    <div class="card bg-base-100 border-base-300 border shadow-sm">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <div class="loading loading-spinner loading-sm"></div>
          <span class="text-sm">Chargement des ingrédients...</span>
        </div>
      </div>
    </div>
  {:else if recipeDataStore.error}
    <div class="card bg-error/10 border-error/20 border shadow-sm">
      <div class="card-body p-4">
        <div class="text-error flex items-center gap-3">
          <TriangleAlert class="h-4 w-4" />
          <span class="text-sm"
            >Erreur lors du chargement: {recipeDataStore.error}</span
          >
        </div>
      </div>
    </div>
  {:else}
    <!-- Recherche et ajout d'ingrédient -->
    <div class="card bg-base-100 border-base-300 border shadow-sm">
      <div class="card-body gap-3 p-3">
        <div class="flex items-center gap-2 font-bold">
          <Plus class="text-primary h-4 w-4" />
          Ajouter un ingrédient
        </div>

        <div class="mt-2" bind:this={containerRef}>
          <div class="relative">
            <!-- Input container -->
            <div
              class="input flex w-full items-center gap-2 pr-10 {disabled
                ? 'input-disabled'
                : ''}"
            >
              <Search class="h-4 w-4 opacity-50" />
              <input
                bind:this={inputRef}
                type="text"
                bind:value={searchQuery}
                placeholder="Rechercher un ingrédient..."
                {disabled}
                class="w-full bg-transparent outline-none"
                oninput={() => {
                  if (!isOpen && searchQuery.length > 0) {
                    openDropdown(false); // Mode filtré pendant la frappe
                  }
                }}
                onkeydown={handleKeydown}
                autocomplete="off"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls="ingredients-list"
                aria-activedescendant={isOpen
                  ? `ingredient-${selectedIndex}`
                  : undefined}
              />
            </div>

            <!-- Dropdown toggle button -->
            <button
              type="button"
              class="btn btn-ghost btn-sm absolute top-1/2 right-1 -translate-y-1/2"
              onclick={toggleDropdown}
              {disabled}
              aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              <ChevronDown
                class="h-4 w-4 transition-transform {isOpen
                  ? 'rotate-180'
                  : ''}"
              />
            </button>

            <!-- Dropdown options -->
            {#if isOpen}
              {@const ingredients = filteredIngredients()}

              <div
                id="ingredients-list"
                class="border-base-300 bg-base-100 absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border shadow-lg"
                role="listbox"
              >
                {#if ingredients.length === 0}
                  <div class="text-base-content/50 px-4 py-2 text-sm">
                    Aucun ingrédient trouvé
                  </div>

                  <!-- Option "Créer" -->
                  {#if searchQuery.trim().length > 0}
                    <div class="border-base-300 mt-1 border-t pt-1">
                      <button
                        type="button"
                        class="hover:bg-primary/20 text-primary flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer"
                        onclick={() => openCreateModal()}
                        {disabled}
                      >
                        <Plus class="h-4 w-4" />
                        <span class="text-sm font-medium"
                          >Créer un nouvel ingrédient...</span
                        >
                        <span class="text-base-content/50 text-xs"
                          >"{searchQuery}"</span
                        >
                      </button>
                    </div>
                  {/if}
                {:else}
                  {#each ingredients as ingredient, index (ingredient.u)}
                    <button
                      type="button"
                      id="ingredient-{index}"
                      class="hover:bg-base-200 flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer {index ===
                      selectedIndex
                        ? 'bg-base-200'
                        : ''}"
                      onclick={() => addIngredientFromSearch(ingredient.u)}
                      onmouseenter={() => (selectedIndex = index)}
                      role="option"
                      aria-selected={index === selectedIndex}
                      {disabled}
                    >
                      <div class="flex-1">
                        <span class="truncate text-sm font-medium"
                          >{ingredient.n}</span
                        >
                      </div>
                    </button>
                  {/each}

                  <!-- Option "Créer" après les résultats -->
                  {#if searchQuery.trim().length > 0}
                    <div class="border-base-300 mt-1 border-t pt-1">
                      <button
                        type="button"
                        class="hover:bg-primary/20 text-primary flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer"
                        onclick={() => openCreateModal()}
                        {disabled}
                      >
                        <Plus class="h-4 w-4" />
                        <span class="text-sm font-medium"
                          >Créer un nouvel ingrédient...</span
                        >
                      </button>
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Liste des ingrédients groupés par type -->
  {#if ingredients.length > 0}
    {#each Object.entries(groupedIngredients()) as [type, typeIngredients] (type)}
      {@const typeInfo = getProductTypeInfo(type)}
      {@const TypeIcon = typeInfo.icon}

      <!-- Card pour le type -->
      <div class="card bg-base-300 border-base-300 border shadow-sm">
        <div class="card-body p-2">
          <div
            class="card-title text-secondary/80 flex items-center gap-2 px-4 text-sm font-semibold"
          >
            <TypeIcon class="h-4 w-4" />
            {typeInfo.displayName}
            <span class="badge badge-xs badge-primary badge-soft"
              >{typeIngredients.length}</span
            >
          </div>

          <!-- Liste des ingrédients de ce type -->
          <div class="space-y-3">
            {#each typeIngredients as ingredient, index (index)}
              {@const preview = getNormalizedPreview(ingredient)}

              <div
                class="card bg-base-100 border-base-200 border shadow-sm"
                transition:slide
              >
                <div class="card-body p-3">
                  <div class="flex items-start justify-between gap-3">
                    <!-- Contenu principal -->
                    <div class="flex-1 space-y-2">
                      <!-- Nom + quantité & unit -->
                      <div class="flex flex-wrap gap-2">
                        <div
                          class="item-start flex min-w-1/2 flex-1 justify-between"
                        >
                          <div class="text-base font-medium">
                            {ingredient.name}
                          </div>
                          <!-- Bouton supprimer -->
                          <button
                            class="btn btn-ghost btn-sm btn-square text-error"
                            onclick={() => removeIngredient(ingredient.uuid)}
                            title="Supprimer cet ingrédient"
                            {disabled}
                          >
                            <Trash2 class="h-4 w-4" />
                          </button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <label class="input input-sm w-44">
                            <span class="label text-base-content/80"
                              >Quantité</span
                            >
                            <div class="flex items-center gap-1">
                              <input
                                type="number"
                                class="text-center"
                                bind:value={ingredient.originalQuantity}
                                min="0"
                                step="0.1"
                                placeholder="0"
                                onblur={() => handleQuantityBlur(ingredient)}
                                disabled={ingredient.originalUnit === "au goût"}
                              />
                            </div>
                          </label>
                          <label class="select select-sm w-44">
                            <span class="label text-base-content/80">unité</span
                            >
                            <select
                              bind:value={ingredient.originalUnit}
                              class="text-center"
                              {disabled}
                              onblur={() => handleQuantityBlur(ingredient)}
                              onchange={() => {
                                if (ingredient.originalUnit === "au goût")
                                  ingredient.originalQuantity = 1;
                              }}
                            >
                              <option value="kg">Kg</option>
                              <option value="gr.">gr.</option>
                              <option value="unité">unité</option>
                              <option value="l.">l.</option>
                              <option value="ml">ml</option>
                              <option value="c. à soupe">c. à soupe</option>
                              <option value="c. à café">c. à café</option>
                              <option value="pincées">pincées</option>
                              <option value="tête·s">tête·s</option>
                              <option value="gousse·s">gousse·s</option>
                              <option value="bottes">bottes</option>
                              <option value="au goût">au goût</option>
                            </select>
                          </label>
                        </div>
                        <!-- Aperçu de la normalisation -->
                        {#if preview}
                          <div class="text-base-content/60 text-xs italic">
                            {preview}
                          </div>
                        {/if}
                      </div>

                      <!-- Commentaire -->
                      <label class="input input-sm w-full">
                        <span class="label">Note</span>
                        <input
                          type="text"
                          bind:value={ingredient.comment}
                          placeholder="Ex: coupées en dés; pour la sauce..."
                          maxlength="100"
                          {disabled}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<!-- Modal de création d'ingrédient -->
<CreateIngredientModal
  bind:open={showCreateModal}
  initialName={searchQueryForModal}
  onIngredientCreated={handleIngredientCreated}
/>
