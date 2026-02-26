<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { RecipeForDisplay } from "$lib/types/recipes.types";
  import type { PosterConfig } from "./poster.types";
  import { EyeOff } from "@lucide/svelte";

  interface Props {
    recipeKey: string;
    recipeUuid: string;
    plates: number;
    typeR: string;
    category: string;
    config: PosterConfig;
    visible: boolean;
    name: string;
    recipeData: RecipeForDisplay | null;
    customIngredients: string[] | null;
    isEditing: boolean;
    onToggle: (recipeKey: string) => void;
    onStartEdit: (recipeKey: string) => void;
    onFinishEdit: () => void;
    onUpdateName: (recipeKey: string, newName: string) => void;
    onUpdateIngredients: (recipeKey: string, ingredients: string[]) => void;
    onUpdateDescription: (recipeKey: string, description: string) => void;
    onToggleDescription: (recipeKey: string) => void;
    descriptionVisible: boolean;
    customDescription: string | null;
  }

  let {
    recipeKey,
    recipeUuid,
    plates,
    typeR,
    category,
    config,
    visible,
    name,
    recipeData,
    customIngredients,
    isEditing,
    onToggle,
    onStartEdit,
    onFinishEdit,
    onUpdateName,
    onUpdateIngredients,
    onUpdateDescription,
    onToggleDescription,
    descriptionVisible,
    customDescription,
  }: Props = $props();

  let editInput = $state<HTMLInputElement>();
  let ingredientInput = $state<HTMLTextAreaElement>();
  let descriptionInput = $state<HTMLTextAreaElement>();
  // svelte-ignore state_referenced_locally
  let tempName = $state(name);
  let isEditingIngredients = $state(false);
  let isEditingDescription = $state(false);
  let tempIngredients = $state("");
  let tempDescription = $state("");

  function handleStartEdit() {
    tempName = name;
    onStartEdit(recipeKey);
    setTimeout(() => {
      editInput?.focus();
      editInput?.select();
    }, 0);
  }

  function handleFinishEdit() {
    onUpdateName(recipeKey, tempName);
    onFinishEdit();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleFinishEdit();
    } else if (event.key === "Escape") {
      tempName = name;
      onFinishEdit();
    }
  }

  function handleStartEditIngredients() {
    tempIngredients = ingredientNames.join(", ");
    isEditingIngredients = true;
    setTimeout(() => {
      ingredientInput?.focus();
    }, 0);
  }

  function handleFinishEditIngredients() {
    if (!isEditingIngredients) return;

    // Nettoyage: Split, Trim, Capitalize Every Word, Set (uniques)
    const raw = tempIngredients.split(/[,;\n]/);
    const cleaned = Array.from(
      new Set(
        raw
          .map((i) => i.trim())
          .filter((i) => i.length > 0)
          .map((i) => {
            // Capitalize each word
            return i
              .toLowerCase()
              .replace(/\b\w/g, (char) => char.toUpperCase());
          }),
      ),
    );

    onUpdateIngredients(recipeKey, cleaned);
    isEditingIngredients = false;
  }

  function handleIngredientsKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleFinishEditIngredients();
    } else if (event.key === "Escape") {
      isEditingIngredients = false;
    }
  }

  function handleStartEditDescription() {
    tempDescription = displayDescription;
    isEditingDescription = true;
    setTimeout(() => {
      descriptionInput?.focus();
    }, 0);
  }

  function handleFinishEditDescription() {
    if (!isEditingDescription) return;
    onUpdateDescription(recipeKey, tempDescription.trim());
    isEditingDescription = false;
  }

  function handleDescriptionKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleFinishEditDescription();
    } else if (event.key === "Escape") {
      isEditingDescription = false;
    }
  }

  // Get display description
  let displayDescription = $derived(
    customDescription ?? recipeData?.description ?? "",
  );

  // Get ingredient names for display
  let ingredientNames = $derived.by(() => {
    if (customIngredients) return customIngredients;
    if (!recipeData?.ingredients) return [];
    return recipeData.ingredients.map((ing) => ing.name);
  });

  // Get allergens
  let allergens = $derived.by(() => {
    if (!recipeData?.ingredients) return [];
    const uniqueAllergens = new SvelteSet<string>();
    recipeData.ingredients.forEach((ing) => {
      ing.allergens?.forEach((a: string) => uniqueAllergens.add(a));
    });
    return Array.from(uniqueAllergens);
  });

  // Get regimes
  let regimes = $derived.by(() => {
    if (!recipeData?.regime) return [];
    return recipeData.regime;
  });

  // Get categories
  let categories = $derived.by(() => {
    if (!recipeData?.categories) return [];
    return recipeData.categories;
  });
  // Font size helpers
  function getBigFontSize(step: number) {
    const sizes = ["1.5rem", "2rem", "2.5rem", "3.2rem"];
    return `font-size: ${sizes[step] || "2.5rem"}`;
  }

  function getSmallFontSize(step: number) {
    const sizes = ["0.7rem", "0.85rem", "1rem", "1.2rem"];
    return `font-size: ${sizes[step] || "1rem"}`;
  }
</script>

{#if visible}
  <div class="recipe-container mb-6">
    <!-- Actions (no-print) -->
    <div class="recipe-actions no-print flex gap-1">
      <button
        class="btn btn-ghost btn-circle hover:bg-error/10 hover:text-error transition-colors"
        onclick={() => onToggle(recipeKey)}
        title="Masquer la recette"
      >
        <EyeOff />
      </button>
    </div>

    <!-- Recipe Content -->
    <div class="recipe-content bg-transparent p-0 text-center">
      <!-- Recipe Name -->
      {#if isEditing}
        <div class="mx-auto mb-2 max-w-sm">
          <label class="input input-sm w-full">
            <input
              bind:this={editInput}
              type="text"
              class="grow text-center"
              bind:value={tempName}
              onblur={handleFinishEdit}
              onkeydown={handleKeyDown}
            />
          </label>
        </div>
      {:else}
        <button
          type="button"
          class="recipe-title mb-2 block w-full border-none bg-transparent p-0 text-center text-lg text-black transition-colors hover:bg-black/5"
          class:cursor-pointer={!isEditing}
          class:montserrat-font={config.fontRecettes === "montserrat-font"}
          class:playfair-display={config.fontRecettes === "playfair-display"}
          class:oswald-font={config.fontRecettes === "oswald-font"}
          class:quicksand-font={config.fontRecettes === "quicksand-font"}
          class:dancing-script={config.fontRecettes === "dancing-script"}
          class:pacifico-regular={config.fontRecettes === "pacifico-regular"}
          class:caveat-font={config.fontRecettes === "caveat-font"}
          class:gluten-font={config.fontRecettes === "gluten-font"}
          class:font-bold={config.boldRecettes}
          class:italic={config.italicRecettes}
          style={getBigFontSize(config.fontSizeRecettes)}
          onclick={handleStartEdit}
        >
          {name}
        </button>
      {/if}

      <!-- Description -->
      {#if (config.showDescription || isEditingDescription) && (descriptionVisible || isEditingDescription)}
        <div
          class="description-container group/desc relative mx-auto max-w-xl text-center"
        >
          {#if isEditingDescription}
            <div class="mx-auto mt-2 max-w-sm">
              <textarea
                bind:this={descriptionInput}
                class="textarea textarea-bordered textarea-xs w-full text-center"
                rows="2"
                bind:value={tempDescription}
                onblur={handleFinishEditDescription}
                onkeydown={handleDescriptionKeyDown}
                placeholder="Ajouter une description..."
              ></textarea>
            </div>
          {:else}
            <div class="flex items-center justify-center gap-2 px-4">
              <button
                type="button"
                class="recipe-description block border-none bg-transparent p-0 text-sm text-black opacity-90 transition-colors hover:bg-black/5"
                class:cursor-pointer={!isEditingDescription}
                class:montserrat-font={config.fontDesc === "montserrat-font"}
                class:playfair-display={config.fontDesc === "playfair-display"}
                class:oswald-font={config.fontDesc === "oswald-font"}
                class:quicksand-font={config.fontDesc === "quicksand-font"}
                class:dancing-script={config.fontDesc === "dancing-script"}
                class:pacifico-regular={config.fontDesc === "pacifico-regular"}
                class:caveat-font={config.fontDesc === "caveat-font"}
                class:gluten-font={config.fontDesc === "gluten-font"}
                class:font-bold={config.boldDesc}
                class:italic={config.italicDesc}
                style={getSmallFontSize(config.fontSizeDesc)}
                onclick={handleStartEditDescription}
              >
                {#if displayDescription}
                  {displayDescription}
                {:else}
                  <span class="no-print opacity-50"
                    >(Cliquez pour ajouter une description)</span
                  >
                {/if}
              </button>

              <button
                class="no-print btn btn-ghost btn-circle btn-xs hover:bg-error/10 hover:text-error opacity-0 transition-opacity group-hover/desc:opacity-100"
                onclick={() => onToggleDescription(recipeKey)}
                title="Masquer la description"
              >
                <EyeOff class="h-3 w-3 opacity-50" />
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Labels (Categories & Régimes) -->
      {#if config.showRegimes && regimes.length > 0}
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          {#each regimes as regime (regime)}
            <span
              class="border-black
              bg-transparent
              font-medium
              text-black"
              class:montserrat-font={config.fontRegimes === "montserrat-font"}
              class:playfair-display={config.fontRegimes === "playfair-display"}
              class:oswald-font={config.fontRegimes === "oswald-font"}
              class:quicksand-font={config.fontRegimes === "quicksand-font"}
              class:dancing-script={config.fontRegimes === "dancing-script"}
              class:pacifico-regular={config.fontRegimes === "pacifico-regular"}
              class:caveat-font={config.fontRegimes === "caveat-font"}
              class:gluten-font={config.fontRegimes === "gluten-font"}
              class:font-bold={config.boldRegimes}
              class:italic={config.italicRegimes}
              style={getSmallFontSize(config.fontSizeRegimes)}
            >
              {regime}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Info Footer (Allergens & Ingredients) -->
      <div class="mt-3 space-y-1 text-black">
        <!-- Allergènes -->
        {#if config.showAllergens && allergens.length > 0}
          <div class="text-xs">
            <span class="text-[0.6rem] font-bold tracking-widest uppercase"
              >Attention:
            </span>
            <span
              class:montserrat-font={config.fontAlert === "montserrat-font"}
              class:playfair-display={config.fontAlert === "playfair-display"}
              class:oswald-font={config.fontAlert === "oswald-font"}
              class:quicksand-font={config.fontAlert === "quicksand-font"}
              class:dancing-script={config.fontAlert === "dancing-script"}
              class:pacifico-regular={config.fontAlert === "pacifico-regular"}
              class:caveat-font={config.fontAlert === "caveat-font"}
              class:gluten-font={config.fontAlert === "gluten-font"}
              class:font-bold={config.boldAlert}
              class:italic={config.italicAlert}
              style={getSmallFontSize(config.fontSizeAlert)}
              class="opacity-80"
            >
              {allergens.join(", ")}
            </span>
          </div>
        {/if}

        <!-- Ingredients -->
        {#if config.showIngredients && (ingredientNames.length > 0 || isEditingIngredients)}
          <div class="text-xs">
            <span class="text-[0.6rem] font-bold tracking-widest uppercase"
              >Ingrédients:
            </span>
            {#if isEditingIngredients}
              <div class="mx-auto mt-1 max-w-sm">
                <textarea
                  bind:this={ingredientInput}
                  class="textarea textarea-bordered textarea-xs w-full text-center"
                  rows="3"
                  bind:value={tempIngredients}
                  onblur={handleFinishEditIngredients}
                  onkeydown={handleIngredientsKeyDown}
                  placeholder="Liste d'ingrédients séparés par des virgules..."
                ></textarea>
                <p
                  class="mt-1 text-[0.5rem] tracking-tighter uppercase opacity-50"
                >
                  Entrée pour valider · Maj+Entrée pour nouvelle ligne
                </p>
              </div>
            {:else}
              <button
                type="button"
                class="mx-auto block border-none bg-transparent p-0 text-xs font-normal capitalize decoration-dotted opacity-80 transition-colors hover:bg-black/5 hover:underline"
                class:cursor-pointer={!isEditingIngredients}
                class:montserrat-font={config.fontIng === "montserrat-font"}
                class:playfair-display={config.fontIng === "playfair-display"}
                class:oswald-font={config.fontIng === "oswald-font"}
                class:quicksand-font={config.fontIng === "quicksand-font"}
                class:dancing-script={config.fontIng === "dancing-script"}
                class:pacifico-regular={config.fontIng === "pacifico-regular"}
                class:caveat-font={config.fontIng === "caveat-font"}
                class:gluten-font={config.fontIng === "gluten-font"}
                class:font-bold={config.boldIng}
                class:italic={config.italicIng}
                style={getSmallFontSize(config.fontSizeIng)}
                onclick={handleStartEditIngredients}
              >
                {ingredientNames.join(", ")}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .recipe-container {
    position: relative;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }

  .recipe-actions {
    position: absolute;
    top: -10px;
    right: -30px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .recipe-container:hover .recipe-actions {
    opacity: 1;
  }

  .recipe-title {
    line-height: 1.2;
    letter-spacing: 0.02em;
  }

  .recipe-description {
    max-width: 55ch;
    line-height: 1.4;
  }

  @media print {
    .recipe-actions {
      display: none !important;
    }

    .recipe-container {
      margin-bottom: 2.5rem;
    }
  }
</style>
