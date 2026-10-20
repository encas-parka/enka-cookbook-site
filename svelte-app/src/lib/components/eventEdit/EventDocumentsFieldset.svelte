<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { navigate } from "$lib/router";
  import { PlusIcon, FileText } from "@lucide/svelte";
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
      {#each docs as doc (doc.id)}
        <a
          class="flex cursor-pointer items-center gap-2 rounded-lg bg-base-200/60 p-4 shadow-sm transition-colors hover:bg-base-200"
          href={`/event/${eventId}/document/${doc.id}/edit`}
        >
          <FileText class="h-4 w-4 shrink-0 text-primary" />
          <span class="flex-1 truncate font-medium">{doc.title}</span>
        </a>
      {/each}
    {:else}
      <p class="py-2 text-xs text-base-content/50">Aucun document</p>
    {/if}

    {#if canEdit}
      <button
        class="btn w-full justify-start gap-2 btn-ghost btn-sm"
        onclick={() =>
          navigate(`/event/${eventId}/document/create` as `/${string}`)}
      >
        <PlusIcon class="h-4 w-4" />
        Créer un document
      </button>
    {/if}
  </div>
</Fieldset>
