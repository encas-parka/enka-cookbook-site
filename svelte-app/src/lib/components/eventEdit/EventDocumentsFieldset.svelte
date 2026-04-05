<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { navigate } from "$lib/router";
  import { PlusIcon, FileText, Lock } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";

  interface Props {
    eventId: string;
    canEdit: boolean;
  }

  let { eventId, canEdit }: Props = $props();

  const docs = $derived(teamdocsStore.getEventDocuments(eventId));
</script>

<Fieldset legend="Documents" bgClass="bg-base-100">
  <div class="space-y-2">
    {#if docs.length > 0}
      {#each docs as doc (doc.$id)}
        <a
          class="bg-base-200/60 hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded-lg p-4 transition-colors"
          href={`/event/${eventId}/document/${doc.$id}/edit`}
        >
          <FileText class="text-primary h-4 w-4 shrink-0" />
          <span class="flex-1 truncate">{doc.title}</span>
          {#if doc.lockedBy && doc.lockedBy !== globalState.userId}
            <Lock class="text-warning h-3 w-3 shrink-0" />
          {/if}
        </a>
      {/each}
    {:else}
      <p class="text-base-content/50 py-2 text-xs">Aucun document</p>
    {/if}

    {#if canEdit}
      <button
        class="btn btn-ghost btn-sm w-full justify-start gap-2"
        onclick={() =>
          navigate(`/event/${eventId}/document/new` as `/${string}`)}
      >
        <PlusIcon class="h-4 w-4" />
        Créer un document
      </button>
    {/if}
  </div>
</Fieldset>
