<script lang="ts">
  import { Plus, Package, Filter } from "@lucide/svelte";
  import LoanCard from "./LoanCard.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import type { MaterielLoanStatus } from "$lib/types/appwrite.d";
  import type { EnrichedMaterielLoan } from "$lib/types/materiel.types";
  import ReturnLoanModal from "./ReturnLoanModal.svelte";

  type FilterStatus = "all" | MaterielLoanStatus;

  interface Props {
    onCreateLoan?: () => void;
  }

  let { onCreateLoan }: Props = $props();

  let selectedFilter = $state<FilterStatus>("all");
  let showReturnModal = $state(false);
  let selectedLoan = $state<EnrichedMaterielLoan | null>(null);

  // Options de filtre
  const filterOptions = $derived([
    { id: "all" as FilterStatus, label: "Tous" },
    { id: "asked", label: "En attente" },
    { id: "accepted", label: "Acceptés" },
    { id: "returned", label: "Retournés" },
    { id: "completed", label: "Terminés" },
    { id: "refused", label: "Refusés" },
    { id: "canceled", label: "Annulés" },
  ]);

  // Emprunts filtrés
  const filteredLoans = $derived.by(() => {
    const loans = materielStore.loans;

    if (selectedFilter === "all") {
      return loans;
    }

    return loans.filter((loan) => loan.status === selectedFilter);
  });

  // Comptes par statut
  const statusCounts = $derived.by(() => {
    const loans = materielStore.loans;
    const counts: Record<FilterStatus, number> = {
      all: loans.length,
      asked: 0,
      accepted: 0,
      refused: 0,
      canceled: 0,
      returned: 0,
      completed: 0,
      archived: 0,
    };

    loans.forEach((loan) => {
      if (loan.status in counts) {
        counts[loan.status as MaterielLoanStatus]++;
      }
    });

    return counts;
  });

  // Actions
  async function handleAccept(loanId: string) {
    try {
      await materielStore.acceptLoan(loanId);
    } catch (error) {
      console.error("Erreur acceptation emprunt:", error);
    }
  }

  async function handleRefuse(loanId: string) {
    try {
      await materielStore.refuseLoan(loanId);
    } catch (error) {
      console.error("Erreur refus emprunt:", error);
    }
  }

  async function handleCancel(loanId: string) {
    try {
      await materielStore.cancelLoan(loanId);
    } catch (error) {
      console.error("Erreur annulation emprunt:", error);
    }
  }

  function handleReturn(loanId: string) {
    const loan = materielStore.loans.find((l) => l.$id === loanId);
    if (loan) {
      selectedLoan = loan;
      showReturnModal = true;
    }
  }

  async function handleComplete(loanId: string) {
    try {
      await materielStore.completeLoan(loanId);
    } catch (error) {
      console.error("Erreur completion emprunt:", error);
    }
  }

  async function handleDelete(loanId: string) {
    try {
      await materielStore.deleteLoan(loanId);
    } catch (error) {
      console.error("Erreur suppression emprunt:", error);
    }
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <Package class="h-5 w-5 opacity-70" />
      <h2 class="text-lg font-semibold">Emprunts</h2>
      <span class="badge badge-ghost badge-sm">
        {statusCounts.all}
      </span>
    </div>

    {#if onCreateLoan}
      <button class="btn btn-primary btn-sm gap-2" onclick={onCreateLoan}>
        <Plus class="h-4 w-4" />
        Nouvel emprunt
      </button>
    {/if}
  </div>

  <!-- Filtres -->
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1 text-sm opacity-70">
      <Filter class="h-4 w-4" />
      <span>Filtrer :</span>
    </div>

    {#each filterOptions as option (option.id)}
      {@const count = statusCounts[option.id]}
      {@const isActive = selectedFilter === option.id}
      {@const showCount = option.id !== "all" && count > 0}

      <button
        class="btn btn-sm {isActive ? 'btn-primary' : 'btn-ghost'}"
        onclick={() => (selectedFilter = option.id as FilterStatus)}
      >
        {option.label}
        {#if showCount}
          <span
            class="badge badge-sm {isActive
              ? 'badge-primary'
              : 'badge-neutral'}"
          >
            {count}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Liste des emprunts -->
  <div class="max-h-[600px] space-y-3 overflow-y-auto">
    {#if filteredLoans.length > 0}
      {#each filteredLoans as loan (loan.$id)}
        <LoanCard
          {loan}
          onAccept={handleAccept}
          onRefuse={handleRefuse}
          onReturn={handleReturn}
          onComplete={handleComplete}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      {/each}
    {:else}
      <!-- État vide -->
      <div class="py-12 text-center opacity-50">
        <Package class="mx-auto mb-4 h-16 w-16" />
        <p class="text-lg font-medium">
          {selectedFilter === "all"
            ? "Aucun emprunt"
            : `Aucun emprunt "${filterOptions.find((f) => f.id === selectedFilter)?.label}"`}
        </p>
        <p class="mt-2 text-sm">
          {#if onCreateLoan}
            Créez votre premier emprunt pour commencer
          {:else}
            Les emprunts créés apparaîtront ici
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Modal de retour -->
{#if showReturnModal && selectedLoan}
  <ReturnLoanModal
    isOpen={showReturnModal}
    loan={selectedLoan}
    onClose={() => {
      showReturnModal = false;
      selectedLoan = null;
    }}
  />
{/if}
