<script lang="ts">
  import { Users } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import MaterielForm from "$lib/components/teamMatos/MaterielForm.svelte";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
    availableLocations: string[];
    materielId?: string | null;
  }

  let {
    isOpen,
    onClose,
    teamId,
    teamName,
    availableLocations,
    materielId = null,
  }: Props = $props();

  let activeMaterielId = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Sync internal state with prop on open
  $effect(() => {
    if (isOpen) {
      activeMaterielId = materielId ?? null;
      error = null;
    }
  });

  const currentMateriel = $derived(
    activeMaterielId ? materielStore.getMaterielById(activeMaterielId) : null,
  );

  const isEdit = $derived(activeMaterielId !== null);

  const title = $derived(isEdit ? "Modifier le matériel" : "Ajouter du matériel");

  // Convertir les statuts calculés (loan, reserved) en "ok" pour l'édition
  const formStatus = $derived.by(() => {
    if (!currentMateriel) return "ok";
    if (
      currentMateriel.status === "loan" ||
      currentMateriel.status === "reserved"
    ) {
      return "ok";
    }
    return currentMateriel.status;
  });

  // Sélection d'un item existant dans les suggestions → bascule en mode édition
  function handleExistingSelected(id: string) {
    activeMaterielId = id;
  }

  async function handleSubmit(data: any) {
    loading = true;
    error = null;
    try {
      if (activeMaterielId) {
        await materielStore.updateMateriel(activeMaterielId, {
          name: data.name,
          description: data.description || undefined,
          type: data.type || "other",
          status: data.status,
          quantity: data.quantity,
          location: data.location || undefined,
        });
        toastService.success("Matériel mis à jour");
      } else {
        await materielStore.createMateriel(data);
        toastService.success("Matériel ajouté avec succès");
      }
      handleClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de l'enregistrement";
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    error = null;
    activeMaterielId = null;
    onClose();
  }
</script>

<ModalContainer {isOpen} onClose={handleClose}>
  <ModalHeader {title} onClose={handleClose} />

  <ModalContent>
    {#if isEdit && currentMateriel}
      <div class="alert alert-soft mb-4">
        <div class="flex items-center gap-2 text-sm">
          <Users class="h-4 w-4" />
          <div>
            {#if currentMateriel.ownerData?.teamId}
              <div>
                <span class="font-semibold">Équipe propriétaire :</span>
                {currentMateriel.ownerData.teamName}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if isEdit && !currentMateriel}
      <div class="alert alert-warning">
        <span>Matériel introuvable</span>
      </div>
    {:else}
      {#key activeMaterielId}
        <MaterielForm
          showStatus={isEdit}
          initialValues={currentMateriel
            ? {
                name: currentMateriel.name,
                description: currentMateriel.description,
                type: currentMateriel.type,
                status: formStatus,
                quantity: currentMateriel.quantity,
                location: currentMateriel.location,
                shareableWith: currentMateriel.shareableWith,
              }
            : null}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          ownerId={teamId}
          ownerName={teamName}
          teamId={teamId}
          {availableLocations}
          onExistingSelected={handleExistingSelected}
        />
      {/key}
    {/if}

    {#if error}
      <div class="alert alert-error mt-4">
        <span class="text-sm">{error}</span>
      </div>
    {/if}
  </ModalContent>
</ModalContainer>
