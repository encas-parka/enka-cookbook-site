<script lang="ts">
  import { TriangleAlert, Info, AlertCircle, X } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: "warning" | "info" | "danger";
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    isOpen,
    title,
    message,
    variant = "warning",
    confirmLabel = "Confirmer",
    cancelLabel = "Annuler",
    onConfirm,
    onCancel,
  }: Props = $props();

  // Dérivation des styles selon le variant
  const alertClass = $derived(
    variant === "danger"
      ? "alert-error"
      : variant === "info"
        ? "alert-info"
        : "alert-warning",
  );

  const btnClass = $derived(
    variant === "danger"
      ? "btn-error"
      : variant === "info"
        ? "btn-info"
        : "btn-warning",
  );

  const IconComponent = $derived(
    variant === "danger"
      ? AlertCircle
      : variant === "info"
        ? Info
        : TriangleAlert,
  );
</script>

<ModalContainer {isOpen} onClose={onCancel}>
  <ModalHeader {title} onClose={onCancel} />

  <ModalContent>
    <!-- Contenu avec alerte -->
    <div class="alert alert-soft {alertClass} max-md:alert-vertical">
      <IconComponent class="h-5 w-5" />
      <span>{message}</span>
    </div>
  </ModalContent>

  <ModalFooter>
    <button class="btn btn-ghost" onclick={onCancel}>
      {cancelLabel}
    </button>
    <button class="btn {btnClass}" onclick={onConfirm}>
      {confirmLabel}
    </button>
  </ModalFooter>
</ModalContainer>
