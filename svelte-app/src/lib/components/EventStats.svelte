<script lang="ts">
  import {
    ChartBar,
    Utensils,
    CookingPot,
    Users,
    CalendarDays,
    Calendar,
    ShoppingCart,
    AlertTriangle,
  } from "@lucide/svelte";
  import { useEventStats } from "$lib/utils/event-stats-helpers";
  import type { EnrichedEvent } from "$lib/types/events";

  let { currentEvent }: { currentEvent: EnrichedEvent | null } = $props();

  const stats = $derived(useEventStats(currentEvent));
</script>

<div class="flex flex-wrap justify-end gap-2 font-medium">
  <!-- Repas -->
  <div class="badge badge-soft badge-primary badge-lg flex items-center gap-2">
    <CalendarDays class="h-4 w-4" />
    <span>{stats.mealsCount} Repas</span>
  </div>

  <!-- Couverts -->
  <div class="badge badge-soft badge-primary badge-lg flex items-center gap-2">
    <Utensils class="h-4 w-4" />
    <span>{stats.totalGuests} Couverts</span>
  </div>

  <!-- Recettes -->
  <div class="badge badge-soft badge-primary badge-lg flex items-center gap-2">
    <CookingPot class="h-4 w-4" />
    <span>{stats.totalRecipes} Recettes</span>
  </div>

  <!-- Ingrédients -->
  <div class="badge badge-soft badge-primary badge-lg flex items-center gap-2">
    <ShoppingCart class="h-4 w-4" />
    <span>{stats.totalIngredients} Ingrédients</span>
  </div>

  <!-- Contributeurs -->
  <div class="badge badge-soft badge-primary badge-lg flex items-center gap-2">
    <Users class="h-4 w-4" />
    <span>{stats.contributorsStats.total} Participant·es</span>
  </div>

  <!-- Recettes manquantes -->
  {#if stats.missingRecipes.size > 0}
    <div
      class="badge badge-error badge-lg flex cursor-help items-center gap-2"
      title="Recettes non disponibles : {Array.from(stats.missingRecipes)
        .map((uuid) => uuid.split('_')[0])
        .join(', ')}"
    >
      <AlertTriangle class="h-4 w-4" />
      <span
        >{stats.missingRecipes.size} Recette{stats.missingRecipes.size > 1
          ? "s"
          : ""} manquante{stats.missingRecipes.size > 1 ? "s" : ""}</span
      >
    </div>
  {/if}
</div>
