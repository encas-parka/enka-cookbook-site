<script lang="ts">
  /**
   * Page « Fiche de retour » d'un emprunt.
   *
   * Chrome de la page (retour, titre, période) ; la saisie de l'état des
   * matériels vit dans `loan/LoanReturnForm.svelte`, partagée avec l'onglet
   * « Retour » du dossier emprunt.
   */
  import { ArrowLeft } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { route, navigate } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import { onMount } from "svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import LoanReturnForm from "$lib/components/teamMatos/loan/LoanReturnForm.svelte";

  onMount(() => {
    navBarStore.reset();
  });

  const loanId = $derived(route.params.loanId);

  const loan = $derived.by(() => {
    if (!loanId) return null;
    return materielStore.getLoanById(loanId);
  });

  let isReadOnly = $state(false);

  // Vérifier que l'emprunt est bien retournable
  $effect(() => {
    if (!loanId) {
      toastService.error("Emprunt non trouvé");
      navigate("/dashboard/loans");
      return;
    }

    const loanData = materielStore.getLoanById(loanId);
    if (
      !loanData ||
      (loanData.status !== "accepted" && loanData.status !== "completed")
    ) {
      toastService.error("Emprunt non valide");
      navigate("/dashboard/loans");
      return;
    }
  });

  // Retourner à la liste
  function goBack() {
    navigate("/dashboard/loans");
  }
</script>

<div class="container mx-auto p-4" transition:fade>
  <div class="mx-auto max-w-4xl">
    <!-- Header -->
    <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        class="btn btn-circle btn-ghost"
        onclick={goBack}
        aria-label="Retour"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="min-w-2/3 flex-1">
        <h1 class="text-xl font-bold sm:text-2xl">Fiche de retour</h1>
        {#if loan}
          <p class="text-sm opacity-70">
            Emprunt du {formatDateDayMonthShort(loan.startDate)} au{" "}
            {formatDateDayMonthShort(loan.endDate)}
          </p>
        {/if}
      </div>
      {#if isReadOnly}
        <div class="badge badge-info">Mode lecture seule</div>
      {/if}
    </div>

    {#if loan}
      <LoanReturnForm
        {loan}
        bind:isReadOnly
        onCompleted={goBack}
        onCancel={goBack}
      />
    {:else}
      <div class="alert alert-warning">
        <span>Chargement de l'emprunt...</span>
      </div>
    {/if}
  </div>
</div>
