<script lang="ts">
  import { TriangleAlert, Save, X } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  interface Props {
    isOpen: boolean;
    isSaving?: boolean;
    message?: string;
    onLeaveWithoutSave: () => void | Promise<void>;
    onSaveAndLeave: () => void | Promise<void>;
    onCancel: () => void;
  }

  let {
    isOpen,
    isSaving = false,
    message = "Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?",
    onLeaveWithoutSave,
    onSaveAndLeave,
    onCancel,
  }: Props = $props();
</script>

<ModalContainer {isOpen} onClose={onCancel}>
  <ModalHeader title="Modifications non sauvegardées" onClose={onCancel} />

  <ModalContent>
    <!-- Contenu avec alerte -->
    <div class="alert alert-warning alert-soft max-md:alert-vertical text-base">
      <TriangleAlert class="h-5 w-5" />
      <span>{message}</span>
    </div>
  </ModalContent>

  <ModalFooter>
    <button class="btn btn-ghost" onclick={onCancel} disabled={isSaving}>
      Rester
    </button>
    <button
      class="btn btn-error"
      onclick={onLeaveWithoutSave}
      disabled={isSaving}
    >
      Quitter sans sauvegarder
    </button>
    <button
      class="btn btn-primary"
      onclick={onSaveAndLeave}
      disabled={isSaving}
    >
      {#if isSaving}
        <span class="loading loading-spinner loading-xs"></span>
        Enregistrement...
      {:else}
        <Save class="mr-1 h-4 w-4" />
        Enregistrer et quitter
      {/if}
    </button>
  </ModalFooter>
</ModalContainer>
