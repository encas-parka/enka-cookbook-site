<script lang="ts">
  import {
    Package,
    Wrench,
    Zap,
    ChefHat,
    Box,
    CheckCircle,
    XCircle,
    MapPin,
    Edit,
    Users,
    AlertCircle,
    Hand,
    CalendarClock,
    Share2,
    Utensils,
    SoapDispenserDroplet,
    FireExtinguisher,
    Flame,
  } from "@lucide/svelte";
  import type { EnrichedMateriel } from "$lib/types/materiel.types";
  import type { MaterielStatus } from "$lib/types/appwrite";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import {
    getMaterielTypeLabel,
    getMaterielTypeBadgeClass,
    getMaterielTypeColorClass,
    getMaterielTypeBgClass,
    getMaterielStatusLabel,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";

  interface Props {
    materiel: EnrichedMateriel;
    onEdit?: (materielId: string) => void;
  }

  let { materiel, onEdit }: Props = $props();

  // Icône du type
  const TypeIcon = $derived.by(() => {
    switch (materiel.type) {
      case "electronic":
        return Zap;
      case "manual":
        return Wrench;
      case "cooking":
        return ChefHat;
      case "dish":
        return Utensils;
      case "gaz":
        return Flame;
      case "hygiene":
        return SoapDispenserDroplet;

      case "other":
      default:
        return Box;
    }
  });

  // Badge du type

  // Configuration du statut
  const StatusConfig = $derived.by(() => {
    if (!materiel || !materiel.status) {
      return {
        label: "Chargement...",
        badgeClass: "badge-neutral",
        priority: 99,
      };
    }

    const statusLabel = getMaterielStatusLabel(materiel.status);

    const configs: Record<
      MaterielStatus,
      { label: string; badgeClass: string; priority: number }
    > = {
      ok: {
        label: statusLabel,
        badgeClass: "badge-success",
        priority: 0,
      },
      lost: {
        label: statusLabel,
        badgeClass: "badge-error",
        priority: 4,
      },
      torepair: {
        label: statusLabel,
        badgeClass: "badge-warning",
        priority: 1,
      },
    };

    return (
      configs[materiel.status] || {
        label: statusLabel,
        badgeClass: "badge-neutral",
        priority: 99,
      }
    );
  });

  // Est partageable ?
  const isShareable = $derived(
    materiel.shareableWith !== null && materiel.shareableWith.length > 0,
  );

  // L'utilisateur peut-il éditer ?
  const canEdit = $derived.by(() => {
    if (!globalState.userId) return false;

    // Owner = user
    if (materiel.ownerData?.userId === globalState.userId) return true;

    // Owner = team, vérifier si l'utilisateur est membre
    if (materiel.ownerData?.teamId) {
      // TODO: vérifier si l'utilisateur est membre de l'équipe
      return true; // Pour l'instant on simplifie
    }

    return false;
  });

  // Description tronquée
  const truncatedDescription = $derived.by(() => {
    if (!materiel.description) return null;
    return materiel.description.length > 80
      ? materiel.description.substring(0, 80) + "..."
      : materiel.description;
  });
</script>

<div
  class="card card-side bg-base-100 border-base-200 hover:border-primary/50 group cursor-pointer border text-left shadow-sm transition-all hover:shadow-md"
  role="button"
  tabindex="0"
  onclick={() => canEdit && onEdit?.(materiel.$id)}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      canEdit && onEdit?.(materiel.$id);
    }
  }}
>
  <!-- Image/Icon placeholder -->
  <div class="hidden pl-4 sm:flex sm:items-center">
    <div class="{getMaterielTypeBgClass(materiel.type)} rounded-lg p-3">
      <TypeIcon class="{getMaterielTypeColorClass(materiel.type)} h-6 w-6" />
    </div>
  </div>

  <div class="card-body py-3">
    <div
      class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <!-- Main Info: Nom, Type, Description -->
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-0">
          <div class="flex items-center gap-2">
            <h3
              class="text-primary group-hover:text-primary/80 text-base font-semibold transition-colors"
            >
              {materiel.name}
            </h3>
            <span
              class="badge {getMaterielTypeBadgeClass(
                materiel.type,
              )} badge-soft badge-sm gap-1 py-0"
            >
              {getMaterielTypeConfig(materiel.type).label}
            </span>
          </div>
          <div
            class="text-base-content/80 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          >
            <!-- Localisation -->
            {#if materiel.location}
              <div class="flex items-center gap-1">
                <MapPin class="h-3 w-3" />
                <span class="max-w-60 truncate">{materiel.location}</span>
              </div>
            {/if}

            <!-- Équipe -->
            {#if materiel.ownerData?.teamName}
              <div class="flex items-center gap-1">
                <Users class="h-3 w-3" />
                <span class="">{materiel.ownerData.teamName}</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <!-- Quantité -->
          <div class="text-sm font-medium">
            <span
              class={materiel.availableQuantity > 0
                ? "text-success"
                : "text-error"}
            >
              {materiel.availableQuantity}/{materiel.quantity}
            </span>
            <span class="text-base-content/60 ml-1 text-xs">disp.</span>
          </div>

          <!-- Info sur les prêts (si présent) -->
          {#if materiel.totalLoanedQuantity > 0}
            <div class="badge badge-sm badge-info">
              {materiel.totalLoanedQuantity}/{materiel.quantity} en prêt(s)
            </div>
          {/if}
          <!-- Description -->
          {#if truncatedDescription}
            <div class="text-base-content/60 line-clamp-1 text-xs">
              {truncatedDescription}
            </div>
          {/if}

          <!-- Statut principal -->
          {#if materiel.status !== "ok" && materiel.status !== "loan"}
            <div class="badge {StatusConfig.badgeClass} badge-sm gap-1 py-0">
              {StatusConfig.label}
            </div>
          {/if}
        </div>
      </div>

      <!-- Middle Info: Statut et partage -->
      <div class="flex flex-col items-start gap-1 sm:items-center">
        <!-- Badges de statut -->
        <!-- <div class="flex flex-wrap gap-1"> -->
        <!-- Partageable -->
        <!-- {#if isShareable}
            <div
              class="badge badge-secondary badge-xs gap-1 py-0"
              title="Partageable avec {materiel.shareableWith!
                .length} équipe(s)"
            >
              <Share2 class="h-2.5 w-2.5" />
              {materiel.shareableWith!.length}
            </div>
          {/if} -->
        <!-- </div> -->

        <!-- Emprunts en cours (Compact, en bas si présents) -->
        {#if materiel.loanDetails.length > 0}
          <div class="">
            <div class="text-xs">
              <span class="text-info font-semibold">
                {materiel.loanDetails.length} réservation
                {materiel.loanDetails.length > 1 ? "s" : ""} :
              </span>
              <span class="text-base-content/80 ml-2">
                {#each materiel.loanDetails as loan, index}
                  {#if index > 0}
                    <span class="opacity-50"> • </span>
                  {/if}
                  <span class="font-medium">
                    {loan.responsibleName} ({loan.quantity})
                  </span>
                  <span class="opacity-70">
                    du {formatDateDayMonthShort(loan.startDate)}
                    au {formatDateDayMonthShort(loan.endDate)}
                  </span>
                {/each}
              </span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end">
        {#if canEdit}
          <button
            class="btn btn-ghost btn-xs text-primary"
            onclick={(e) => {
              e.stopPropagation();
              onEdit?.(materiel.$id);
            }}
            aria-label="Éditer"
          >
            <Edit class="h-4 w-4" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
