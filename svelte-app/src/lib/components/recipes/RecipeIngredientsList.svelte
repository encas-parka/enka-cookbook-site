<script lang="ts">
  import type { RecipeIngredient } from "$lib/types/recipes.types";
  import { scaleAndFormatIngredient } from "$lib/utils/QuantityFormatter";
  import { getProductTypeInfo } from "$lib/utils/products-display";
  import { TriangleAlert } from "@lucide/svelte";
  import { SvelteMap } from "svelte/reactivity";
  import Fieldset from "../ui/Fieldset.svelte";

  interface Props {
    ingredients: RecipeIngredient[];
    servings: number;
    defaultServings: number;
  }

  let { ingredients, servings, defaultServings }: Props = $props();

  // Calculer le facteur de scaling
  const scaleFactor = $derived(servings / defaultServings);

  // Grouper les ingrédients par type
  const groupedIngredients = $derived.by(() => {
    const groups = new Map<string, RecipeIngredient[]>();

    ingredients.forEach((ingredient) => {
      const type = ingredient.type || "Autres";
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(ingredient);
    });

    return groups;
  });

  // Fonction pour scaler un ingrédient
  function getScaledIngredient(ingredient: RecipeIngredient) {
    // Scaler les quantités originales
    const scaledOriginal = scaleAndFormatIngredient(
      ingredient.originalQuantity,
      ingredient.originalUnit,
      scaleFactor,
    );

    // Scaler les quantités normalisées
    const scaledNormalized = scaleAndFormatIngredient(
      ingredient.normalizedQuantity,
      ingredient.normalizedUnit,
      scaleFactor,
    );

    return {
      ...ingredient,
      originalDisplayQuantity: scaledOriginal.formattedNumber,
      originalDisplayUnit: scaledOriginal.unit,
      normalizedDisplayQuantity: scaledNormalized.formattedNumber,
      normalizedDisplayUnit: scaledNormalized.unit,
      // Vérifier si les quantités sont différentes après scaling
      hasDifferentQuantities:
        scaledOriginal.formattedNumber !== scaledNormalized.formattedNumber ||
        scaledOriginal.unit !== scaledNormalized.unit,
    };
  }
</script>

<div class="print-xs space-y-6 print:space-y-2">
  {#each [...groupedIngredients] as [type, items] (type)}
    {@const typeInfo = getProductTypeInfo(type)}
    <Fieldset
      legend={typeInfo.displayName}
      iconComponent={typeInfo.icon}
      legendFont="font-light"
      legendSize="text-sm"
    >
      <ul class="print-xs space-y-2 print:space-y-1">
        {#each items as ingredient, index (index)}
          {@const scaled = getScaledIngredient(ingredient)}
          <li
            class="mb-0.5 grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0 text-sm"
          >
            <!-- Nom de l'ingrédient avec allergène -->
            <span
              class=" print-xs truncate font-medium"
              title={ingredient.name}
            >
              {ingredient.name} :
              {#if ingredient.allergens && ingredient.allergens.length > 0}
                <span class="ml-1 inline-flex align-middle print:hidden">
                  <TriangleAlert class="print-xs h-4 w-4 opacity-70 " />
                </span>
              {/if}
            </span>

            <!-- Quantités et commentaire -->
            <div class="flex flex-wrap items-baseline gap-x-1">
              <span>
                <span class="print-xs tabular-nums"
                  >{scaled.originalDisplayQuantity}</span
                >
                <span class="ml-1">{scaled.originalDisplayUnit}</span>
                {#if scaled.hasDifferentQuantities}
                  <span class="text-base-content/70 print-xs ml-1">
                    ({scaled.normalizedDisplayQuantity}
                    {scaled.normalizedDisplayUnit})
                  </span>
                {/if}
              </span>

              {#if ingredient.comment}
                <span
                  class="text-base-content/70 display:text-sm print-xxs before:mx-1"
                >
                  ({ingredient.comment})
                </span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </Fieldset>
  {/each}

  <div class="text-base-content/60 print-xs flex items-center gap-1 text-sm">
    <TriangleAlert class="h-4 w-4" />
    <span>→ Allergènes</span>
  </div>
</div>
