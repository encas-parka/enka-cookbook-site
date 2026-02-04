<script lang="ts">
  import {
    Calendar,
    User,
    Package,
    Check,
    CheckCircle,
    X,
    RotateCcw,
    AlertCircle,
    Archive,
    ClipboardPen,
    ClipboardList,
    ClockFading,
    ClockArrowUp,
    Trash2,
    Pencil,
  } from "@lucide/svelte";
  import type {
    EnrichedMaterielLoan,
    MaterielLoanItem,
  } from "$lib/types/materiel.types";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";

  // Type union pour MaterielLoanStatus (évite les problèmes d'import enum)
  type MaterielLoanStatusLiteral =
    | "asked"
    | "accepted"
    | "refused"
    | "canceled"
    | "returned"
    | "completed"
    | "archived";

  interface Props {
    loan: EnrichedMaterielLoan;
    onAccept?: (loanId: string) => void;
    onRefuse?: (loanId: string) => void;
    onReturn?: (loanId: string) => void;
    onComplete?: (loanId: string) => void;
    onCancel?: (loanId: string) => void;
    onDelete?: (loanId: string) => void;
    onEdit?: (loanId: string) => void;
  }

  let {
    loan,
    onAccept,
    onRefuse,
    onReturn,
    onComplete,
    onCancel,
    onDelete,
    onEdit,
  }: Props = $props();

  // Les matériels sont déjà parsés dans le store ✅
  const materiels = $derived.by(() => {
    return loan.materielItems;
  });

  // Déterminer l'état temporel du prêt
  const timeStatus = $derived.by(() => {
    const now = new Date();
    const startDate = new Date(loan.startDate);
    const endDate = new Date(loan.endDate);

    if (now < startDate) {
      return "future"; // À venir
    } else if (now >= startDate && now <= endDate) {
      return "current"; // En cours
    } else {
      return "past"; // Passé
    }
  });

  // Déterminer l'icône et la classe selon l'état temporel
  const timeConfig = $derived.by(() => {
    switch (timeStatus) {
      case "future":
        return {
          icon: ClockArrowUp,
          class: "text-info",
          label: "À venir",
        };
      case "current":
        return {
          icon: ClockFading,
          class: "text-accent",
          label: "En cours",
        };
      case "past":
      default:
        return {
          icon: Calendar,
          class: "",
          label: "",
        };
    }
  });

  // Déterminer la classe du badge en fonction de l'état de retour
  function getBadgeClass(m: MaterielLoanItem): string {
    // Seulement pour les loans complétés
    if (loan.status !== "completed") {
      return "";
    }

    const lost = m.lostQuantity || 0;
    const broken = m.brokenQuantity || 0;
    const totalIssues = lost + broken;
    const ok = m.quantity - totalIssues;

    // Tout est perdu ou cassé
    if (ok === 0) {
      return "badge-error"; // rouge
    }

    // Partiellement endommagé/perdu
    if (totalIssues > 0) {
      return "badge-warning"; // orange
    }

    // Tout est OK
    return "badge-success"; // vert
  }

  // Configuration du statut
  const statusConfig = $derived.by(() => {
    if (!loan || !loan.status) {
      return {
        label: "Chargement...",
        badgeClass: "badge-neutral",
        icon: AlertCircle,
      };
    }

    const configs: Record<
      MaterielLoanStatusLiteral,
      { label: string; badgeClass: string; icon: any }
    > = {
      asked: {
        label: "En attente",
        badgeClass: "badge-warning",
        icon: AlertCircle,
      },
      accepted: {
        label: "confirmé",
        badgeClass: "badge-info",
        icon: Check,
      },
      refused: {
        label: "Refusé",
        badgeClass: "badge-error",
        icon: X,
      },
      canceled: {
        label: "Annulé",
        badgeClass: "badge-neutral",
        icon: X,
      },
      completed: {
        label: "Retour effectué",
        badgeClass: "badge-success",
        icon: Check,
      },
      archived: {
        label: "Archivé",
        badgeClass: "badge-neutral",
        icon: Archive,
      },
      returned: {
        label: "Retourné",
        badgeClass: "badge-success",
        icon: CheckCircle,
      },
    };

    return (
      configs[loan.status] || {
        label: "Statut inconnu",
        badgeClass: "badge-neutral",
        icon: AlertCircle,
      }
    );
  });

  // Actions disponibles selon le statut
  const actions = $derived(() => {
    switch (loan.status) {
      case "asked":
        return [
          {
            label: "Confirmer",
            icon: Check,
            action: onAccept,
            class: "btn-success",
          },
          {
            label: "Annuler",
            icon: Trash2,
            action: onCancel,
            class: "btn-error btn-outline",
          },
        ];
      case "accepted":
        return [
          {
            label: "Compléter Fiche retour",
            icon: ClipboardPen,
            action: onReturn,
            class: "btn-warning",
          },
        ];
      case "completed":
        return [
          {
            label: "Fiche retour",
            icon: ClipboardList,
            action: onReturn,
            class: "",
          },
        ];
      case "refused":
      case "canceled":
        return [
          {
            label: "Supprimer",
            icon: X,
            action: onDelete,
            class: "btn-error btn-sm",
          },
        ];
      default:
        return [];
    }
  });

  function handleAction(action?: (loanId: string) => void) {
    action?.(loan.$id);
  }
</script>

<div class="card bg-base-100 border-base-200 border text-left shadow-sm">
  <!-- Badge statut -->
  <!-- <div class="hidden pl-4 sm:flex sm:items-center">
    <div class="bg-base-200 rounded-lg p-3">
      <StatusIcon class="text-base-content/70 h-6 w-6" />
    </div>
  </div> -->

  <div class="card-body py-3">
    <div
      class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
    >
      <!-- Info principale -->
      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <!-- Info: Responsable + Dates -->
        <div class=" flex flex-wrap items-center gap-x-4 gap-y-1 text-base">
          <div class="flex items-center gap-1">
            <User class="h-4 w-4" />
            <span>{loan.responsibleName}</span>
          </div>
          <div class="flex items-center gap-1 {timeConfig.class} font-bold">
            {#if timeStatus === "future"}
              <ClockArrowUp class="h-4 w-4" />
            {:else if timeStatus === "current"}
              <ClockFading class="h-4 w-4" />
            {:else}
              <Calendar class="h-4 w-4" />
            {/if}
            <span>
              {formatDateDayMonthShort(loan.startDate)} - {formatDateDayMonthShort(
                loan.endDate,
              )}
            </span>
          </div>
          <!-- <span class="badge {statusConfig.badgeClass} badge-sm gap-1">
            {statusConfig.label}
          </span> -->
        </div>
        <!-- Notes (si présentes) -->
        {#if loan.notes}
          <div class="text-base-content/60 text-xs italic">
            "{loan.notes}"
          </div>
        {/if}
        <!-- Matériels -->
        <div class="flex flex-wrap gap-2">
          {#each materiels as m}
            <span class="badge badge-sm badge-soft {getBadgeClass(m)}">
              <span class="font-medium"> {m.materielName} </span>
              × {m.quantity}
            </span>
          {/each}
        </div>

        <!-- Return notes (si présentes) -->
        {#if loan.returnNotes}
          <div class="text-warning bg-warning/10 rounded p-2 text-xs">
            <strong>Retour :</strong>
            {loan.returnNotes}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-4 not-sm:mt-4">
        {#each actions() as action}
          <button
            class="btn btn-sm {action.class}"
            onclick={() => handleAction(action.action)}
            title={action.label}
          >
            <action.icon class="h-4 w-4" />
            <span>{action.label}</span>
          </button>
        {/each}

        {#if onEdit && loan.status === "asked"}
          <button
            class="btn btn-primary btn-soft btn-sm"
            onclick={() => onEdit(loan.$id)}
            title="Modifier"
          >
            <Pencil class="h-4 w-4" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
