<script lang="ts">
  import type { EnrichedTeamdoc } from "$lib/stores/TeamdocsStore.svelte";
  import { formatDateRelative } from "$lib/utils/date-helpers";
  import { p } from "$lib/router";
  import {
    FileText,
    Calendar,
    Clock,
    ArrowRight,
    Download,
  } from "@lucide/svelte";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  interface Props {
    doc: EnrichedTeamdoc;
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
      ? p(`/event/${eventId}/document/${doc.$id}`)
      : teamId
        ? p(`/editdocument/${teamId}/${doc.$id}`)
        : "#",
  );

  function handleDownload(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const md = doc.content || "";
    shareOrDownload(
      md,
      `${toSlug(doc.title || "document")}.md`,
      "Document exporté",
    );
  }
</script>

<a
  class="{bgClass} hover:bg-base-200 group flex cursor-pointer items-start gap-3 rounded-lg p-4 shadow-sm transition-colors hover:shadow-md"
  {href}
>
  <div class="min-w-0 flex-1">
    <div class="flex flex-wrap items-center gap-x-10 gap-y-2">
      <!-- Title with icon -->
      <div class="text-primary flex items-center gap-2">
        <FileText class="text-primary h-4 w-4 shrink-0" />
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
    </div>
  </div>

  <div class="flex shrink-0 items-start gap-3">
    <button
      class="btn btn-primary btn-circle btn-outline btn-xs opacity-0 transition-opacity group-hover:opacity-100"
      onclick={handleDownload}
      title="Exporter le document"
    >
      <Download class="h-3.5 w-3.5" />
    </button>
    <ArrowRight class="mt-0.5 h-4 w-4 opacity-40" />
  </div>
</a>
