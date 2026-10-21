<script lang="ts">
  import RecipeIngredientsEditor from "$lib/components/recipeEdit/RecipeIngredientsEditor.svelte";
  import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
  import {
    Utensils,
    FileText,
    Clock,
    Lightbulb,
    X,
    Trash2,
    Triangle,
    TriangleAlert,
  } from "@lucide/svelte";

  interface Props {
    recipe: any;
    validationErrors: any;
    canEdit: boolean;
  }

  let { recipe = $bindable(), validationErrors, canEdit }: Props = $props();
</script>

<div class="mb-4 alert alert-info max-sm:alert-vertical">
  <TriangleAlert class="size-6" />
  <span>
    <ul class="mt-1 list-disc pl-5 text-sm">
      <li>
        <strong
          >Ne renseignez pas de quantités dans les préparations ni dans les
          notes des ingrédients
        </strong>: ces données ne sont pas ajustées lorsque le nombre de
        couverts est modifié.
      </li>
      <li>
        Privilégiez les quantités en gramme (gr.), kilogramme (kg), litre (l.)
        et millilitre (ml) plutôt que les unités imprécises (notamment « unité »
        pour les fruits et légumes, dont les tailles et poids varient souvent du
        simple au double).
      </li>
    </ul>
  </span>
</div>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
  <!-- Ingrédients -->
  <div
    class="card bg-base-100 shadow-xl max-sm:card-sm {validationErrors.ingredients
      ? 'ring-2 ring-error'
      : ''}"
  >
    <div class="card-body">
      <h2 class="mb-4 card-title">
        <Utensils class="h-5 w-4" />
        Ingrédients
      </h2>
      <!-- Éditeur d'ingrédients -->
      <RecipeIngredientsEditor
        bind:ingredients={recipe.ingredients}
        disabled={!canEdit}
      />
      {#if validationErrors.ingredients && recipe.ingredients.length === 0}
        <div class="mt-4 alert alert-error">
          <span class="text-sm">{validationErrors.ingredients}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Préparation -->
  <div class="card bg-base-100 shadow-xl max-sm:card-sm">
    <div class="card-body">
      <h2 class="mb-4 card-title">
        <FileText class="h-5 w-4" />
        Préparation
      </h2>

      <div class="space-y-6">
        <div class="max-h-dvh">
          <MarkdownEditor
            id="recipe-preparation"
            label="Instructions de préparation"
            bind:value={recipe.preparation}
            error={validationErrors.preparation}
            placeholder="Décrivez les étapes de préparation..."
            disabled={!canEdit}
          />
        </div>
        <div>
          <div class="max-h-dvh">
            <MarkdownEditor
              id="recipe-preparation24h"
              label="Préparation à l'avance (optionnel)"
              bind:value={recipe.preparation24h}
              error={validationErrors.preparation24h}
              placeholder="Étapes à réaliser avant le jour j..."
              disabled={!canEdit}
            />
          </div>
          <p class="text-end text-xs italic opacity-60">
            La préparation à l'avance sera mise en évidence au dessus des autres
            étapes.
          </p>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Management des Astuces -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 font-semibold">
            <Lightbulb class="h-4 w-4 text-warning" />
            Astuces et conseils
          </h3>
          <button
            type="button"
            onclick={() => {
              recipe.astuces = [...recipe.astuces, { astuce: "" }];
            }}
            disabled={!canEdit}
            class="btn btn-outline btn-primary btn-sm"
          >
            + Ajouter une astuce
          </button>
        </div>

        {#if recipe.astuces.length === 0}
          <p class="py-2 text-sm italic opacity-50">Aucune astuce ajoutée</p>
        {:else}
          <div class="space-y-3">
            {#each recipe.astuces as astuceObj, i (i)}
              <div class="flex flex-col gap-1">
                <div class="flex items-start gap-2">
                  <div class="flex-1">
                    <textarea
                      bind:value={astuceObj.astuce}
                      placeholder="Ex: Ajouter un filet d'huile d'olive au moment de servir"
                      disabled={!canEdit}
                      class="textarea-bordered textarea h-20 w-full text-sm {validationErrors
                        .astuces?.[i]
                        ? 'textarea-error'
                        : ''}"
                      maxlength="250"></textarea>
                  </div>
                  <button
                    type="button"
                    onclick={() => {
                      recipe.astuces = recipe.astuces.filter(
                        (_, idx) => idx !== i,
                      );
                    }}
                    disabled={!canEdit}
                    class="btn btn-square text-error btn-sm"
                    title="Supprimer l'astuce"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div class="flex justify-between px-1">
                  {#if validationErrors.astuces?.[i]}
                    <span class="text-xs text-error"
                      >{validationErrors.astuces[i]}</span
                    >
                  {:else}
                    <span></span>
                  {/if}
                  <span
                    class="text-xs {astuceObj.astuce.length > 250
                      ? 'font-bold text-error'
                      : 'opacity-50'}"
                  >
                    {astuceObj.astuce.length} / 250
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
