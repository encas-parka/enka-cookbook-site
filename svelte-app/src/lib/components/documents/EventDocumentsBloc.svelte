<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { navigate } from "$lib/router";
  import { Clock, FileText, Plus } from "@lucide/svelte";
  import { formatDateRelative } from "@/lib/utils/date-helpers";

  interface Props {
    eventId: string;
    tag: string;
    tagLabel: string;
    canEdit: boolean;
  }

  let { eventId, tag, tagLabel, canEdit }: Props = $props();

  // Documents filtrés par tag
  const docs = $derived(teamdocsStore.getEventDocumentsByTag(eventId, tag));

  // Trier par date de modification (plus récent d'abord)
  const sortedDocs = $derived(
    [...docs].sort(
      (a, b) =>
        new Date(b.updated || 0).getTime() -
        new Date(a.updated || 0).getTime(),
    ),
  );
</script>

{#if canEdit}
  <div class="rounded-box bg-base-100 p-4 shadow">
    <div class="mb-3 flex items-start justify-between">
      <h3 class="flex items-center gap-2 text-sm font-semibold">
        <FileText class="h-4 w-4" />
        Documents {tagLabel}
      </h3>
      {#if canEdit}
        <button
          class="btn btn-primary btn-sm btn-soft"
          onclick={() =>
            navigate(`/event/${eventId}/document/create`, { search: { tag } })}
        >
          <Plus class="h-3 w-3" />
          Nouveau
        </button>
      {/if}
    </div>

    {#if sortedDocs.length > 0}
      <div class="flex flex-wrap items-center gap-4">
        {#each sortedDocs.slice(0, 5) as doc (doc.id)}
          <a
            class="bg-base-200/60 hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded-lg p-3 text-sm shadow-sm transition-colors"
            href={`/event/${eventId}/document/${doc.id}`}
          >
            <FileText class="text-primary h-3 w-3 shrink-0" />
            <span class="truncate font-medium">{doc.title}</span>
            <div
              class="text-base-content/60 ms-4 flex items-center gap-1 text-xs"
            >
              <Clock class="h-3 w-3" />
              <span>Modifié {formatDateRelative(doc.updated)}</span>
            </div>
          </a>
        {/each}
        {#if sortedDocs.length > 5}
          <a
            class="link link-primary link-sm"
            href={`/event/${eventId}/documents`}
          >
            Voir les {sortedDocs.length} documents →
          </a>
        {/if}
      </div>
    {:else}
      <p class="text-base-content/60 text-sm">Aucun document pour cette page</p>
    {/if}
  </div>
{/if}
