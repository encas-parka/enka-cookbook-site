<script lang="ts">
  import { X, Save, Package, Users } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import MaterielForm from "$lib/components/teamMatos/MaterielForm.svelte";

  interface Props {
    isOpen: boolean;
    materielId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { isOpen, materielId, onClose, onSuccess }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);

  // État du formulaire (référence pour MaterielForm)
  let formRef = $state<{
    submit: () => void;
    reset: () => void;
  } | null>(null);

  // Données du matériel actuel
  const currentMateriel = $derived(
    materielId ? materielStore.getMaterielById(materielId) : null,
  );

  // Statut pour le formulaire : convertir les statuts calculés (loan, reserved) en "ok"
  const formStatus = $derived.by(() => {
    if (!currentMateriel) return "ok";
    // Si le statut est calculé (loan ou reserved), on utilise "ok" pour l'édition
    if (
      currentMateriel.status === "loan" ||
      currentMateriel.status === "reserved"
    ) {
      return "ok";
    }
    return currentMateriel.status;
  });

  // Réinitialiser le formulaire
  function resetForm() {
    error = null;
  }

  // Mettre à jour le matériel
  async function updateMateriel(data: any) {
    if (!materielId) {
      error = "ID du matériel manquant";
      return;
    }

    loading = true;
    error = null;

    try {
      await materielStore.updateMateriel(materielId, {
        name: data.name,
        description: data.description || undefined,
        type: data.type || "other",
        status: data.status,
        quantity: data.quantity,
        location: data.location || undefined,
      });

      console.log("[EditMaterielModal] Matériel mis à jour:", materielId);
      onSuccess?.();
      resetForm();
      onClose();
    } catch (err: any) {
      error = err.message || "Erreur lors de la mise à jour du matériel";
      console.error("[EditMaterielModal] Erreur:", err);
    } finally {
      loading = false;
    }
  }

  // Fermer et réinitialiser
  function handleClose() {
    resetForm();
    onClose();
  }

  // Gérer la soumission depuis le formulaire
  function handleSubmit() {
    if (formRef) {
      formRef.submit();
    }
  }
</script>

<ModalContainer {isOpen} onClose={handleClose}>
  <ModalHeader title="Modifier le matériel" onClose={handleClose} />

  <ModalContent>
    {#if currentMateriel}
      <!-- Informations du propriétaire -->
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

      <MaterielForm
        showStatus={true}
        initialValues={{
          name: currentMateriel.name,
          description: currentMateriel.description,
          type: currentMateriel.type,
          status: formStatus,
          quantity: currentMateriel.quantity,
          location: currentMateriel.location,
          shareableWith: currentMateriel.shareableWith,
        }}
        onSubmit={updateMateriel}
        onCancel={handleClose}
      />

      <!-- Message d'erreur -->
      {#if error}
        <div class="alert alert-error">
          <span class="text-sm">{error}</span>
        </div>
      {/if}

      <!-- Emprunts en cours -->
      <!-- {#if currentMateriel.loans.length > 0}
        <div class="divider">Emprunts en cours</div>
        <div class="space-y-2">
          {#each currentMateriel.loans as loan, index}
            <div class="card card-compact border-base-300 bg-base-200 border-2">
              <div class="card-body">
                <div class="flex justify-between">
                  <div>
                    <div class="font-semibold">
                      {loan.responsible} - {loan.quantity} unité(s)
                    </div>
                    <div class="text-base-content/70 text-sm">
                      Du {formatDateDayMonthShort(loan.startDate)} au
                      {formatDateDayMonthShort(loan.endDate)}
                    </div>
                    <div class="text-base-content/70 text-sm">
                      {loan.reason}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
        <p class="text-base-content/60 text-sm">
          💡 La gestion des emprunts sera disponible prochainement
        </p>
      {/if} -->
    {:else}
      <div class="alert alert-warning">
        <span>Matériel introuvable</span>
      </div>
    {/if}
  </ModalContent>
</ModalContainer>
