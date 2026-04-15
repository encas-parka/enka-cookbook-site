<script lang="ts">
  import { Package, Link, Unlink, Trash2, Check, Save, X } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
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
  let submitting = $state(false);
  let formErrors = $state<string[]>([]);
  let formDirty = $state(false);

  const currentItem = $derived(
    itemId
      ? (eventMaterielStore.items.find((item) => item.$id === itemId) ?? null)
      : null,
  );

  const availableHeaders = $derived(
    itemId ? eventMaterielStore.getAvailableHeadersForLink(itemId) : [],
  );

  const currentHeaderName = $derived.by(() => {
    if (!currentItem?.groupId) return null;
    const header = eventMaterielStore.items.find(
      (i) => i.$id === currentItem.groupId,
    );
    return header?.name || null;
  });

  const isAllocation = $derived(!!currentItem?.groupId);
  const formMode = $derived(
    isAllocation ? "allocation" : "header",
  );

  function resetForm() {
    error = null;
    showDeleteConfirm = false;
    formErrors = [];
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
        status: data.status,
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

  async function handleLinkToHeader(headerId: string) {
    if (!itemId) return;
    try {
      await toastService.track(
        eventMaterielStore.linkToHeader(itemId, headerId),
        {
          loading: "Liaison en cours...",
          success: "Item lié au besoin",
          error: "Erreur lors de la liaison",
        },
      );
      onSuccess?.();
    } catch (err: any) {
      error = err.message || "Erreur lors de la liaison";
    }
  }

  async function handleUnlink() {
    if (!itemId) return;
    try {
      await toastService.track(eventMaterielStore.linkToHeader(itemId, null), {
        loading: "Déliaison en cours...",
        success: "Item détaché",
        error: "Erreur lors de la déliaison",
      });
      onSuccess?.();
    } catch (err: any) {
      error = err.message || "Erreur lors de la déliaison";
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

  let formRef: any = $state(null);

  async function handleFooterSubmit() {
    if (formRef) {
      const formEl = formRef.querySelector("form") as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
    }
  }
</script>

<ModalContainer {isOpen} onClose={handleClose} maxWidth="sm" hasUnsavedChanges={formDirty}>
  <ModalHeader
    title={currentItem
      ? `Modifier : ${currentItem.name}`
      : "Modifier le matériel"}
    onClose={handleClose}
  />

  <ModalContent>
    {#if currentItem}
      <div bind:this={formRef}>
        <EventMaterielForm
          {eventId}
          initialData={currentItem}
          onSubmit={updateItem}
          onCancel={handleClose}
          mode={formMode}
          bind:submitting
          bind:errors={formErrors}
          bind:dirty={formDirty}
          {canEditWhere}
        />
      </div>

      {#if isAllocation}
        <div class="bg-base-200 mt-4 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm">
              <Link class="text-primary size-4" />
              <span class="text-base-content/70">Lié au besoin :</span>
              <span class="font-medium">{currentHeaderName}</span>
            </div>
            <button
              class="btn btn-ghost btn-xs text-error gap-1"
              onclick={handleUnlink}
            >
              <Unlink class="size-3" />
              Détacher
            </button>
          </div>
        </div>
      {:else if availableHeaders.length > 0}
        <div class="bg-base-200 mt-4 rounded-lg p-3">
          <div class="mb-2 flex items-center gap-2 text-sm">
            <Link class="text-base-content/50 size-4" />
            <span class="text-base-content/70">Lier à un besoin existant :</span
            >
          </div>
          <div class="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {#each availableHeaders as header (header.$id)}
              <button
                class="btn btn-ghost btn-xs justify-start text-left"
                onclick={() => handleLinkToHeader(header.$id)}
              >
                <Link class="size-3" />
                {header.name}
                <span class="badge badge-ghost badge-xs ml-auto">
                  x{header.quantity || 0}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

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

  <ModalFooter>
    {#if currentItem}
      <button
        type="button"
        class="btn btn-ghost btn-sm text-error"
        onclick={() => (showDeleteConfirm = true)}
        disabled={submitting}
        title="Supprimer"
      >
        <Trash2 class="size-4" />
      </button>
    {/if}
    <div class="flex-1"></div>
    <button type="button" class="btn btn-ghost btn-sm" onclick={handleClose}>
      <X class="size-4" />
      Annuler
    </button>
    <button
      type="button"
      class="btn btn-primary btn-sm"
      onclick={handleFooterSubmit}
      disabled={submitting}
    >
      {#if submitting}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Save class="size-4" />
      {/if}
      Enregistrer
    </button>
  </ModalFooter>
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
