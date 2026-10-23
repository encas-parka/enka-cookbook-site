<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { Plus, Users, LoaderCircle } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import LoanCard from "$lib/components/teamMatos/LoanCard.svelte";
  import { route, navigate, navigateTo } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";

  // État de la page
  let activeTeamId = $state<string | null>(null);
  let isRedirecting = $state(false);

  // Ouvrir la page de création d'emprunt
  function openCreateLoanPage() {
    if (!activeTeamId) return;
    navigateTo(`/dashboard/loans/${activeTeamId}/new`);
  }

  // Ouvrir le dossier d'un emprunt (modification, fiche de retour)
  function openLoanDossier(loanId: string) {
    if (!activeTeamId) return;
    navigateTo(`/dashboard/loans/${activeTeamId}/loan/${loanId}`);
  }

  // Ouvrir la fiche de retour (onglet du dossier emprunt)
  function openReturnForm(loanId: string) {
    if (!activeTeamId) return;
    navigateTo(`/dashboard/loans/${activeTeamId}/loan/${loanId}`, {
      search: { tab: "return" },
    });
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
    activeTeamId ? userTeams.find((t) => t.id === activeTeamId) : null,
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
        id: l.id,
        ownerId: l.ownerId,
      })),
    });
    return filtered;
  });

  // =============================================================================
  // FILTRAGE : masquer les réservations terminées depuis +7 jours
  // =============================================================================

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  let showOldCompleted = $state(false);

  function isOldCompleted(loan: {
    status: string | null;
    completedAt: string | null;
  }): boolean {
    if (loan.status !== "completed" || !loan.completedAt) return false;
    return Date.now() - new Date(loan.completedAt).getTime() >= SEVEN_DAYS_MS;
  }

  const oldCompletedCount = $derived(teamLoans.filter(isOldCompleted).length);

  const visibleLoans = $derived(
    showOldCompleted
      ? teamLoans
      : teamLoans.filter((loan) => !isOldCompleted(loan)),
  );

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
      const team = userTeams.find((t) => t.id === teamIdFromParams);
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
        userTeams[0].id,
      );
      isRedirecting = true;
      navigate(`/dashboard/loans/${userTeams[0].id}`);
    }
  });

  // =============================================================================
  // NAVBAR CONFIGURATION
  // =============================================================================

  $effect(() => {
    const team = activeTeamId
      ? userTeams.find((t) => t.id === activeTeamId)
      : null;
    const teamName = team?.name || "Emprunts";

    navBarStore.setConfig({
      title: teamName,
    });
  });
</script>

<div class="container mx-auto p-4 pb-20" transition:fade>
  <div class="mx-auto max-w-7xl sm:px-4 sm:py-8">
    <!-- Tabs Inventaire / Réservation -->
    <div class="tabs tabs-border bg-base-200 sm:tabs-lg mb-6 font-semibold">
      <button
        class="tab"
        onclick={() => navigate(`/dashboard/materiel/${activeTeamId}`)}
        disabled={!activeTeamId}
      >
        Inventaire
      </button>
      <button class="tab tab-active"> Réservation </button>
    </div>

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
          class="rounded-box border-base-200 bg-base-200 border-2 border-dashed py-20 text-center"
        >
          <Users class="mx-auto mb-4 h-12 w-12  text-center opacity-50" />
          <h3 class="mb-2 text-lg font-bold">Aucune réservation</h3>
          <p class="text-base-content/60 mb-6">
            Cette équipe n'a pas encore d'emprunt.
          </p>
          <button class="btn btn-primary btn-sm" onclick={openCreateLoanPage}>
            Créer une réservation
          </button>
        </div>
      {:else}
        <!-- Liste des emprunts -->
        <div class="space-y-4">
          <div class="mb-6 flex justify-end">
            <button
              class="btn btn-primary btn-sm flex gap-2"
              onclick={openCreateLoanPage}
            >
              <Plus class="size-4" />
              Ajouter une reservation
            </button>
          </div>
          {#each visibleLoans as loan (loan.id)}
            <LoanCard
              {loan}
              onReturn={openReturnForm}
              onAccept={handleAcceptLoan}
              onCancel={handleCancelLoan}
              onDelete={handleDeleteLoan}
              onEdit={openLoanDossier}
            />
          {/each}
          {#if oldCompletedCount > 0}
            <div class="text-center">
              <button
                class="btn btn-link btn-secondary btn-sm"
                onclick={() => (showOldCompleted = !showOldCompleted)}
              >
                {showOldCompleted
                  ? "Masquer les réservations terminées"
                  : `${oldCompletedCount} réservation${oldCompletedCount > 1 ? "s" : ""} terminée${oldCompletedCount > 1 ? "s" : ""} (+ 7j)`}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
