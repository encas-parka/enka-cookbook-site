<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { GitBranch, Trash2, Info, X } from "@lucide/svelte";
  import Fieldset from "../ui/Fieldset.svelte";
  import AutocompleteInput from "../ui/AutocompleteInput.svelte";
  import ConfirmModal from "../ui/ConfirmModal.svelte";
  import type { RecipeIndexEntry } from "$lib/types/recipes.types";
  import {
    formatDateRelative,
    formatDateWdDayMonthShort,
  } from "$lib/utils/date-helpers";
  import { p } from "$lib/router";

  interface Props {
    recipe: any;
    canEdit: boolean;
  }

  let { recipe = $bindable(), canEdit }: Props = $props();

  // État local
  let variants = $state<RecipeIndexEntry[]>([]);
  let loadingVariants = $state(false);
  let showRemoveModal = $state(false);
  let variantToRemove = $state<{
    variant: RecipeIndexEntry;
    isManual: boolean;
  } | null>(null);

  // S'assurer que les champs existent dans recipe
  $effect(() => {
    if (recipe) {
      if (!recipe.manuallyAddedVariants) {
        recipe.manuallyAddedVariants = [];
      }
      if (!recipe.variantsToRemove) {
        recipe.variantsToRemove = [];
      }
    }
  });

  // Utiliser les champs de recipe au lieu des états locaux
  let manuallyAddedVariants = $derived(recipe.manuallyAddedVariants || []);
  let variantsToRemove = $derived(recipe.variantsToRemove || []);

  // Charger les variantes existantes
  async function loadVariants() {
    if (!recipe.$id) return;

    loadingVariants = true;
    try {
      const group = await recipesStore.getVariantGroup(recipe.$id, 2);
      variants = group.variants.filter((v) => v.$id !== recipe.$id);
    } catch (error) {
      console.error("[RecipeVersionManager] Error loading variants:", error);
    } finally {
      loadingVariants = false;
    }
  }

  // Charger au montage et quand recipe.$id change
  $effect(() => {
    if (recipe.$id) {
      loadVariants();
    }
  });

  // Liste des recettes pour l'autocomplétion (exclure la recette courante, variantes existantes et déjà ajoutées)
  let availableRecipes = $derived.by(() => {
    const excludedIds = new Set([
      recipe.$id,
      ...variants.map((v) => v.$id),
      ...manuallyAddedVariants.map((v) => v.$id),
      ...variantsToRemove.map((v) => v.$id),
    ]);
    return recipesStore.recipesIndex.filter((r) => !excludedIds.has(r.$id));
  });

  // Variantes à afficher (exclure celles marquées pour suppression)
  let displayVariants = $derived.by(() => {
    return variants.filter(
      (v) => !variantsToRemove.some((r) => r.$id === v.$id),
    );
  });

  // Ajouter une variante manuellement
  function handleAddVariant(variantRecipe: RecipeIndexEntry) {
    if (!recipe.$id) return;
    if (!recipe.manuallyAddedVariants) recipe.manuallyAddedVariants = [];

    if (recipe.manuallyAddedVariants.some((v) => v.$id === variantRecipe.$id))
      return;

    recipe.manuallyAddedVariants = [
      ...recipe.manuallyAddedVariants,
      variantRecipe,
    ];

    toastService.success(
      `Variante "${variantRecipe.title}" ajoutée. Sauvegardez pour appliquer.`,
    );
  }

  // Retirer une variante ajoutée manuellement
  function handleRemoveManuallyAddedVariant(variantRecipe: RecipeIndexEntry) {
    if (!recipe.manuallyAddedVariants) return;

    recipe.manuallyAddedVariants = recipe.manuallyAddedVariants.filter(
      (v) => v.$id !== variantRecipe.$id,
    );

    toastService.info(
      `Variante "${variantRecipe.title}" retirée. Sauvegardez pour appliquer.`,
    );
  }

  // Confirmer la suppression d'une variante existante
  function confirmRemoveVariant(variant: RecipeIndexEntry) {
    variantToRemove = { variant, isManual: false };
    showRemoveModal = true;
  }

  // Supprimer une variante existante (ajoutée à la liste des suppressions)
  async function handleRemoveVariant() {
    if (!variantToRemove) return;
    if (!recipe.variantsToRemove) recipe.variantsToRemove = [];

    // Ajouter à la liste des variantes à supprimer
    recipe.variantsToRemove = [
      ...recipe.variantsToRemove,
      variantToRemove.variant,
    ];

    toastService.success(
      `Variante "${variantToRemove.variant.title}" marquée pour suppression. Sauvegardez pour appliquer.`,
    );

    showRemoveModal = false;
    variantToRemove = null;
  }

  // Annuler la suppression d'une variante (remettre dans la liste d'affichage)
  function handleUndoRemove(variant: RecipeIndexEntry) {
    if (!recipe.variantsToRemove) return;

    recipe.variantsToRemove = recipe.variantsToRemove.filter(
      (v) => v.$id !== variant.$id,
    );

    toastService.info(`Suppression de "${variant.title}" annulée.`);
  }
</script>

<Fieldset iconComponent={GitBranch} legend="Gestion des versions">
  <div class="space-y-4">
    <!-- Ajouter des variantes -->
    {#if canEdit && availableRecipes.length > 0}
      <div class="space-y-2">
        <fieldset>
          <legend class="fieldset-legend">Signaler des variantes</legend>

          <AutocompleteInput
            items={availableRecipes}
            itemToString={(r) => r.title}
            onSelect={(r) => handleAddVariant(r)}
            placeholder="Rechercher une recette..."
            disabled={!canEdit}
            maxResults={10}
          />
          <p class="label">
            Liez manuellement une recette existante comme variante / alternative
            à celle-ci.
          </p>
        </fieldset>
      </div>
    {/if}

    <!-- Variantes ajoutées manuellement (affichage réactif) -->
    {#if manuallyAddedVariants.length > 0}
      <div class="space-y-2">
        <fieldset class="text-sm font-medium">
          Nouvelles variantes ({manuallyAddedVariants.length})

          <div class="space-y-2">
            {#each manuallyAddedVariants as variant}
              <div
                class="card card-compact bg-success/10 border-success/30 border-1"
              >
                <div class="card-body py-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <span class="truncate font-medium">{variant.title}</span>
                      {#if variant.versionLabel}
                        <span class="badge badge-ghost badge-xs shrink-0">
                          {variant.versionLabel}
                        </span>
                      {/if}
                    </div>
                    <button
                      class="btn btn-error btn-ghost btn-xs btn-circle"
                      onclick={() => handleRemoveManuallyAddedVariant(variant)}
                      title="Retirer cette variante"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </fieldset>
        <p class="text-xs opacity-60">
          Sauvegardez pour appliquer ces modifications.
        </p>
      </div>
    {/if}

    <div class="divider my-2"></div>

    <!-- Variantes marquées pour suppression -->
    {#if variantsToRemove.length > 0}
      <div class="space-y-2">
        <div class="text-error text-sm font-medium">
          Variantes à supprimer ({variantsToRemove.length})
        </div>
        <div class="space-y-2">
          {#each variantsToRemove as variant}
            <div class="card card-compact bg-error/10 border-error/30 border-1">
              <div class="card-body py-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <span class="truncate font-medium line-through opacity-70">
                      {variant.title}
                    </span>
                    {#if variant.versionLabel}
                      <span class="badge badge-ghost badge-xs shrink-0">
                        {variant.versionLabel}
                      </span>
                    {/if}
                  </div>
                  <button
                    class="btn btn-ghost btn-xs"
                    onclick={() => handleUndoRemove(variant)}
                    title="Annuler la suppression"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <p class="text-xs opacity-60">
          Sauvegardez pour appliquer ces suppressions.
        </p>
      </div>

      <div class="divider my-2"></div>
    {/if}

    <!-- Variantes existantes -->
    {#if loadingVariants}
      <div class="flex items-center justify-center py-4">
        <div class="loading loading-spinner loading-sm"></div>
      </div>
    {:else if displayVariants.length > 0}
      <div class="fieldset">
        <legend class="legend"
          >Variantes existantes ({displayVariants.length})</legend
        >

        <!-- Info sur l'utilité des variantes -->
        <div class="alert alert-soft alert-info max-md:alert-vertical mb-4">
          <Info class="h-4 w-4" />
          <span>
            Les variantes permettent de regrouper différentes versions d'une
            même recette (ex: avec/sans ingrédient, variations régionales,
            etc.). Cela facilite la découverte de recettes alternatives ou
            similaires.
          </span>
        </div>
        <div class="space-y-2">
          {#each displayVariants as variant}
            <div class="card card-xs bg-base-200 border-base-300 border-1">
              <div class="card-body px-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <a
                      href={p(`/recipe/${variant.$id}`)}
                      target="_blank"
                      class="link link-primary link-hover truncate font-medium"
                    >
                      {variant.title}
                    </a>
                    {#if variant.versionLabel}
                      <span class="badge badge-ghost badge-xs shrink-0">
                        {variant.versionLabel}
                      </span>
                    {/if}
                  </div>

                  {#if canEdit}
                    <button
                      class="btn btn-error btn-ghost btn-xs btn-circle shrink-0"
                      onclick={() => confirmRemoveVariant(variant)}
                      title="Retirer cette variante"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  {/if}
                </div>

                <!-- Auteur et date de création -->
                <div class="flex items-center gap-2 text-xs opacity-60">
                  <span>Par {variant.auteur || "inconnu"}</span>
                  <span>•</span>
                  <span title={variant.$createdAt}>
                    {formatDateRelative(variant.$createdAt || "")}
                  </span>
                  <span>
                    ({formatDateWdDayMonthShort(variant.$createdAt || "")})
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if !loadingVariants}
      <div class="py-4 text-center text-sm opacity-40">
        Aucune variante liée à cette recette.
      </div>
    {/if}
  </div></Fieldset
>

<!-- Modal de confirmation de suppression -->
<ConfirmModal
  isOpen={showRemoveModal}
  title="Retirer cette variante ?"
  message="Êtes-vous sûr de vouloir retirer cette recette des variantes ? Elle ne sera plus affichée comme une version alternative de cette recette, mais restera accessible dans le cookbook."
  variant="warning"
  confirmLabel="Retirer"
  cancelLabel="Annuler"
  onConfirm={() => handleRemoveVariant()}
  onCancel={() => {
    showRemoveModal = false;
    variantToRemove = null;
  }}
/>
