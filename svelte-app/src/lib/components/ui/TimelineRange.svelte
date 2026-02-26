<script lang="ts">
  import { Cloud, Sun, Moon } from "@lucide/svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import { getTimeIcon, DEFAULT_PURCHASE_MARGIN_HOURS } from "$lib/utils/dateRange";
  import type { DateRangeStore } from "$lib/stores/DateRangeStore.svelte";

  let {
    dateStore,
  }: {
    dateStore: DateRangeStore;
  } = $props();

  // État local dérivé du store (automatiquement synchronisé)
  let localStart = $derived(dateStore.start);
  let localEnd = $derived(dateStore.end);

  // État local pour suivre la date survolée
  let hoveredDate = $state<string | null>(null);

  function handleDateClick(clickedDate: string) {
    if (localStart && new Date(clickedDate) < new Date(localStart)) {
      dateStore.setRange(clickedDate, localEnd);
    } else if (localEnd && new Date(clickedDate) > new Date(localEnd)) {
      dateStore.setRange(localStart, clickedDate);
    } else {
      dateStore.setRange(clickedDate, clickedDate);
    }
  }

  function getPredictedRange(clickedDate: string): {
    start: string | null;
    end: string | null;
  } {
    if (!localStart || !localEnd) {
      return { start: null, end: null };
    }

    if (localStart && new Date(clickedDate) < new Date(localStart)) {
      // Étend le range vers le début
      return { start: clickedDate, end: localEnd };
    } else if (localEnd && new Date(clickedDate) > new Date(localEnd)) {
      // Étend le range vers la fin
      return { start: localStart, end: clickedDate };
    } else {
      // Crée un nouveau range avec la date cliquée
      return { start: clickedDate, end: clickedDate };
    }
  }

  function getDateButtonClass(date: string) {
    let btnClass = "";

    if (!localStart || !localEnd) return;

    const isInCurrentSelection =
      new Date(date) >= new Date(localStart) &&
      new Date(date) <= new Date(localEnd);

    // 🎯 COHÉRENCE : Utiliser la même logique que hasPastDatesInRange
    // Une date est "passée" si maintenant est après (date + marge)
    // Cela permet de montrer visuellement les repas "en cours" comme actifs
    const dateWithMargin = new Date(date);
    dateWithMargin.setHours(dateWithMargin.getHours() + DEFAULT_PURCHASE_MARGIN_HOURS);
    const isPassed = dateWithMargin < new Date();

    // Vérifier si la date serait dans le range prédit lors du survol
    let isInPredictedRange = false;
    if (hoveredDate) {
      const predictedRange = getPredictedRange(hoveredDate);
      if (predictedRange.start && predictedRange.end) {
        isInPredictedRange =
          new Date(date) >= new Date(predictedRange.start) &&
          new Date(date) <= new Date(predictedRange.end);
      }
    }

    if (isPassed) {
      btnClass += " opacity-70 italic";
    }
    if (!isInCurrentSelection) {
      btnClass += " btn-dash";
    }
    // Ajouter le style de survol prédit si applicable
    if (isInPredictedRange && !isInCurrentSelection) {
      btnClass += " btn-soft";
    }

    return btnClass;
  }
</script>

<div class="mb-2 flex flex-wrap gap-2">
  {#each dateStore.dates as date (date)}
    <button
      class="btn btn-sm btn-secondary {getDateButtonClass(date)}"
      onclick={() => handleDateClick(date)}
      onmouseenter={() => (hoveredDate = date)}
      onmouseleave={() => (hoveredDate = null)}
    >
      <span>{formatDateDayMonthShort(date)}</span>
      {#if getTimeIcon(date) === "sun"}
        <Sun size={16} />
      {:else if getTimeIcon(date) === "moon"}
        <Moon size={16} />
      {:else if getTimeIcon(date) === "cloud"}
        <Cloud size={16} />
      {/if}
    </button>
  {/each}
</div>

{#if dateStore.isEventPassed}
  <!-- Événement terminé : afficher le message -->
  <div class="text-base-content/60 p-1 text-end text-xs italic">
    événement terminé
  </div>
{:else}
  <!-- Événement en cours : afficher les boutons -->

  <div class="join my-2 ms-auto">
    <button
      type="button"
      name="options"
      class="join-item btn btn-sm {dateStore.isUpcomingRange
        ? 'btn-soft btn-secondary'
        : 'btn-ghost'}"
      aria-label=" Dates à venir"
      onclick={() => dateStore.selectUpcoming()}
    >
      Dates à venir
    </button>
    <button
      type="button"
      name="options"
      class="join-item btn btn-sm {dateStore.isFullRange
        ? 'btn-soft btn-secondary'
        : 'btn-ghost'}"
      aria-label=" Toutes les dates"
      onclick={() => dateStore.selectAll()}
    >
      Toutes les dates
    </button>
  </div>
{/if}
