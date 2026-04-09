<script lang="ts">
  import { Package } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import EventMaterielForm from "$lib/components/eventMateriel/EventMaterielForm.svelte";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type {
    UpdateEventMaterielData,
    CreateEventMaterielData,
  } from "$lib/types/event-materiel.types";

  interface Props {
    isOpen: boolean;
    itemId: string | null;
    eventId: string;
    onClose: () => void;
    onSuccess?: () => void;
    canEditWhere?: boolean;
  }

  let {
    isOpen,
    itemId,
    eventId,
    onClose,
    onSuccess,
    canEditWhere = true,
  }: Props = $props();

  let error = $state<string | null>(null);
  let showDeleteConfirm = $state(false);

  const currentItem = $derived(
    itemId
      ? (eventMaterielStore.items.find((item) => item.$id === itemId) ?? null)
      : null,
  );

  function resetForm() {
    error = null;
    showDeleteConfirm = false;
  }

  async function updateItem(data: CreateEventMaterielData) {
    if (!itemId) {
      error = "ID de l'item manquant";
      return;
    }

    error = null;

    try {
      const updateData: UpdateEventMaterielData = {
        name: data.name,
        quantity: data.quantity,
        type: data.type,
        who: data.who,
        where: data.where,
        notes: data.notes,
      };

      await toastService.track(
        eventMaterielStore.updateItem(itemId, updateData),
        {
          loading: "Mise à jour en cours...",
          success: "Matériel mis à jour avec succès",
          error: "Erreur lors de la mise à jour du matériel",
        },
      );

      onSuccess?.();
      resetForm();
      onClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de la mise à jour du matériel";
      console.error("[EditEventMaterielModal] Erreur:", err);
    }
  }

  async function handleDelete() {
    if (!itemId) return;

    error = null;

    try {
      await toastService.track(
        eventMaterielStore.deleteItemAndRemoveFromLoan(itemId),
        {
          loading: "Suppression en cours...",
          success: "Matériel supprimé avec succès",
          error: "Erreur lors de la suppression du matériel",
        },
      );

      onSuccess?.();
      resetForm();
      onClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de la suppression du matériel";
      console.error("[EditEventMaterielModal] Erreur suppression:", err);
    }
  }

  function handleClose() {
    resetForm();
    onClose();
  }
</script>

<ModalContainer {isOpen} onClose={handleClose}>
  <ModalHeader
    title={currentItem
      ? `Modifier : ${currentItem.name}`
      : "Modifier le matériel"}
    onClose={handleClose}
  />

  <ModalContent>
    {#if currentItem}
      <EventMaterielForm
        {eventId}
        initialData={currentItem}
        onSubmit={updateItem}
        onCancel={handleClose}
        onDelete={() => (showDeleteConfirm = true)}
        {canEditWhere}
      />

      {#if error}
        <div class="alert alert-error mt-4">
          <span class="text-sm">{error}</span>
        </div>
      {/if}
    {:else if itemId}
      <div class="alert alert-warning">
        <Package class="h-5 w-5" />
        <span>Item introuvable</span>
      </div>
    {/if}
  </ModalContent>
</ModalContainer>

<ConfirmModal
  isOpen={showDeleteConfirm}
  title="Supprimer le matériel"
  message="Supprimer « {currentItem?.name ?? 'cet item'} »{currentItem?.loanId
    ? ' et le retirer de la réservation'
    : ''} ?"
  variant="danger"
  confirmLabel="Supprimer"
  onConfirm={handleDelete}
  onCancel={() => (showDeleteConfirm = false)}
/>
