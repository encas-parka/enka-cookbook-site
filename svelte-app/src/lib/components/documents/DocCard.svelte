<script lang="ts">
  import type { EnrichedTeamdoc } from "$lib/stores/TeamdocsStore.svelte";
  import { formatDateRelative } from "$lib/utils/date-helpers";
  import { navigate } from '$lib/router';
  import { FileText, Calendar, Clock, ArrowRight } from "@lucide/svelte";

  interface Props {
    doc: EnrichedTeamdoc;
    teamId: string;
    highlightedTags?: string[];
    bgClass?: string;
  }

  let {
    doc,
    teamId,
    highlightedTags = [],
    bgClass = "bg-base-200/60",
  }: Props = $props();

  function handleClick() {
    // Open in preview mode (EditDocumentPage with mode preview)
    navigate(`/editdocument/${teamId}/${doc.$id}`);
  }
</script>

<div
  class="{bgClass} hover:bg-base-200 flex cursor-pointer items-start gap-3 rounded-lg p-4 transition-colors hover:shadow-sm"
  onclick={handleClick}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
>
  <div class="min-w-0 flex-1">
    <div class="flex flex-wrap items-center gap-x-10 gap-y-2">
      <!-- Title with icon -->
      <div class="text-primary flex items-center gap-2">
        <FileText class="h-4 w-4 flex-shrink-0" />
        <div class="truncate text-sm font-medium">
          {doc.title}
        </div>
      </div>

      <!-- Status badge -->
      <!-- {#if doc.status}
        <div class="badge {getStatusBadge(doc.status)} badge-xs">
          {getStatusLabel(doc.status)}
        </div>
      {/if} -->

      <!-- Tags -->
      {#if doc.tags && doc.tags.length > 0}
        <div class="flex flex-wrap gap-1">
          {#each doc.tags as tag}
            <span
              class="badge badge-outline badge-xs"
              class:badge-primary={highlightedTags.includes(tag)}
            >
              #{tag}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Metadata -->
      <div class="text-base-content/50 me-4 flex items-center gap-3 text-xs">
        <!-- Created date -->
        <div class="flex items-center gap-1">
          <Calendar class="h-3 w-3" />
          <span>Crée {formatDateRelative(doc.$createdAt)}</span>
        </div>

        <!-- Updated date (if different from created) -->
        {#if doc.$updatedAt && doc.$updatedAt !== doc.$createdAt}
          <div class="flex items-center gap-1">
            <Clock class="h-3 w-3" />
            <span>Modifié {formatDateRelative(doc.$updatedAt)}</span>
          </div>
        {/if}
      </div>

      <!-- Lock indicator -->
      {#if doc.lockedBy}
        <div class="badge badge-warning badge-xs">Verrouillé</div>
      {/if}
    </div>
  </div>

  <ArrowRight class="mt-1 h-4 w-4 flex-shrink-0 opacity-40" />
</div>
