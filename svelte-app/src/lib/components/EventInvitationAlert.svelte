<script lang="ts">
  import { CircleAlert } from "@lucide/svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type { EnrichedEvent } from "$lib/types/events";

  interface Props {
    currentEvent: EnrichedEvent | null | undefined;
    isBusy: boolean;
    onRespond: (accept: boolean) => Promise<void>;
  }

  let { currentEvent, isBusy, onRespond }: Props = $props();

  const currentUserStatus = $derived.by(() => {
    if (!currentEvent) return null;

    const userId = globalState.userId || "";
    const contributor = currentEvent.contributors?.find((c) => c.id === userId);

    return contributor?.status || null;
  });

  const isVisible = $derived(currentUserStatus === "invited");
</script>

{#if isVisible}
  <div class="alert alert-info max-md:alert-vertical">
    <CircleAlert class="h-6 w-6 shrink-0" />
    <div>
      <h3 class="font-bold">Invitation à participer</h3>
      <div class="text-xs">
        Vous avez été invité à participer à cet événement. Acceptez pour pouvoir
        modifier le menu et les repas.
      </div>
    </div>
    <div class="flex gap-2">
      <button class="btn" onclick={() => onRespond(true)} disabled={isBusy}>
        Accepter
      </button>
    </div>
  </div>
{/if}
