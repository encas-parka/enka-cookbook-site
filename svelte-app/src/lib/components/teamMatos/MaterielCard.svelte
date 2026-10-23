<script lang="ts">
  import { MapPin, Users, Pencil } from "@lucide/svelte";
  import type { EnrichedMateriel } from "$lib/types/materiel.types";
  import type { MaterielStatus } from "$lib/types/pb";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { online } from "svelte/reactivity/window";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import {
    getMaterielTypeBadgeClass,
    getMaterielTypeColorClass,
    getMaterielTypeBgClass,
    getMaterielTypeIcon,
    getMaterielStatusLabel,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";

  interface Props {
    materiel: EnrichedMateriel;
    onEdit?: (materielId: string) => void;
  }

  let { materiel, onEdit }: Props = $props();

  // Icône du type — source unique (materiel.utils)
  const TypeIcon = $derived(getMaterielTypeIcon(materiel.type));

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
    if (!online.current) return false;
    if (!globalState.userId) return false;

    // Owner = user
    if (materiel.ownerUser === globalState.userId) return true;

    if (materiel.teamId) {
      // TODO: vérifier si l'utilisateur est membre de l'équipe
      return true; // Pour l'instant on simplifie
    }

    return false;
  });

  const ownerTeamName = $derived(
    materiel.teamId
      ? nativeTeamsStore.getTeamById(materiel.teamId)?.name
      : null,
  );

  // Description tronquée
  const truncatedDescription = $derived.by(() => {
    if (!materiel.description) return null;
    return materiel.description.length > 80
      ? materiel.description.substring(0, 80) + "…"
      : materiel.description;
  });
</script>

<div
  class="group card card-side border border-base-200 bg-base-100 text-left shadow-sm transition-all card-xs {canEdit
    ? 'cursor-pointer hover:border-primary/50 hover:shadow-md'
    : ''}"
  role="button"
  tabindex={canEdit ? 0 : -1}
  onclick={() => canEdit && onEdit?.(materiel.id)}
  onkeydown={(e) => {
    if (canEdit && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onEdit?.(materiel.id);
    }
  }}
>
  <!-- Image/Icon placeholder -->
  <div class="flex items-center p-2 max-md:hidden">
    <div class="{getMaterielTypeBgClass(materiel.type)} rounded-lg p-1 sm:p-3">
      <TypeIcon
        class="{getMaterielTypeColorClass(materiel.type)} size-4 sm:size-6"
      />
    </div>
  </div>

  <div class="card-body">
    <div
      class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <!-- Main Info: Nom, Type, Description -->
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-0">
          <div class="flex items-center gap-2">
            <h3
              class="text-base font-semibold text-primary transition-colors group-hover:text-primary/80"
            >
              {materiel.name}
            </h3>
            <span
              class="badge {getMaterielTypeBadgeClass(
                materiel.type,
              )} gap-1 badge-soft py-0 badge-sm"
            >
              {getMaterielTypeConfig(materiel.type).label}
            </span>
          </div>
          <div
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/80"
          >
            <!-- Localisation -->
            {#if materiel.location}
              <div class="flex items-center gap-1">
                <MapPin class="h-3 w-3" />
                <span class="max-w-60 truncate">{materiel.location}</span>
              </div>
            {/if}

            <!-- Équipe -->
            {#if ownerTeamName}
              <div class="flex items-center gap-1">
                <Users class="h-3 w-3" />
                <span class="">{ownerTeamName}</span>
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
            <span class="ml-1 text-xs text-base-content/60">dispo.</span>
          </div>

          <!-- Info sur les prêts (si présent) -->
          {#if materiel.totalLoanedQuantity > 0}
            <div class="badge badge-sm badge-info">
              {materiel.totalLoanedQuantity}/{materiel.quantity} en prêt(s)
            </div>
          {/if}
          <!-- Description -->
          {#if truncatedDescription}
            <div class="line-clamp-1 text-xs text-base-content/60">
              {truncatedDescription}
            </div>
          {/if}

          <!-- Statut principal -->
          {#if materiel.status !== "ok" && materiel.status !== "loan"}
            <div class="badge {StatusConfig.badgeClass} gap-1 py-0 badge-sm">
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
              <span class="font-semibold text-info">
                {materiel.loanDetails.length} réservation
                {materiel.loanDetails.length > 1 ? "s" : ""} :
              </span>
              <span class="ml-2 text-base-content/80">
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
    </div>
  </div>
  <!-- Actions -->
  {#if canEdit}
    <div class="flex items-center p-2">
      <!-- Raccourci pointeur : la card porte déjà le geste (rôle + clavier) ;
           ce bouton reste hors tabulation pour éviter l'interactif imbriqué. -->
      <button
        class="btn btn-ghost text-primary btn-xs"
        tabindex="-1"
        onclick={(e) => {
          e.stopPropagation();
          onEdit?.(materiel.id);
        }}
      >
        <Pencil class="h-4 w-4" />
      </button>
    </div>
  {/if}
</div>
