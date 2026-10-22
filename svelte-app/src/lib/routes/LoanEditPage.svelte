<script lang="ts">
  /**
   * Page dossier d'un emprunt : création, modification, fiche de retour et
   * export Markdown.
   *
   * Deux urls, un même écran :
   * - `/dashboard/loans/:teamId/new` → création ;
   * - `/dashboard/loans/:teamId/loan/:loanId` → dossier (édition + retour).
   *
   * Le formulaire vit dans `teamMatos/loan/LoanForm.svelte`, la fiche de
   * retour dans `teamMatos/loan/LoanReturnForm.svelte` : la page n'est que
   * le chrome qui les relie.
   */
  import { ArrowLeft, Download, LoaderCircle, Trash2 } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { navigate, route } from "$lib/router";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import LoanForm from "$lib/components/teamMatos/loan/LoanForm.svelte";
  import LoanReturnForm from "$lib/components/teamMatos/loan/LoanReturnForm.svelte";
  import type { LoanSelectionSummary } from "$lib/components/teamMatos/loan/loan.types";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  type Tab = "reservation" | "return";

  const teamId = $derived(route.params.teamId ?? "");
  const loanId = $derived(route.params.loanId ?? undefined);
  const isCreate = $derived(!loanId);

  const team = $derived(
    nativeTeamsStore.myTeams.find((t) => t.id === teamId) ?? null,
  );

  const loan = $derived(loanId ? materielStore.getLoanById(loanId) : undefined);

  /** La fiche de retour n'a de sens que sur un prêt en cours ou rendu. */
  const canReturn = $derived(
    !!loan && (loan.status === "accepted" || loan.status === "completed"),
  );

  let tab = $state<Tab>("reservation");
  let form = $state<ReturnType<typeof LoanForm>>();
  let valid = $state(false);
  let busy = $state(false);
  let dirty = $state(false);
  let summary = $state<LoanSelectionSummary>({ itemCount: 0, totalUnits: 0 });
  let loanStatus = $state<string | null>(null);
  /** Date de fin passée : la réservation est figée, pas d'enregistrement. */
  let endDatePast = $state(false);
  /** Délai dépassé sans emprunt en store : l'emprunt n'existe pas. */
  let missing = $state(false);

  // Onglet initial depuis l'url (?tab=return) — lien profond depuis la liste.
  $effect(() => {
    if (route.search?.tab === "return") tab = "return";
  });

  // Le store peut être en retard sur une url profonde : on patiente avant de
  // conclure à l'absence.
  $effect(() => {
    if (!loanId || loan) return;
    const timer = setTimeout(() => (missing = true), 2000);
    return () => clearTimeout(timer);
  });

  // Sans équipe : la page n'a pas de propriétaire de réservation.
  $effect(() => {
    if (!teamId) {
      toastService.error("Équipe introuvable");
      navigate("/dashboard/loans");
    }
  });

  $effect(() => {
    navBarStore.setConfig({
      title: isCreate ? "Nouvelle réservation" : "Réservation de matériel",
    });
  });

  function goBack() {
    navigate(`/dashboard/loans/${teamId}`);
  }

  function handleSaved(saved?: { id: string }) {
    if (saved?.id) {
      // Création : on ouvre le dossier de l'emprunt créé.
      navigate(`/dashboard/loans/${teamId}/loan/${saved.id}`);
      return;
    }
    // Modification : la page reste en place, le store est à jour.
  }

  function handleCancelled() {
    toastService.success("Réservation annulée");
    goBack();
  }

  function handleExportLoan() {
    if (!loan) return;
    const markdown = materielStore.exportLoanToMarkdown(loan.id);
    if (!markdown) return;
    const slug = toSlug(
      loan.eventName || loan.responsibleName || "reservation",
    );
    shareOrDownload(
      markdown,
      `${slug || "reservation"}-reservation.md`,
      "Réservation exportée",
    );
  }
</script>

<UnsavedChangesGuard
  routeKey={`loan-edit-${loanId ?? "new"}`}
  shouldProtect={() => dirty}
  message="Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?"
/>

<div class="container mx-auto p-4 pb-24" transition:fade>
  <div class="mx-auto max-w-4xl">
    <!-- En-tête -->
    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        class="btn btn-circle btn-ghost"
        onclick={goBack}
        aria-label="Retour aux réservations"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="min-w-2/3 flex-1">
        <h1 class="text-xl font-bold sm:text-2xl">
          {isCreate ? "Nouvelle réservation" : "Réservation de matériel"}
        </h1>
        <p class="text-sm opacity-70">
          {#if team}
            {team.name}
          {/if}
          {#if loan}
            · Emprunt du {formatDateDayMonthShort(loan.startDate)} au
            {formatDateDayMonthShort(loan.endDate)}
          {/if}
        </p>
      </div>

      {#if loan}
        <button
          class="btn btn-outline btn-sm"
          onclick={handleExportLoan}
          title="Exporter la réservation en Markdown"
        >
          <Download class="h-4 w-4" />
          <span class="hidden sm:inline">Exporter</span>
        </button>
      {/if}

      {#if !isCreate && loanStatus === "accepted"}
        <button
          class="btn btn-outline btn-error btn-sm"
          onclick={() => form?.cancelReservation()}
          disabled={busy}
        >
          <Trash2 class="h-4 w-4" />
          <span class="hidden sm:inline">Annuler la réservation</span>
        </button>
      {/if}
    </div>

    <!-- Onglets -->
    {#if canReturn}
      <div class="tabs tabs-border mb-6 bg-base-200 font-semibold sm:tabs-lg">
        <button
          class="tab"
          class:tab-active={tab === "reservation"}
          onclick={() => (tab = "reservation")}
        >
          Réservation
        </button>
        <button
          class="tab"
          class:tab-active={tab === "return"}
          onclick={() => (tab = "return")}
        >
          Fiche de retour
        </button>
      </div>
    {/if}

    <!-- Contenu -->
    {#if tab === "return" && loan}
      <LoanReturnForm {loan} onCompleted={goBack} onCancel={goBack} />
    {:else if isCreate || loan}
      <LoanForm
        bind:this={form}
        bind:valid
        bind:busy
        bind:dirty
        bind:summary
        bind:existingLoanStatus={loanStatus}
        bind:endDatePast
        stickyTopClass="top-12"
        ownerId={teamId}
        ownerName={team?.name ?? ""}
        {loanId}
        onSaved={handleSaved}
        onCancelled={handleCancelled}
        onCancel={goBack}
      />

      <!-- Barre d'action -->
      <div
        class="sticky bottom-0 -mx-4 mt-6 flex items-center gap-2 border-t border-base-300 bg-base-100 px-4 py-3"
      >
        <div class="flex-1 text-sm text-base-content/70">
          {#if summary.itemCount > 0}
            {summary.itemCount}
            matériel{summary.itemCount > 1 ? "s" : ""} —
            {summary.totalUnits}
            unité{summary.totalUnits > 1 ? "s" : ""}
          {/if}
        </div>
        <button class="btn btn-ghost btn-sm" onclick={goBack} disabled={busy}>
          Annuler
        </button>
        {#if !endDatePast}
          <button
            class="btn btn-primary btn-sm"
            onclick={() => form?.submit()}
            disabled={!valid || busy}
          >
            {#if busy}
              <span class="loading loading-sm loading-spinner"></span>
            {/if}
            {isCreate ? "Créer la réservation" : "Enregistrer"}
          </button>
        {/if}
      </div>
    {:else if missing}
      <div class="alert alert-warning">
        <span>Emprunt introuvable.</span>
        <button class="btn btn-sm" onclick={goBack}>Retour</button>
      </div>
    {:else}
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <LoaderCircle
            class="mx-auto mb-4 h-10 w-10 animate-spin text-primary"
          />
          <p class="text-base-content/70">Chargement de la réservation...</p>
        </div>
      </div>
    {/if}
  </div>
</div>
