<script lang="ts">
  import {
    Pencil,
    Plus,
    Check,
    CircleDot,
    CircleAlert,
    PencilLine,
    BadgeQuestionMark,
  } from "@lucide/svelte";
  import type {
    MaterielGroup,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { getEventMaterielStatusConfig } from "$lib/utils/materiel.utils";

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
  <button
    class="btn btn-soft {toFindQty > 0 && 'btn-error'} sm:btn-sm gap-1 pe-1"
    onclick={(e) => {
      e.stopPropagation();
      onEditHeader(headerId);
    }}
    title="Éditer le besoin"
  >
    <CircleAlert size="16" class="sm:hidden" />
    <span class="hidden font-normal sm:inline"
      >Manque: <strong>{toFindQty}</strong></span
    >
    <strong class=" sm:hidden">{toFindQty}</strong>
    <span class="btn btn-square btn-error ms-2 size-6 p-0.5 opacity-60">
      <PencilLine size="14" /></span
    >
  </button>
  <button
    class="btn btn-soft {toCheckQty > 0 && 'btn-warning'} sm:btn-sm gap-1 pe-1"
    onclick={(e) => {
      e.stopPropagation();
      onAddAllocation(headerId, "to_check");
    }}
    title="Ajouter une allocation à vérifier"
  >
    <BadgeQuestionMark size="16" class="sm:hidden" />
    <span class="hidden font-normal sm:inline"
      >vérifier: <strong>{toCheckQty}</strong></span
    >
    <strong class=" sm:hidden">{toCheckQty}</strong>
    <span class="btn btn-square btn-warning ms-2 size-6 p-0.5 opacity-60">
      <Plus size="14" /></span
    >
  </button>
  <button
    class="btn btn-soft {confirmedQty > 0 &&
      'btn-success'} sm:btn-sm gap-1 pe-1"
    onclick={(e) => {
      e.stopPropagation();
      onAddAllocation(headerId, "confirmed");
    }}
    title="Ajouter une allocation confirmée"
  >
    <Check size="16" class="sm:hidden" />
    <span class="hidden font-normal sm:inline"
      >Ok: <strong>{confirmedQty}</strong></span
    >
    <strong class=" sm:hidden">{confirmedQty}</strong>
    <span class="btn btn-square btn-success ms-2 size-6 p-0.5 opacity-60">
      <Plus size="14" /></span
    >
  </button>
</div>
