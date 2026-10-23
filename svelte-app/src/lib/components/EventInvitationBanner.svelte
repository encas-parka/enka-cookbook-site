<script lang="ts">
  import { CircleAlert } from "@lucide/svelte";
  import { route } from "$lib/router";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";

  /**
   * Bandeau d'invitation RSVP, partagé par toute la branche /event/:id
   * (monté une fois dans le layout du routeur). Il gère seul son occupation :
   * il décide de se montrer — invité (virtuel ou réel) ou décliné — et rend
   * rien pour le créateur, un participant confirmé ou un hors canaux.
   */

  // État d'occupation propre au bandeau, découplé de celui des pages.
  let isBusy = $state(false);

  const eventId = $derived(route.params.id);
  const rsvpStatus = $derived(
    eventId ? eventsStore.getRsvpStatus(eventId) : null,
  );

  async function respond(accept: boolean) {
    if (!eventId) return;
    isBusy = true;
    try {
      await toastService.track(
        eventsStore.respondToInvitation(eventId, accept),
        {
          loading: "Enregistrement de votre réponse...",
          success: accept
            ? "Vous participez à cet événement"
            : "Réponse enregistrée — vous pourrez changer d'avis",
          error: "Erreur lors de l'enregistrement de votre réponse",
        },
      );
    } catch {
      // L'échec est déjà notifié par toastService.track.
    } finally {
      isBusy = false;
    }
  }
</script>

{#if rsvpStatus === "invited"}
  <div
    class="alert alert-info max-md:alert-vertical mx-4 mt-4 print:hidden"
    role="status"
  >
    <CircleAlert class="h-6 w-6 shrink-0" />
    <div>
      <h3 class="font-bold">Invitation à participer</h3>
      <div class="text-sm">
        Vous avez été invité à participer à cet événement. Acceptez pour pouvoir
        l'éditer : menus, repas, tâches, achats, matériel, documents.
      </div>
    </div>
    <div class="flex gap-2">
      <button
        class="btn btn-sm"
        onclick={() => respond(false)}
        disabled={isBusy}
      >
        Refuser
      </button>
      <button
        class="btn btn-primary btn-sm"
        onclick={() => respond(true)}
        disabled={isBusy}
      >
        Accepter
      </button>
    </div>
  </div>
{:else if rsvpStatus === "declined"}
  <div class="alert max-md:alert-vertical mx-4 mt-4 print:hidden" role="status">
    <CircleAlert class="h-6 w-6 shrink-0" />
    <div>
      <h3 class="font-bold">Invitation déclinée</h3>
      <div class="text-sm">
        Vous avez décliné cette invitation. Vous gardez un accès en lecture.
      </div>
    </div>
    <button
      class="btn btn-primary btn-sm"
      onclick={() => respond(true)}
      disabled={isBusy}
    >
      Je participe finalement
    </button>
  </div>
{/if}
