<script lang="ts">
  import type { Teamdocs } from "$lib/types/pb";
  import { formatDateRelative } from "$lib/utils/date-helpers";
  import { p } from "$lib/router";
  import { FileText, Calendar, Clock, ArrowRight } from "@lucide/svelte";

  interface Props {
    doc: Teamdocs;
    teamId?: string;
    eventId?: string;
    highlightedTags?: string[];
    bgClass?: string;
  }

  let {
    doc,
    teamId,
    eventId,
    highlightedTags = [],
    bgClass = "bg-base-200/60",
  }: Props = $props();

  const href = $derived(
    eventId
      ? p(`/event/${eventId}/document/${doc.id}`)
      : teamId
        ? p(`/editdocument/${teamId}/${doc.id}`)
        : "#",
  );
</script>

<a
  class="{bgClass} group flex cursor-pointer items-start gap-3 rounded-lg p-4 shadow-sm transition-colors hover:bg-base-200 hover:shadow-md"
  {href}
>
  <div class="min-w-0 flex-1">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <!-- Title with icon -->
      <div class="flex items-center gap-2 text-primary">
        <FileText class="h-4 w-4 shrink-0 text-primary" />
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
      <div class="me-4 flex items-center gap-3 text-xs text-base-content/50">
        <!-- Created date -->
        {#if !doc.updated}
          <div class="flex items-center gap-1">
            <Calendar class="h-3 w-3" />
            <span>Crée {formatDateRelative(doc.created)}</span>
          </div>
        {/if}

        <!-- Updated date (if different from created) -->
        {#if doc.updated && doc.updated !== doc.created}
          <div class="flex items-center gap-1">
            <Clock class="h-3 w-3" />
            <span>Modifié {formatDateRelative(doc.updated)}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="flex shrink-0 flex-col items-start gap-3 sm:flex-row">
    <ArrowRight class="mt-0.5 h-4 w-4 opacity-40" />
  </div>
</a>
