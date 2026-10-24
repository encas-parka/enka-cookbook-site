<script lang="ts">
  /**
   * Composant factice du test de fumée du harness modale — enveloppe
   * ModalContainer avec le patron réel des modales de l'app
   * (isOpen/onClose, ici `$bindable` pour que la fermeture déclenchée en
   * interne fasse disparaître le dialogue dans le test). Aucun usage
   * applicatif.
   */
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";

  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
    hasUnsavedChanges?: boolean;
  }

  let {
    isOpen = $bindable(false),
    onClose,
    hasUnsavedChanges = false,
  }: Props = $props();

  function close() {
    isOpen = false;
    onClose?.();
  }
</script>

<ModalContainer {isOpen} onClose={close} {hasUnsavedChanges}>
  <div class="p-4">
    <button class="btn" onclick={() => toastService.success("Action réussie")}>
      Signaler
    </button>
    <button class="btn" onclick={close}>Fermer</button>
  </div>
</ModalContainer>
