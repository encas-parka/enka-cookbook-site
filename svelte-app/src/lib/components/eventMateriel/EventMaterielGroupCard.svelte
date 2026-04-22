<script lang="ts">
  import type {
    MaterielGroup,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import type { EventMateriel } from "$lib/types/appwrite";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import {
    getEventMaterielStatusConfig,
    getMaterielTypeBadgeClass,
    getMaterielTypeColorClass,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";
  import EventMaterielBadgeStatus from "./EventMaterielBadgeStatus.svelte";
  import {
    Check,
    ChefHat,
    CircleAlert,
    CircleDot,
    ClipboardEdit,
    Flame,
    MapPin,
    Package,
    Pencil,
    Plus,
    SoapDispenserDroplet,
    User,
    MessageSquare,
    MessageSquareWarning,
    Utensils,
    Wrench,
    Zap,
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

  // Type icon derived component
  const TypeIcon = $derived.by(() => {
    switch (header.type) {
      case "electronic":
        return Zap;
      case "cooking":
        return ChefHat;
      case "gaz":
        return Flame;
      case "dish":
        return Utensils;
      case "hygiene":
        return SoapDispenserDroplet;
      case "tools":
      case "manual":
        return Wrench;
      case "other":
      default:
        return Package;
    }
  });

  function handleAddAllocation(headerId: string, status: EventMaterielStatus) {
    onAddAllocation?.(headerId, status);
  }

  function handleEditHeader() {
    onEditItem?.(header);
  }
</script>

<div class="card card-xs border-base-200 bg-base-100 border shadow-sm">
  <div class="card-body">
    <!-- Header row -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex flex-1 flex-col gap-1">
        <div class="item-center flex flex-wrap gap-x-4 gap-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Type icon -->
            <TypeIcon
              class="{getMaterielTypeColorClass(header.type)} size-5 shrink-0"
            />

            <!-- Name -->
            <span class="truncate text-base font-medium"
              >{header.name || ""}</span
            >
            {#if canEdit}
              <button
                class="btn btn-ghost btn-sm btn-squarre"
                onclick={handleEditHeader}
                title="Editer"
              >
                <Pencil class="size-3" />
              </button>
            {/if}

            <!-- Quantity -->
            <span class="badge badge-ghost">x{header.quantity || 0}</span>

            <!-- Type badge -->
            <span
              class="badge hidden sm:flex {getMaterielTypeBadgeClass(
                header.type,
              )} badge-soft badge-sm gap-1 py-0"
            >
              {getMaterielTypeConfig(header.type).label}
            </span>
          </div>
          <!-- Allocations (always visible) -->
          {#if group.allocations.length > 0}
            <div class="p61 flex flex-wrap items-center gap-x-2">
              {#each group.allocations as alloc (alloc.$id)}
                {@const allocStatus = eventMaterielStore.resolveStatus(alloc)}
                {@const allocConfig = getEventMaterielStatusConfig(allocStatus)}
                {@const AllocIcon =
                  allocStatus === "confirmed"
                    ? Check
                    : allocStatus === "to_check"
                      ? CircleDot
                      : CircleAlert}
                <button
                  class="flex items-center gap-2 rounded-md px-2 py-1 {allocConfig.bgClass} group hover:cursor-pointer hover:shadow-sm"
                  onclick={(e) => {
                    e.stopPropagation();
                    onEditItem && !alloc.loanId ? onEditItem(alloc) : null;
                    onEditLoan ? onEditLoan(alloc.loanId!) : null;
                  }}
                  aria-label="Éditer l'allocation"
                >
                  <!-- Alloc info -->
                  {#if alloc.where}
                    <div class="flex items-center gap-1 sm:text-sm">
                      <MapPin class="h-3 w-3 shrink-0" />
                      <span class="max-w-40 truncate">{alloc.where}</span>
                    </div>
                  {/if}
                  {#if alloc.who}
                    <div class="flex items-center gap-1 sm:text-sm">
                      <User class="h-3 w-3 shrink-0" />
                      <span class="truncate">{alloc.who}</span>
                    </div>
                  {/if}
                  {#if alloc.fromTeamName}
                    <span class="text-base-content/50 text-sm sm:text-xs">
                      ({alloc.fromTeamName})
                    </span>
                  {/if}

                  {#if alloc.notes}
                    <div
                      class="tooltip tooltip-info max-w-24"
                      data-tip={alloc.notes}
                    >
                      <span class="text-base-content/60 max-w-24 truncate">
                        <MessageSquareWarning class="inline-block size-4" />
                      </span>
                    </div>
                  {/if}

                  <!-- Alloc status -->
                  <span
                    class="badge {allocConfig.badgeClass}  gap-1 py-0"
                    title={allocConfig.label}
                  >
                    <AllocIcon class="size-3" />
                    {allocConfig.label} x{alloc.quantity || 0}
                  </span>

                  <!-- Edit alloc -->
                  {#if canEdit && onEditItem && !alloc.loanId}
                    <Pencil class="ms-2 size-3.5 group-hover:scale-105" />
                  {/if}

                  <!-- Edit loan -->
                  {#if alloc.loanId && onEditLoan}
                    <ClipboardEdit
                      class="ms-2 size-3.5 group-hover:scale-105"
                    />
                  {/if}
                </button>
              {/each}

              <!-- Add allocation button removed -->
            </div>
          {/if}
          <!-- Status badges -->
          <div class="ml-auto">
            <EventMaterielBadgeStatus
              {group}
              onEditHeader={handleEditHeader}
              onAddAllocation={handleAddAllocation}
            />
          </div>
        </div>
        <!-- Note row -->
        {#if header.notes}
          <div class="flex items-center gap-1 ps-4 text-xs italic opacity-50">
            <MessageSquare class="size-3 shrink-0" />
            <button
              class="max-w-54 truncate p-0 text-left transition-opacity hover:opacity-100"
              onclick={handleEditHeader}
            >
              {header.notes.length > 80
                ? header.notes.slice(0, 80) + "..."
                : header.notes}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
