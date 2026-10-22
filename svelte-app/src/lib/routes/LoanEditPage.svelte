<script lang="ts">
  /**
   * Page dossier d'un emprunt : création, modification, fiche de retour et
   * export Markdown.
   *
   * Deux urls, un même écran :
   * - `/dashboard/loans/:teamId/new` → création ;
   * - `/dashboard/loans/:teamId/loan/:loanId` → dossier (édition + retour).
   *
   * Chrome uniquement : les actions vivent dans la navbar (contextuelles à
   * l'onglet actif), les facettes de la liste dans la sidebar (desktop) ou
   * le drawer (mobile). Le formulaire vit dans `loan/LoanForm.svelte`, la
   * fiche de retour dans `loan/LoanReturnForm.svelte`.
   */
  import { Check, Download, LoaderCircle, RotateCcw, X } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { navigate, route } from "$lib/router";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import LoanForm from "$lib/components/teamMatos/loan/LoanForm.svelte";
  import LoanReturnForm from "$lib/components/teamMatos/loan/LoanReturnForm.svelte";
  import LoanMaterielFilters, {
    type LoanListFilters,
  } from "$lib/components/teamMatos/loan/LoanMaterielFilters.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import type { LoanSelectionSummary } from "$lib/components/teamMatos/loan/loan.types";
  import { LOAN_TYPE_ORDER } from "$lib/utils/materiel-list.utils";
  import { getLoanStatusConfig } from "$lib/utils/materiel.utils";
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

  const statusConfig = $derived(getLoanStatusConfig(loan?.status));

  let tab = $state<Tab>("reservation");
  /** L'onglet par défaut n'est décidé qu'une fois (le store peut tarder). */
  let tabDecided = $state(false);

  let form = $state<ReturnType<typeof LoanForm>>();
  let valid = $state(false);
  let busy = $state(false);
  let dirty = $state(false);
  let summary = $state<LoanSelectionSummary>({ itemCount: 0, totalUnits: 0 });
  let loanStatus = $state<string | null>(null);
  /** Date de fin passée : la réservation est figée, pas d'enregistrement. */
  let endDatePast = $state(false);

  let returnForm = $state<ReturnType<typeof LoanReturnForm>>();
  let returnValid = $state(false);
  let returnSaving = $state(false);
  let returnDirty = $state(false);
  let returnReadOnly = $state(false);

  /** Facettes de la sidebar, appliquées à la liste via le cœur du formulaire. */
  let listFilters = $state<LoanListFilters>({ types: [], segments: [] });

  /** Types présents dans l'inventaire de l'équipe, dans l'ordre canonique. */
  const availableTypes = $derived.by(() => {
    if (!teamId) return [];
    const present = new Set<string>();
    for (const m of materielStore.materiels) {
      if (m.teamId === teamId || m.shareableWith?.includes(teamId)) {
        present.add(m.type || "other");
      }
    }
    return LOAN_TYPE_ORDER.filter((t) => present.has(t)).concat(
      [...present].filter((t) => !LOAN_TYPE_ORDER.includes(t)).sort(),
    );
  });

  function resetListFilters() {
    listFilters = { types: [], segments: [] };
  }

  // Onglet par défaut : ?tab= explicite gagne ; sinon un prêt rendu ou échu
  // s'ouvre sur sa fiche de retour ; sinon la réservation.
  $effect(() => {
    const explicit = route.search?.tab;
    if (explicit === "return" || explicit === "reservation") {
      tab = explicit;
      tabDecided = true;
      return;
    }
    if (tabDecided) return;
    if (isCreate) {
      tab = "reservation";
      tabDecided = true;
      return;
    }
    if (!loan) return;
    const endDatePassed =
      !!loan.endDate && Date.now() > new Date(loan.endDate).getTime();
    tab =
      loan.status === "completed" || (endDatePassed && canReturn)
        ? "return"
        : "reservation";
    tabDecided = true;
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
      actions: navActions,
    });
  });

  /** Délai dépassé sans emprunt en store : l'emprunt n'existe pas. */
  let missing = $state(false);

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

{#snippet navActions()}
  <div class="flex items-center gap-2">
    {#if tab === "return" && loan}
      <button
        class="btn btn-circle btn-outline btn-sm"
        onclick={() => returnForm?.exportSheet()}
        disabled={returnSaving}
        title="Exporter la fiche de retour en Markdown"
      >
        <Download class="h-4 w-4" />
        <span class="hidden sm:inline">Exporter la fiche</span>
      </button>
      {#if !returnReadOnly}
        <button
          class="btn btn-primary btn-sm"
          onclick={() => returnForm?.submit()}
          disabled={!returnValid || returnSaving}
        >
          {#if returnSaving}
            <span class="loading loading-sm loading-spinner"></span>
          {:else}
            <RotateCcw class="h-4 w-4" />
          {/if}
          <span class="hidden sm:inline">Valider le retour</span>
        </button>
      {/if}
    {:else}
      {#if !isCreate}
        <button
          class="btn btn-circle btn-outline btn-sm"
          onclick={handleExportLoan}
          title="Exporter la réservation en Markdown"
        >
          <Download class="h-4 w-4" />
          <span class="hidden sm:inline">Exporter</span>
        </button>
      {/if}
      {#if !endDatePast}
        <button
          class="btn btn-primary btn-sm"
          onclick={() => form?.submit()}
          disabled={!valid || busy}
        >
          {#if busy}
            <span class="loading loading-sm loading-spinner"></span>
          {:else}
            <Check class="h-4 w-4" />
          {/if}
          <span class="hidden sm:inline"
            >{isCreate ? "Créer la réservation" : "Enregistrer"}</span
          >
        </button>
      {/if}
    {/if}
    <button
      class="btn btn-ghost btn-sm"
      onclick={goBack}
      disabled={busy || returnSaving}
      title="Revenir aux réservations"
    >
      <X class="h-4 w-4" />
      <span class="hidden sm:inline">Annuler</span>
    </button>
  </div>
{/snippet}

<UnsavedChangesGuard
  routeKey={`loan-edit-${loanId ?? "new"}`}
  shouldProtect={() => (tab === "return" ? returnDirty : dirty)}
  message="Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?"
/>

{#if tab === "reservation"}
  <!-- Facettes : sidebar desktop / drawer mobile -->
  <LeftPanel>
    <LoanMaterielFilters
      bind:filters={listFilters}
      {availableTypes}
      onReset={resetListFilters}
    />
  </LeftPanel>
{/if}

<!-- Contenu principal -->
<div
  class="p-4 pb-20 {tab === 'reservation' ? 'lg:ml-96' : ''}"
  transition:fade
>
  <div class="mx-auto max-w-7xl">
    <!-- En-tête sobre : les gestes vivent dans la navbar -->
    <div class="mb-4">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 class="text-xl font-bold sm:text-2xl">
          {isCreate ? "Nouvelle réservation" : "Réservation de matériel"}
        </h1>
        {#if loan}
          <span class="badge badge-sm {statusConfig.badgeClass}">
            {statusConfig.label}
          </span>
        {/if}
      </div>
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
      <LoanReturnForm
        bind:this={returnForm}
        {loan}
        bind:valid={returnValid}
        bind:saving={returnSaving}
        bind:dirty={returnDirty}
        bind:isReadOnly={returnReadOnly}
      />
    {:else if isCreate || loan}
      <LoanForm
        bind:this={form}
        bind:valid
        bind:busy
        bind:dirty
        bind:summary
        bind:existingLoanStatus={loanStatus}
        bind:endDatePast
        framed
        listFilter={listFilters}
        stickyTopClass="top-12"
        ownerId={teamId}
        ownerName={team?.name ?? ""}
        {loanId}
        onSaved={handleSaved}
        onCancelled={handleCancelled}
        onCancel={goBack}
      />
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
