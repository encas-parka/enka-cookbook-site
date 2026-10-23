<script lang="ts">
  /**
   * Modale de création / modification d'un emprunt.
   *
   * Le chrome (en-tête, scroll, pied de page) vit ici ; le métier
   * (dates, sélection du matériel, conflits, soumission) est dans
   * `loan/LoanForm.svelte`, partagé avec la page dossier emprunt.
   */
  import LoanForm from "./loan/LoanForm.svelte";
  import type { LoanSelectionSummary } from "./loan/loan.types";
  import { EMPTY_LOAN_FILTERS } from "$lib/utils/materiel-list.utils";
  import ModalContainer from "../ui/modal/ModalContainer.svelte";
  import ModalContent from "../ui/modal/ModalContent.svelte";
  import ModalFooter from "../ui/modal/ModalFooter.svelte";
  import ModalHeader from "../ui/modal/ModalHeader.svelte";
  import { Check, Trash2, X } from "@lucide/svelte";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    ownerId: string;
    ownerName: string;
    loanId?: string;
    preselectedEventId?: string;
  }

  let {
    isOpen,
    onClose,
    onSuccess,
    ownerId,
    ownerName,
    loanId,
    preselectedEventId,
  }: Props = $props();

  const mode = $derived(loanId ? "edit" : "create");

  let form = $state<ReturnType<typeof LoanForm>>();
  let valid = $state(false);
  let busy = $state(false);
  let summary = $state<LoanSelectionSummary>({ itemCount: 0, totalUnits: 0 });
  /** La réservation existe-t-elle encore ? (bouton d'annulation) */
  let existingLoanStatus = $state<string | null>(null);
  /** Fiche figée (date de fin passée ou retour effectué) : pas d'enregistrement. */
  let frozen = $state(false);
  /** Filtres de la liste, partagés avec le sélecteur compact sous la recherche. */
  let listFilter = $state({ ...EMPTY_LOAN_FILTERS });
  function handleClose() {
    form?.reset();
    onClose();
  }

  function handleSaved() {
    onClose();
    onSuccess?.();
  }

  function handleCancelled() {
    onClose();
    onSuccess?.();
  }
</script>

<ModalContainer {isOpen} onClose={handleClose} maxWidth="lg">
  <ModalHeader
    title={mode === "create"
      ? `Nouvelle réservation - ${ownerName}`
      : `Modifier la réservation - ${ownerName}`}
    onClose={handleClose}
    showBackButton={false}
  />

  <ModalContent>
    <LoanForm
      bind:this={form}
      bind:valid
      bind:busy
      bind:summary
      bind:existingLoanStatus
      bind:frozen
      bind:listFilter
      showSegmentInline
      {ownerId}
      {ownerName}
      {loanId}
      {preselectedEventId}
      onSaved={handleSaved}
      onCancelled={handleCancelled}
      onCancel={handleClose}
    />
  </ModalContent>

  <ModalFooter>
    {#if mode === "edit" && existingLoanStatus === "accepted"}
      <button
        class="btn btn-outline btn-error btn-sm"
        onclick={() => form?.cancelReservation()}
        disabled={busy}
      >
        <Trash2 class="h-4 w-4" />
        <span class="hidden sm:inline">Annuler la réservation</span>
      </button>
    {/if}

    <div class="text-base-content/70 flex-1 text-sm">
      {#if summary.itemCount > 0}
        {summary.itemCount}
        matériel{summary.itemCount > 1 ? "s" : ""} —
        {summary.totalUnits}
        unité{summary.totalUnits > 1 ? "s" : ""}
      {/if}
    </div>

    <button class="btn btn-ghost btn-sm" onclick={handleClose} disabled={busy}>
      <X class="h-5 w-5" />
      Annuler
    </button>
    {#if !frozen}
      <button
        class="btn btn-primary btn-sm"
        onclick={() => form?.submit()}
        disabled={!valid || busy}
      >
        {#if busy}
          <span class="loading loading-sm loading-spinner"></span>
        {:else}
          <Check class="h-5 w-5" />
        {/if}
        {mode === "create" ? "Créer" : "Sauvegarder"}
      </button>
    {/if}
  </ModalFooter>
</ModalContainer>
