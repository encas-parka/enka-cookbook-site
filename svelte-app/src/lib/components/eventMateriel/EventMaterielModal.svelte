<script lang="ts">
  import {
    Package,
    Link,
    Trash2,
    Save,
    X,
    Plus,
    ArrowRight,
  } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import EventMaterielForm from "$lib/components/eventMateriel/EventMaterielForm.svelte";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type {
    UpdateEventMaterielData,
    CreateEventMaterielData,
  } from "$lib/types/event-materiel.types";
  import fuzzysort from "fuzzysort";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    itemId?: string | null;
    onEditLoan?: (loanId: string) => void;
  }

  let { isOpen, onClose, eventId, itemId = null, onEditLoan }: Props = $props();

  let activeItemId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
  let submitting = $state(false);
  let formErrors = $state<string[]>([]);
  let formDirty = $state(false);
  let formRef: any = $state(null);

  // Sync internal state with prop on open
  $effect(() => {
    if (isOpen) {
      activeItemId = itemId ?? null;
      error = null;
      showDeleteConfirm = false;
      formErrors = [];
      formDirty = false;
    }
  });

  const currentItem = $derived(
    activeItemId
      ? (eventMaterielStore.items.find((item) => item.$id === activeItemId) ??
          null)
      : null,
  );

  const isEdit = $derived(activeItemId !== null);

  const title = $derived(
    isEdit
      ? `Modifier : ${currentItem?.name ?? "le matériel"}`
      : "Ajouter du matériel",
  );

  const isAllocation = $derived(!!currentItem?.groupId);
  const formMode = $derived(isAllocation ? "allocation" : "header");

  const availableHeaders = $derived(
    activeItemId
      ? eventMaterielStore.getAvailableHeadersForLink(activeItemId)
      : [],
  );

  const currentHeaderName = $derived.by(() => {
    if (!currentItem?.groupId) return null;
    const header = eventMaterielStore.items.find(
      (i) => i.$id === currentItem.groupId,
    );
    return header?.name || null;
  });

  // Headers disponibles pour la réattache, triés par pertinence fuzzysort
  // par rapport au nom de l'allocation courante
  const reattachHeaders = $derived.by(() => {
    if (!currentItem) return [];
    const candidates = eventMaterielStore.headers.filter(
      (h) => h.$id !== currentItem.groupId,
    );
    if (candidates.length === 0) return [];

    const query = (currentItem.name || "").trim();
    if (!query) return candidates;

    const sorted = fuzzysort.go(query, candidates, {
      key: "name",
      threshold: -Infinity, // tous les résultats, juste triés
      limit: 50,
    });
    // Les résultats fuzzysort + ceux qui n'ont pas matché (score très bas)
    const sortedIds = new Set(sorted.map((r) => r.obj.$id));
    const remaining = candidates.filter((h) => !sortedIds.has(h.$id));
    return [...sorted.map((r) => r.obj), ...remaining];
  });

  let reattachTargetId = $state<string>("");

  // Sélection d'un item existant dans les suggestions → bascule en mode édition
  function handleExistingSelected(id: string) {
    activeItemId = id;
    error = null;
    formErrors = [];
    formDirty = false;
  }

  // ---- Create ----
  async function handleCreate(data: CreateEventMaterielData) {
    error = null;
    try {
      if (
        data.status &&
        data.status !== "to_find" &&
        (data.who || data.where)
      ) {
        await eventMaterielStore.addHeaderWithAllocation(
          {
            eventId,
            name: data.name,
            quantity: data.quantity,
            type: data.type as any,
            notes: data.notes,
          },
          {
            status: data.status,
            who: data.who,
            where: data.where,
            notes: null,
          },
          globalState.userId || "",
        );
        toastService.success("Besoin et allocation ajoutés");
      } else {
        await eventMaterielStore.addItem(data, globalState.userId || "");
        toastService.success("Item ajouté");
      }
      handleClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de l'ajout";
      console.error("[EventMaterielModal] Create error:", err);
    }
  }

  // ---- Update ----
  async function handleUpdate(data: CreateEventMaterielData) {
    if (!activeItemId) return;
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
        eventMaterielStore.updateItem(activeItemId, updateData),
        {
          loading: "Mise à jour en cours...",
          success: "Matériel mis à jour avec succès",
          error: "Erreur lors de la mise à jour du matériel",
        },
      );
      handleClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de la mise à jour";
      console.error("[EventMaterielModal] Update error:", err);
    }
  }

  // ---- Unified submit ----
  async function handleSubmit(data: CreateEventMaterielData) {
    submitting = true;
    try {
      if (isEdit) {
        await handleUpdate(data);
      } else {
        await handleCreate(data);
      }
    } finally {
      submitting = false;
    }
  }

  // ---- Link / Reattach ----
  async function handleLinkToHeader(headerId: string) {
    if (!activeItemId) return;
    try {
      await toastService.track(
        eventMaterielStore.linkToHeader(activeItemId, headerId),
        {
          loading: "Liaison en cours...",
          success: "Allocation rattachée au besoin",
          error: "Erreur lors de la liaison",
        },
      );
    } catch (err: any) {
      error = err.message || "Erreur lors de la liaison";
    }
  }

  async function handleReattachSelect() {
    if (!reattachTargetId || !activeItemId) return;
    try {
      const result = await toastService.track(
        eventMaterielStore.reattachAndCleanup(activeItemId, reattachTargetId),
        {
          loading: "Rattachement en cours...",
          success: "Réservation rattachée au besoin",
          error: "Erreur lors du rattachement",
        },
      );
      reattachTargetId = "";
      if (result.orphanDeleted) {
        toastService.info(
          `Besoin "${result.orphanName}" supprimé (plus aucune réservation)`,
        );
      }
    } catch (err: any) {
      error = err.message || "Erreur lors du rattachement";
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!activeItemId) return;
    error = null;
    try {
      await toastService.track(
        eventMaterielStore.deleteItemAndRemoveFromLoan(activeItemId),
        {
          loading: "Suppression en cours...",
          success: "Matériel supprimé avec succès",
          error: "Erreur lors de la suppression du matériel",
        },
      );
      handleClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de la suppression";
      console.error("[EventMaterielModal] Delete error:", err);
    }
  }

  // ---- Close ----
  function handleClose() {
    error = null;
    activeItemId = null;
    showDeleteConfirm = false;
    formErrors = [];
    formDirty = false;
    reattachTargetId = "";
    onClose();
  }

  function handleFooterSubmit() {
    if (formRef) {
      const formEl = formRef.querySelector("form") as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
    }
  }

  function handleOpenLoan(loanId: string) {
    handleClose();
    onEditLoan?.(loanId);
  }
</script>

<ModalContainer
  {isOpen}
  onClose={handleClose}
  maxWidth="sm"
  hasUnsavedChanges={formDirty}
>
  <ModalHeader {title} onClose={handleClose} />

  <ModalContent>
    {#if isEdit && !currentItem}
      <div class="alert alert-warning">
        <Package class="h-5 w-5" />
        <span>Item introuvable</span>
      </div>
    {:else}
      <div bind:this={formRef}>
        {#key activeItemId}
          <EventMaterielForm
            {eventId}
            initialData={currentItem}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            mode={isEdit ? formMode : "item"}
            bind:submitting
            bind:errors={formErrors}
            bind:dirty={formDirty}
            onExistingSelected={handleExistingSelected}
            onEditLoan={handleOpenLoan}
          />
        {/key}
      </div>

      <!-- Link/Reattach section (edit mode only) -->
      {#if isEdit && currentItem}
        {#if isAllocation}
          <div class="bg-base-200 mt-4 rounded-lg p-3">
            <div class="mb-2 flex items-center gap-2 text-sm">
              <Link class="text-primary size-4" />
              <span class="text-base-content/70">Lié au besoin :</span>
              <span class="font-medium">{currentHeaderName ?? "Inconnu"}</span>
            </div>
            {#if reattachHeaders.length > 0}
              <div class="mt-2">
                <p class="text-base-content/60 mb-1 text-xs">
                  <ArrowRight class="inline size-3" />
                  Rattacher à un autre besoin :
                </p>
                <div class="flex items-center gap-2">
                  <select
                    class="select select-sm grow"
                    bind:value={reattachTargetId}
                  >
                    <option value="" disabled selected
                      >Choisir un besoin…</option
                    >
                    {#each reattachHeaders as header (header.$id)}
                      <option value={header.$id}>
                        {header.name || "Sans nom"} (x{header.quantity || 0})
                      </option>
                    {/each}
                  </select>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    disabled={!reattachTargetId}
                    onclick={handleReattachSelect}
                  >
                    <ArrowRight class="size-4" />
                  </button>
                </div>
              </div>
            {:else}
              <p class="text-base-content/40 mt-1 text-xs">
                Aucun autre besoin disponible pour le rattacher.
              </p>
            {/if}
          </div>
        {:else if !!currentItem?.loanId && availableHeaders.length > 0}
          <div class="bg-base-200 mt-4 rounded-lg p-3">
            <div class="mb-2 flex items-center gap-2 text-sm">
              <Link class="text-base-content/50 size-4" />
              <span class="text-base-content/70"
                >Lier à un besoin existant :</span
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
      {/if}

      {#if error}
        <div class="alert alert-error mt-4">
          <span class="text-sm">{error}</span>
        </div>
      {/if}
    {/if}
  </ModalContent>

  <ModalFooter>
    {#if isEdit && currentItem}
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
      {:else if isEdit}
        <Save class="size-4" />
      {:else}
        <Plus class="size-4" />
      {/if}
      {isEdit ? "Enregistrer" : "Ajouter"}
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
