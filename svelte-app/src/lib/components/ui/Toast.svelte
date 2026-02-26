<script lang="ts">
  import {
    toastService,
    type Toast,
    type ToastAction,
    type ToastPosition,
  } from "$lib/services/toast.service.svelte";
  import { X, LoaderCircle, ChevronDown } from "@lucide/svelte";
  import { slide } from "svelte/transition";

  interface Props {
    /** Position par défaut pour les toasts sans position spécifiée */
    position?: ToastPosition;
    padding?: "sm" | "md";
    onShowDetails?: (details: {
      id: string;
      message: string;
      details: any;
    }) => void;
  }

  let {
    position = "toast-center toast-bottom",
    padding = "sm",
    onShowDetails,
  }: Props = $props();

  // Dériver les classes de padding
  const paddingClass = $derived(padding === "sm" ? " py-0.5" : "py-1");

  const toasts = $derived(toastService.toasts);

  // Grouper les toasts par position
  const toastsByPosition = $derived(() => {
    const groups = new Map<ToastPosition, Toast[]>();

    for (const toast of toasts) {
      const pos = toast.position || position;
      if (!groups.has(pos)) {
        groups.set(pos, []);
      }
      groups.get(pos)!.push(toast);
    }

    return groups;
  });

  function dismiss(toast: Toast) {
    toastService.dismiss(toast.id);
  }

  function showDetails(toast: Toast) {
    onShowDetails?.({
      id: toast.id,
      message: toast.message,
      details: toast.details,
    });
  }

  function handleActionClick(toast: Toast, action: ToastAction) {
    action.onClick();
  }
</script>

<!-- Conteneurs de toasts DaisyUI - un par position utilisée -->
{#each Array.from(toastsByPosition().entries()) as [pos, positionToasts] (pos)}
  <div class="toast {pos} z-1050">
    {#each positionToasts as toast (toast.id)}
      <div
        class="alert alert-{toast.state}  {paddingClass} shadow-lg"
        transition:slide
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-1 items-center gap-2">
            {#if toast.state === "loading"}
              <LoaderCircle class="h-5 w-5 animate-spin" />
            {/if}

            <span class="text-sm">{toast.message}</span>
          </div>

          <!-- Boutons d'action personnalisés -->
          {#if toast.actions && toast.actions.length > 0}
            {#each toast.actions as action}
              <button
                class="btn btn-sm btn-primary"
                onclick={() => handleActionClick(toast, action)}
              >
                {action.label}
              </button>
            {/each}
          {/if}

          <!-- Bouton détails si disponible -->
          {#if toast.details}
            <button
              class="btn btn-ghost btn-xs btn-square"
              onclick={() => showDetails(toast)}
              title="Voir les détails"
              aria-label="Voir les détails"
            >
              <ChevronDown class="h-3 w-3" />
            </button>
          {/if}

          <!-- Bouton de fermeture (erreurs et warnings uniquement) -->
          {#if toast.state === "error" || toast.state === "warning" || toast.state === "loading"}
            <button
              class="btn btn-ghost btn-xs btn-circle pe-0"
              onclick={() => dismiss(toast)}
              title="Fermer"
              aria-label="Fermer la notification"
            >
              <X class="h-4 w-4" />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/each}
