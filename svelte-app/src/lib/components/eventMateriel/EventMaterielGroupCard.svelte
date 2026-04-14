<script lang="ts">
  import type {
    MaterielGroup,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import type { EventMateriel } from "$lib/types/appwrite";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import {
    getMaterielTypeBadgeClass,
    getMaterielTypeColorClass,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";
  import EventMaterielBadgeStatus from "./EventMaterielBadgeStatus.svelte";
  import {
    Check,
    CircleAlert,
    CircleDot,
    MapPin,
    Package,
    Pencil,
    Plus,
    User,
  } from "@lucide/svelte";

  interface Props {
    group: MaterielGroup;
    canEdit?: boolean;
    onEditItem?: (item: EventMateriel) => void;
    onEditLoan?: (loanId: string) => void;
    onAddAllocation?: (headerId: string, status?: EventMaterielStatus) => void;
  }

  let {
    group,
    canEdit = true,
    onEditItem,
    onEditLoan,
    onAddAllocation,
  }: Props = $props();

  const header = $derived(group.header);

  const allocationStatusBadge = $derived.by(() => {
    return (status: string) => {
      switch (status) {
        case "confirmed":
          return { badge: "badge-success", icon: Check, label: "Ok" };
        case "to_check":
          return { badge: "badge-info", icon: CircleDot, label: "À vérifier" };
        case "to_find":
        default:
          return {
            badge: "badge-warning",
            icon: CircleAlert,
            label: "À trouver",
          };
      }
    };
  });

  function handleAddAllocation(headerId: string, status: EventMaterielStatus) {
    onAddAllocation?.(headerId, status);
  }

  function handleEditHeader() {
    onEditItem?.(header);
  }
</script>

<div
  class="border-base-200 rounded-box border shadow-sm transition-all hover:shadow-md"
>
  <!-- Header row -->
  <div class="flex items-center gap-3 px-4 py-3">
    <!-- Type icon -->
    <Package
      class="{getMaterielTypeColorClass(header.type)} size-5 shrink-0"
    />

    <!-- Name -->
    <span class="text-base font-medium">{header.name || ""}</span>

    <!-- Quantity -->
    <span class="badge badge-ghost badge-sm">x{header.quantity || 0}</span>

    <!-- Type badge -->
    <span
      class="badge hidden sm:flex {getMaterielTypeBadgeClass(
        header.type,
      )} badge-soft badge-sm gap-1 py-0"
    >
      {getMaterielTypeConfig(header.type).label}
    </span>

    <!-- Status badges -->
    <div class="ml-auto">
      <EventMaterielBadgeStatus
        {group}
        onEditHeader={handleEditHeader}
        onAddAllocation={handleAddAllocation}
      />
    </div>
  </div>

  <!-- Allocations (always visible) -->
  {#if group.allocations.length > 0}
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-base-200 bg-base-200/30 p-3"
    >
      {#each group.allocations as alloc (alloc.$id)}
        {@const allocStatus = eventMaterielStore.resolveStatus(alloc)}
        {@const allocBadge = allocationStatusBadge(allocStatus)}
        <div class="badge badge-lg {allocBadge.badge}">
          <!-- Alloc info -->
          {#if alloc.where}
            <div class="flex items-center gap-1 text-sm">
              <MapPin class="h-3 w-3 shrink-0" />
              <span class="max-w-40 truncate">{alloc.where}</span>
            </div>
          {/if}
          {#if alloc.who}
            <div class="flex items-center gap-1 text-sm">
              <User class="h-3 w-3 shrink-0" />
              <span class="truncate">{alloc.who}</span>
            </div>
          {/if}
          <span class="badge badge-ghost badge-sm"
            >x{alloc.quantity || 0}</span
          >
          {#if alloc.fromTeamName}
            <span class="text-base-content/50 text-xs">
              ({alloc.fromTeamName})
            </span>
          {/if}

          <!-- Alloc status -->
          <span
            class="badge {allocBadge.badge} badge-soft badge-sm gap-1 py-0"
            title={allocBadge.label}
          >
            <allocBadge.icon class="size-3" />
            {allocBadge.label}
          </span>

          <!-- Edit alloc -->
          {#if canEdit && onEditItem}
            <button
              class="btn btn-ghost btn-xs text-primary"
              onclick={(e) => {
                e.stopPropagation();
                onEditItem(alloc);
              }}
              aria-label="Éditer l'allocation"
            >
              <Pencil class="size-3.5" />
            </button>
          {/if}

          <!-- Edit loan -->
          {#if alloc.loanId && onEditLoan}
            <button
              class="btn btn-ghost btn-xs text-secondary"
              onclick={(e) => {
                e.stopPropagation();
                onEditLoan(alloc.loanId!);
              }}
              aria-label="Modifier la réservation"
              title="Modifier la réservation"
            >
              <Pencil class="size-3.5" />
            </button>
          {/if}
        </div>
      {/each}

      <!-- Add allocation button -->
      {#if canEdit && onAddAllocation && group.remainingQty > 0}
        <div class="pt-2">
          <button
            class="btn btn-ghost btn-xs text-primary gap-1"
            onclick={(e) => {
              e.stopPropagation();
              onAddAllocation(header.$id);
            }}
          >
            <Plus class="size-3.5" />
            Ajouter une allocation ({group.remainingQty} restant{group
              .remainingQty > 1
              ? "s"
              : ""})
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
