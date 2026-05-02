<script lang="ts">
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import { CalendarPlus } from "@lucide/svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type { EnrichedEvent } from "$lib/types/events.d";
  import type { RecettesTypeR } from "$lib/types/recipes.types";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    recipeId: string;
    recipeTitle: string;
    recipeTypeR: RecettesTypeR;
    events: EnrichedEvent[];
  }

  let { isOpen, onClose, recipeId, recipeTitle, recipeTypeR, events }: Props =
    $props();

  let selectedEventId = $state("");
  let isSubmitting = $state(false);

  // Réinitialiser la sélection quand le modal s'ouvre
  $effect(() => {
    if (isOpen) {
      selectedEventId = events[0]?.id ?? "";
    }
  });

  async function handleConfirm() {
    if (!selectedEventId) return;
    isSubmitting = true;

    try {
      const event = events.find((e) => e.id === selectedEventId);
      const eventName = event?.name ?? "l'événement";

      await toastService.track(
        eventsStore.addRecipeToEvent(selectedEventId, recipeId, recipeTypeR),
        {
          loading: "Ajout en cours...",
          success: `Recette ajoutée à ${eventName}`,
          error: "Erreur lors de l'ajout",
        },
      );
      onClose();
    } catch {
      // Géré par toastService
    } finally {
      isSubmitting = false;
    }
  }
</script>

<ModalContainer {isOpen} {onClose} maxWidth="sm">
  <ModalHeader title="Ajouter à un événement" {onClose} />
  <ModalContent>
    <p class="text-base-content/70 mb-4 text-sm">
      Ajouter <span class="font-semibold">{recipeTitle}</span> à un événement à venir.
      La recette sera mise de côté sans date — vous pourrez lui attribuer un repas
      depuis la page de l'événement.
    </p>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Choisir un événement</legend>
      <div class="flex flex-col gap-2">
        {#each events as event (event.id)}
          {@const isSelected = selectedEventId === event.id}
          <label
            class="cursor-pointer rounded-lg px-3 py-2 transition-colors {isSelected
              ? 'bg-primary/20 ring-primary ring-1'
              : 'bg-base-200 hover:bg-base-300'}"
          >
            <div class="flex items-center gap-3">
              <input
                type="radio"
                name="event-select"
                class="radio radio-primary radio-sm"
                bind:group={selectedEventId}
                value={event.id}
              />
              <div class="flex-1">
                <div class="font-medium">{event.name}</div>
                {#if event.dateStart}
                  <div class="text-base-content/60 text-xs">
                    {formatDateDayMonthShort(event.dateStart)}
                    {#if event.dateEnd && event.dateEnd !== event.dateStart}
                      — {formatDateDayMonthShort(event.dateEnd)}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </label>
        {/each}
      </div>
    </fieldset>
  </ModalContent>
  <ModalFooter>
    <button class="btn btn-ghost" onclick={onClose} disabled={isSubmitting}>
      Annuler
    </button>
    <button
      class="btn btn-primary"
      onclick={handleConfirm}
      disabled={!selectedEventId || isSubmitting}
    >
      {#if isSubmitting}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <CalendarPlus class="h-4 w-4" />
      {/if}
      Ajouter
    </button>
  </ModalFooter>
</ModalContainer>
