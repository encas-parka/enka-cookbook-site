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

<div class="card card-xs border-base-200 border shadow-sm">
  <div class="card-body">
    <!-- Header row -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-3">
        <!-- Type icon -->
        <Package
          class="{getMaterielTypeColorClass(header.type)} size-5 shrink-0"
        />

        <!-- Name -->
        <span class="truncate text-base font-medium">{header.name || ""}</span>

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
      </div>
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
        class="border-base-200 bg-base-200/30 flex flex-wrap items-center gap-x-4 gap-y-2 border-t"
      >
        {#each group.allocations as alloc (alloc.$id)}
          {@const allocStatus = eventMaterielStore.resolveStatus(alloc)}
          {@const allocBadge = allocationStatusBadge(allocStatus)}
          <button
            class="badge badge-lg badge-outline {allocBadge.badge}  hover:cursor-pointer"
            onclick={(e) => {
              e.stopPropagation();
              onEditItem && !alloc.loanId ? onEditItem(alloc) : null;
              onEditLoan ? onEditLoan(alloc.loanId!) : null;
            }}
            aria-label="Éditer l'allocation"
          >
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
            {#if alloc.fromTeamName}
              <span class="text-base-content/50 text-xs">
                ({alloc.fromTeamName})
              </span>
            {/if}
            <span class="badge badge-ghost badge-sm"
              >x{alloc.quantity || 0}</span
            >

            <!-- Alloc status -->
            <span
              class="badge {allocBadge.badge} badge-soft badge-sm gap-1 py-0"
              title={allocBadge.label}
            >
              <allocBadge.icon class="size-3" />
              {allocBadge.label}
            </span>

            <!-- Edit alloc -->
            {#if canEdit && onEditItem && !alloc.loanId}
              <div class="btn btn-xs btn-ghost">
                <Pencil class="size-3.5" />
              </div>
            {/if}

            <!-- Edit loan -->
            {#if alloc.loanId && onEditLoan}
              <div
                class="btn btn-xs btn-ghost"
                aria-label="Modifier la réservation"
                title="Modifier la réservation"
              >
                <Pencil class="size-3.5" />
              </div>
            {/if}
          </button>
        {/each}

        <!-- Add allocation button -->
        {#if canEdit && onAddAllocation && group.remainingQty > 0}
          <div class="ms-auto pt-2">
            <button
              class="btn btn-ghost btn-xs text-primary gap-1"
              onclick={(e) => {
                e.stopPropagation();
                onAddAllocation(header.$id);
              }}
            >
              <Plus class="size-3.5" />
              Ajouter
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
