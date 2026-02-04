<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { Plus, Users, LoaderCircle } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import CreateLoanModal from "$lib/components/teamMatos/CreateLoanModal.svelte";
  import LoanCard from "$lib/components/teamMatos/LoanCard.svelte";
  import type { EnrichedMaterielLoan } from "$lib/types/materiel.types";
  import ReturnLoanModal from "$lib/components/teamMatos/ReturnLoanModal.svelte";
  import { route, navigate } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";

  // État de la page
  let createLoanModalOpen = $state(false);
  let activeTeamId = $state<string | null>(null);
  let showReturnModal = $state(false);
  let selectedLoan = $state<EnrichedMaterielLoan | null>(null);
  let isRedirecting = $state(false);
  let editingLoanId = $state<string | null>(null); // ID du loan en édition

  // Ouvrir le modal de création d'emprunt
  function openCreateLoanModal() {
    if (!activeTeamId) return;

    // Trouver l'équipe active
    const team = userTeams.find((t) => t.$id === activeTeamId);
    if (!team) {
      toastService.error("Équipe introuvable");
      return;
    }

    editingLoanId = null; // Réinitialiser en mode création
    createLoanModalOpen = true;
  }

  // Ouvrir le modal d'édition d'emprunt
  function openEditLoanModal(loanId: string) {
    if (!activeTeamId) return;

    // Trouver l'équipe active
    const team = userTeams.find((t) => t.$id === activeTeamId);
    if (!team) {
      toastService.error("Équipe introuvable");
      return;
    }

    // Vérifier que la date de fin n'est pas passée
    const loan = materielStore.getLoanById(loanId);
    if (!loan) {
      toastService.error("Emprunt introuvable");
      return;
    }

    const now = new Date();
    const endDate = new Date(loan.endDate);
    if (now > endDate) {
      toastService.error(
        "Impossible de modifier un emprunt dont la date est passée",
      );
      return;
    }

    editingLoanId = loanId; // Passer en mode édition
    createLoanModalOpen = true;
  }

  // Fermer le modal de création d'emprunt
  function closeCreateLoanModal() {
    createLoanModalOpen = false;
    editingLoanId = null; // Réinitialiser le mode édition
  }

  // Après création d'emprunt
  function handleLoanCreated() {
    console.log("[LoansPage] Emprunt créé avec succès");
    closeCreateLoanModal();
  }

  // Ouvrir la fiche de retour
  function openReturnForm(loanId: string) {
    navigate(`/dashboard/loans/return/${loanId}`);
  }

  // Fermer le modal de retour
  function closeReturnModal() {
    showReturnModal = false;
    selectedLoan = null;
  }

  // Actions sur les emprunts
  async function handleAcceptLoan(loanId: string) {
    try {
      await materielStore.acceptLoan(loanId);
      toastService.success("Emprunt accepté avec succès");
    } catch (error) {
      console.error("[LoansPage] Erreur acceptation emprunt:", error);
      toastService.error("Erreur lors de l'acceptation de l'emprunt");
    }
  }

  async function handleCancelLoan(loanId: string) {
    try {
      await materielStore.cancelLoan(loanId);
      toastService.success("Emprunt annulé avec succès");
    } catch (error) {
      console.error("[LoansPage] Erreur annulation emprunt:", error);
      toastService.error("Erreur lors de l'annulation de l'emprunt");
    }
  }

  async function handleCompleteLoan(loanId: string) {
    try {
      await materielStore.completeLoan(loanId);
      toastService.success("Emprunt terminé avec succès");
    } catch (error) {
      console.error("[LoansPage] Erreur terminaison emprunt:", error);
      toastService.error("Erreur lors de la terminaison de l'emprunt");
    }
  }

  async function handleDeleteLoan(loanId: string) {
    try {
      await materielStore.deleteLoan(loanId);
      toastService.success("Emprunt supprimé avec succès");
    } catch (error) {
      console.error("[LoansPage] Erreur suppression emprunt:", error);
      toastService.error("Erreur lors de la suppression de l'emprunt");
    }
  }

  // Équipes de l'utilisateur
  const userTeams = $derived(nativeTeamsStore.myTeams);

  // Équipe active
  const activeTeam = $derived(
    activeTeamId ? userTeams.find((t) => t.$id === activeTeamId) : null,
  );

  // Emprunts filtrés pour l'équipe active
  const teamLoans = $derived.by(() => {
    if (!activeTeamId) {
      console.log("[LoansPage] teamLoans: pas d'activeTeamId");
      return [];
    }
    const filtered = materielStore.loans.filter((loan) => {
      // Vérifier si l'emprunt concerne l'équipe (owner)
      return loan.ownerId === activeTeamId;
    });
    console.log("[LoansPage] teamLoans filtrés:", {
      activeTeamId,
      totalLoans: materielStore.loans.length,
      filteredCount: filtered.length,
      allLoans: materielStore.loans.map((l) => ({
        id: l.$id,
        ownerId: l.ownerId,
      })),
    });
    return filtered;
  });

  // Changer d'équipe
  function switchTeam(teamId: string) {
    navigate(`/dashboard/loans/${teamId}`);
  }

  // Surveiller les changements de teamId dans l'URL pour mettre à jour activeTeamId
  $effect(() => {
    const teamIdFromParams = route.params.teamId;

    if (teamIdFromParams && teamIdFromParams !== activeTeamId) {
      console.log("[LoansPage] teamIdFromParams:", teamIdFromParams);
      // Vérifier que l'utilisateur appartient à cette équipe
      const team = userTeams.find((t) => t.$id === teamIdFromParams);
      console.log("[LoansPage] équipe trouvée:", team);
      if (team) {
        console.log("[LoansPage] Mise à jour activeTeamId:", teamIdFromParams);
        activeTeamId = teamIdFromParams;
      }
    } else if (
      !teamIdFromParams &&
      !activeTeamId &&
      !isRedirecting &&
      userTeams.length > 0
    ) {
      // Premier chargement sans teamId : rediriger vers la première équipe
      console.log(
        "[LoansPage] Redirection vers première équipe:",
        userTeams[0].$id,
      );
      isRedirecting = true;
      navigate(`/dashboard/loans/${userTeams[0].$id}`);
    }
  });

  // =============================================================================
  // NAVBAR CONFIGURATION
  // =============================================================================

  $effect(() => {
    const team = activeTeamId
      ? userTeams.find((t) => t.$id === activeTeamId)
      : null;
    const teamName = team?.name || "Emprunts";

    navBarStore.setConfig({
      title: teamName,
    });
  });

  // Cleanup
  onDestroy(() => {
    navBarStore.reset();
  });
</script>

<div class="container mx-auto p-4" transition:fade>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <!-- Tabs par équipe (seulement si plus d'une équipe) -->
    {#if userTeams.length > 1}
      <div class="tabs tabs-border bg-base-200 tabs-lg mb-6 font-medium">
        {#each userTeams as team (team.$id)}
          {@const loansCount = materielStore.loans.filter(
            (loan) => loan.ownerId === team.$id,
          ).length}
          <button
            class="tab {activeTeamId === team.$id ? 'tab-active' : ''}"
            onclick={() => switchTeam(team.$id)}
          >
            <Users class="mr-2 h-4 w-4" />
            {team.name}
            <span class="badge badge-sm badge-neutral ml-2">
              {loansCount}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Contenu -->
    {#if !globalState.isAuthenticated}
      <div class="alert alert-warning">
        <span>Vous devez être connecté pour voir les emprunts.</span>
      </div>
    {:else if materielStore.error}
      <div class="alert alert-error shadow-lg">
        <span>{materielStore.error}</span>
      </div>
    {:else if !activeTeamId}
      <div class="alert alert-info">
        <span>Sélectionnez une équipe pour voir ses emprunts.</span>
      </div>
    {:else}
      <!-- Liste des emprunts -->
      {#if teamLoans.length === 0}
        <!-- Empty state -->
        <div
          class="bg-base-200 rounded-box border-base-200 border-2 border-dashed py-20 text-center"
        >
          <Users class="mx-auto mb-4 h-12 w-12  text-center opacity-50" />
          <h3 class="mb-2 text-lg font-bold">Aucune réservation</h3>
          <p class="text-base-content/60 mb-6">
            Cette équipe n'a pas encore d'emprunt.
          </p>
          <button class="btn btn-primary btn-sm" onclick={openCreateLoanModal}>
            Créer une réservation
          </button>
        </div>
      {:else}
        <!-- Liste des emprunts -->
        <div class="space-y-4">
          <div class="mb-6 flex justify-end">
            <button
              class="btn btn-primary btn-wide flex gap-2"
              onclick={openCreateLoanModal}
            >
              <Plus size={16} />
              Ajouter une reservation
            </button>
          </div>
          {#each teamLoans as loan (loan.$id)}
            <LoanCard
              {loan}
              onReturn={openReturnForm}
              onAccept={handleAcceptLoan}
              onCancel={handleCancelLoan}
              onDelete={handleDeleteLoan}
              onEdit={openEditLoanModal}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Modal de création d'emprunt -->
{#if activeTeam}
  <CreateLoanModal
    isOpen={createLoanModalOpen}
    onClose={closeCreateLoanModal}
    onSuccess={handleLoanCreated}
    ownerId={activeTeam.$id}
    ownerName={activeTeam.name}
    loanId={editingLoanId ?? undefined}
  />
{/if}

<!-- Modal de retour d'emprunt -->
{#if showReturnModal && selectedLoan}
  <ReturnLoanModal
    loan={selectedLoan}
    isOpen={showReturnModal}
    onClose={closeReturnModal}
  />
{/if}
