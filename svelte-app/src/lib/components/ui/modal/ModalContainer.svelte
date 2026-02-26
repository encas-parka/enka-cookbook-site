<script lang="ts">
  import type { Snippet } from "svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";

  type ModalSize = "sm" | "lg" | "xl";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    fullscreenOnMobile?: boolean;
    closeOnBackdropClick?: boolean;
    hasUnsavedChanges?: boolean;
    confirmCloseMessage?: string;
    maxWidth?: ModalSize;
    maxHeight?: ModalSize;
    modalClass?: string;
    children: Snippet;
  }

  let {
    isOpen,
    onClose,
    fullscreenOnMobile = true,
    closeOnBackdropClick = false,
    hasUnsavedChanges = false,
    confirmCloseMessage = "Vous avez des modifications non sauvegardées. Voulez-vous vraiment fermer ?",
    maxWidth = "lg",
    maxHeight = "xl",
    modalClass = "",
    children,
  }: Props = $props();

  // Fonctions utilitaires pour contourner le tree-shaking de Tailwind
  // Toutes les classes doivent être mentionnées explicitement
  // max-w : taille maximale (le modal ne peut pas dépasser cette taille)
  // max-h : hauteur maximale (le modal ne peut pas dépasser cette hauteur)
  function getSizeClass(size: ModalSize, dimension: "max-w" | "max-h"): string {
    const sizeMap: Record<ModalSize, Record<typeof dimension, string>> = {
      sm: {
        "max-w": "max-w-[28rem]", // ~448px maximum
        "max-h": "max-h-[85dvh]",
      },
      lg: {
        "max-w": "max-w-[64rem]", // ~1024px maximum
        "max-h": "max-h-[85dvh]",
      },
      xl: {
        "max-w": "max-w-[90vw]", // 90% de l'écran maximum
        "max-h": "max-h-[85dvh]",
      },
    };

    return sizeMap[size][dimension];
  }

  let showConfirmDialog = $state(false);

  function handleClose() {
    if (hasUnsavedChanges) {
      showConfirmDialog = true;
    } else {
      onClose();
    }
  }

  function confirmClose() {
    showConfirmDialog = false;
    onClose();
  }

  function cancelClose() {
    showConfirmDialog = false;
  }

  // Gestion de la touche ESC
  $effect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showConfirmDialog) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });
</script>

<div class="modal {isOpen && 'modal-open'} ">
  <!-- Modal box -->
  {#if isOpen}
    <div
      class="modal-box flex flex-col p-0 {modalClass} {fullscreenOnMobile &&
      globalState.isMobile
        ? 'fixed inset-0 m-0 h-lvh w-lvw rounded-none'
        : 'fixed top-10 m-auto '} {!(
        fullscreenOnMobile && globalState.isMobile
      ) && getSizeClass(maxWidth, 'max-w')} {!(
        fullscreenOnMobile && globalState.isMobile
      ) &&
        !modalClass &&
        'max-h-[85dvh]'}"
      role="dialog"
      aria-modal="true"
    >
      {@render children()}
    </div>
  {/if}
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
  <div class="modal modal-open" style="z-index: 1100">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold">Confirmer la fermeture</h3>
      <p class="py-4">{confirmCloseMessage}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={cancelClose}>Annuler</button>
        <button class="btn btn-error" onclick={confirmClose}>
          Fermer sans sauvegarder
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* S'assurer que le modal est au-dessus de tout */
  :global(.modal) {
    z-index: 1050;
  }
</style>
