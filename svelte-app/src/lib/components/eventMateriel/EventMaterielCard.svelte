<script lang="ts">
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type { EventMateriel } from "$lib/types/appwrite";
  import {
    getMaterielTypeBadgeClass,
    getMaterielTypeColorClass,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";
  import {
    Check,
    ChefHat,
    CircleAlert,
    ClipboardPen,
    CircleDot,
    Flame,
    MapPin,
    MessageSquare,
    Package,
    Pencil,
    SoapDispenserDroplet,
    User,
    Users,
    Utensils,
    Wrench,
    Zap,
  } from "@lucide/svelte";
  import { online } from "svelte/reactivity/window";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";

  interface Props {
    item: EventMateriel;
    onEdit: (item: EventMateriel) => void;
    onDelete?: (item: EventMateriel) => void;
    onEditLoan?: (loanId: string) => void;
    canEdit?: boolean;
    canUserEditLoan?: boolean;
  }

  let {
    item,
    onEdit,
    onEditLoan,
    canEdit = true,
    canUserEditLoan = false,
  }: Props = $props();

  const resolvedStatus = $derived(eventMaterielStore.resolveStatus(item));

  const statusConfig = $derived.by(() => {
    switch (resolvedStatus) {
      case "confirmed":
        return {
          badge: "badge-success",
          icon: Check,
          label: "Ok",
        };
      case "to_check":
        return {
          badge: "badge-info",
          icon: CircleDot,
          label: "À vérifier",
        };
      case "to_find":
      default:
        return {
          badge: "badge-warning",
          icon: CircleAlert,
          label: "À trouver",
        };
    }
  });

  // Notes expand/collapse
  let notesExpanded = $state(false);

  // Truncate notes to 30 chars
  const truncatedNotes = $derived.by(() => {
    if (!item.notes) return "";
    const text = item.notes.trim();
    if (text.length <= 30) return text;
    return text.slice(0, 30) + "…";
  });

  function toggleNotes(e: MouseEvent) {
    e.stopPropagation();
    notesExpanded = !notesExpanded;
  }

  // Type icon derived component
  const TypeIcon = $derived.by(() => {
    switch (item.type) {
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
        return Wrench;
      case "manual":
        return Wrench;
      case "other":
      default:
        return Package;
    }
  });

  // Can edit derived
  const canUserEdit = $derived.by(() => {
    if (!canEdit) return false;
    if (!online.current) return false;
    if (!globalState.isAuthenticated) return false;
    return true;
  });
</script>

<div
  class="card card-side card-xs bg-base-100 border-base-200 hover:border-primary/50 group cursor-pointer border text-left shadow-sm transition-all hover:shadow-md"
  role="button"
  tabindex="0"
  onclick={() => canUserEdit && onEdit(item)}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      canUserEdit && onEdit(item);
    }
  }}
>
  <!-- Type Icon -->

  <div class="card-body">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <!-- Main Info: Nom, Type, Details -->
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-0">
          <div class="flex items-center gap-2">
            <TypeIcon class="{getMaterielTypeColorClass(item.type)} size-5" />
            <div class=" text-base font-medium">
              {item.name}
            </div>
            {#if (item.quantity ?? 0) > 1}
              <span class="badge badge-ghost badge-sm">x{item.quantity}</span>
            {/if}
            <span
              class="badge hidden sm:flex {getMaterielTypeBadgeClass(
                item.type,
              )} badge-soft badge-sm gap-1 py-0"
            >
              {getMaterielTypeConfig(item.type).label}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <!-- Location -->
          {#if item.where}
            <div class="text-base-content/70 flex items-center gap-1 text-sm">
              <MapPin class="h-3 w-3" />
              <span class="max-w-60 truncate">{item.where}</span>
            </div>
          {/if}

          <!-- Who -->
          {#if item.who}
            <div class="text-base-content/70 flex items-center gap-1 text-sm">
              <User class="h-3 w-3" />
              <span class="truncate">{item.who}</span>
            </div>
          {/if}

          <!-- From Team -->
          {#if item.fromTeamName}
            <div class="text-base-content/50 flex items-center gap-1 text-xs">
              <Users class="h-3 w-3" />
              <span class="truncate">{item.fromTeamName}</span>
            </div>
          {/if}

          <!-- Notes -->
          {#if item.notes}
            <button
              class="text-base-content/50 hover:text-base-content/80 flex items-center gap-1 text-xs transition-colors hover:cursor-pointer"
              onclick={toggleNotes}
              title={notesExpanded ? "Masquer la note" : "Afficher la note"}
            >
              <MessageSquare class="inline h-3 w-3" />
              <span class="truncate">{truncatedNotes}</span>
            </button>
          {/if}
        </div>
        {#if notesExpanded}
          <div
            class="text-base-content/60 bg-base-200 w-full rounded px-2 text-sm"
          >
            <MessageSquare class="inline h-3 w-3" />

            {item.notes?.trim() ?? ""}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="ms-auto flex items-center gap-2">
        <!-- Status badge -->
        <span
          class="badge {statusConfig.badge} badge-soft badge-sm gap-1 py-0"
          title={statusConfig.label}
        >
          <statusConfig.icon class="size-3" />
          {statusConfig.label}
        </span>
        <!-- Edit button (only if can edit) -->
        {#if canUserEdit}
          <button
            class="btn btn-ghost btn-xs text-primary"
            onclick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            aria-label="Éditer"
          >
            <Pencil class="size-4" />
          </button>
        {/if}
        <!-- Edit loan button (only if sourced from a loan and user has access) -->
        {#if canUserEditLoan && onEditLoan}
          <button
            class="btn btn-ghost btn-xs text-secondary"
            onclick={(e) => {
              e.stopPropagation();
              onEditLoan(item.loanId!);
            }}
            aria-label="Modifier la réservation"
            title="Modifier la réservation"
          >
            <ClipboardPen class="size-4" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
