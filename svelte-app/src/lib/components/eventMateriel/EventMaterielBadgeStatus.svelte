<script lang="ts">
  import {
    Pencil,
    Plus,
    Check,
    CircleDot,
    CircleAlert,
    PencilLine,
  } from "@lucide/svelte";
  import type {
    MaterielGroup,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";

  interface Props {
    group: MaterielGroup;
    onEditHeader: (headerId: string) => void;
    onAddAllocation: (headerId: string, status: EventMaterielStatus) => void;
  }

  let { group, onEditHeader, onAddAllocation }: Props = $props();

  const headerId = $derived(group.header.$id);

  const toFindQty = $derived(group.remainingQty);

  const toCheckQty = $derived.by(() =>
    group.allocations
      .filter((a) => eventMaterielStore.resolveStatus(a) === "to_check")
      .reduce((sum, a) => sum + (a.quantity || 0), 0),
  );

  const confirmedQty = $derived.by(() =>
    group.allocations
      .filter((a) => eventMaterielStore.resolveStatus(a) === "confirmed")
      .reduce((sum, a) => sum + (a.quantity || 0), 0),
  );
</script>

<div class="flex flex-wrap items-center gap-1">
  {#if toFindQty > 0}
    <button
      class="btn btn-soft btn-error btn-sm gap-1"
      onclick={(e) => {
        e.stopPropagation();
        onEditHeader(headerId);
      }}
      title="Éditer le besoin"
    >
      <span class="text-xs font-normal"
        >À trouver: <strong>{toFindQty}</strong></span
      >
      <span class="btn btn-circle btn-error ms-2 size-6 p-0.5 opacity-60">
        <PencilLine size="14" /></span
      >
    </button>
  {/if}
  <button
    class="btn btn-soft btn-warning btn-sm gap-1"
    onclick={(e) => {
      e.stopPropagation();
      onAddAllocation(headerId, "to_check");
    }}
    title="Ajouter une allocation à vérifier"
  >
    <span class="text-xs font-normal"
      >À vérifier: <strong>{toCheckQty}</strong></span
    >
    <span class="btn btn-circle btn-warning ms-2 size-6 p-0.5 opacity-60">
      <Plus size="14" /></span
    >
  </button>
  <button
    class="btn btn-soft btn-success btn-sm gap-1"
    onclick={(e) => {
      e.stopPropagation();
      onAddAllocation(headerId, "confirmed");
    }}
    title="Ajouter une allocation confirmée"
  >
    <span class="text-xs font-normal">Ok: <strong>{confirmedQty}</strong></span>
    <span class="btn btn-circle btn-success ms-2 size-6 p-0.5 opacity-60">
      <Plus size="14" /></span
    >
  </button>
</div>
