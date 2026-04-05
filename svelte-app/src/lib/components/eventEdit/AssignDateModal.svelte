<script lang="ts">
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import { CalendarPlus } from "@lucide/svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import type { EventMeal } from "$lib/types/events";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    recipeName: string;
    datedMeals: EventMeal[];
    onAssign: (targetMealId: string) => void;
    allowSetAside?: boolean;
  }

  let {
    isOpen,
    onClose,
    recipeName,
    datedMeals,
    onAssign,
    allowSetAside = false,
  }: Props = $props();

  let selectedMealId = $state("");

  // Réinitialiser la sélection quand le modal s'ouvre
  $effect(() => {
    if (isOpen) {
      selectedMealId = datedMeals[0]?.id ?? "";
    }
  });

  function formatMealLabel(meal: EventMeal): string {
    if (!meal.date) return "Date non définie";
    const date = new Date(meal.date);
    const dayName = date.toLocaleDateString("fr-FR", { weekday: "short" });
    const dateStr = formatDateDayMonthShort(meal.date);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const guests = meal.guests > 0 ? ` — ${meal.guests} convives` : "";
    return `${dayName} ${dateStr} — ${hours}h${minutes}${guests}`;
  }

  function handleConfirm() {
    if (!selectedMealId) return;
    onAssign(selectedMealId);
    onClose();
  }
</script>

<ModalContainer {isOpen} {onClose} maxWidth="sm">
  <ModalHeader title="Déplacer la recette" {onClose} />
  <ModalContent>
    <!-- <p class="text-base-content/70 mb-4 text-sm">
      Assigner <span class="font-semibold">{recipeName}</span> à un repas existant.
    </p> -->

    <fieldset class="fieldset">
      <!-- <legend class="fieldset-legend">Choisir un repas</legend> -->
      <div class="flex flex-col gap-2">
        {#if allowSetAside}
          <label
            class="bg-base-100/50 ring-warning/30 cursor-pointer rounded-lg px-3 py-2 ring-1 transition-colors {selectedMealId ===
            '__undated__'
              ? 'bg-warning/20 ring-warning ring-2'
              : 'hover:bg-base-200'}"
          >
            <div class="flex items-center gap-3">
              <input
                type="radio"
                name="meal-select"
                class="radio radio-warning radio-sm"
                bind:group={selectedMealId}
                value="__undated__"
              />
              <div class="flex-1">
                <div class="font-medium">Mettre de côté</div>
                <div class="text-base-content/60 text-xs">
                  Retirer des repas planifiés
                </div>
              </div>
            </div>
          </label>
        {/if}
        {#each datedMeals as meal (meal.id)}
          {@const isSelected = selectedMealId === meal.id}
          <label
            class="cursor-pointer rounded-lg px-3 py-2 transition-colors {isSelected
              ? 'bg-primary/20 ring-primary ring-1'
              : 'bg-base-200 hover:bg-base-300'}"
          >
            <div class="flex items-center gap-3">
              <input
                type="radio"
                name="meal-select"
                class="radio radio-primary radio-sm"
                bind:group={selectedMealId}
                value={meal.id}
              />
              <div class="flex-1">
                <div class="font-medium">{formatMealLabel(meal)}</div>
                <div class="text-base-content/60 text-xs">
                  {meal.recipes.length} recette{meal.recipes.length !== 1
                    ? "s"
                    : ""}
                </div>
              </div>
            </div>
          </label>
        {/each}
      </div>
    </fieldset>
  </ModalContent>
  <ModalFooter>
    <button class="btn btn-ghost" onclick={onClose}> Annuler </button>
    <button
      class="btn btn-primary"
      onclick={handleConfirm}
      disabled={!selectedMealId}
    >
      <CalendarPlus class="h-4 w-4" />
      Déplacer
    </button>
  </ModalFooter>
</ModalContainer>
