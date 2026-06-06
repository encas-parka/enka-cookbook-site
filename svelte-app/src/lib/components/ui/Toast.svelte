<script lang="ts">
  import {
    toastService,
    type Toast,
    type ToastAction,
    type ToastPosition,
    type ToastState,
  } from "$lib/services/toast.service.svelte";
  import {
    X,
    LoaderCircle,
    ChevronDown,
    Check,
    XCircle,
    TriangleAlert,
    Info,
  } from "@lucide/svelte";
  import { slide } from "svelte/transition";

  // Mapping variant → { colorClasses, icon } — calqué sur StatusBar
  type VariantConfig = { colorClasses: string; icon: typeof Info };
  const VARIANT_CONFIG: Record<ToastState, VariantConfig> = {
    success: {
      colorClasses: "bg-success/90 text-success-content",
      icon: Check,
    },
    error: { colorClasses: "bg-error/90 text-error-content", icon: XCircle },
    warning: {
      colorClasses: "bg-warning/90 text-warning-content",
      icon: TriangleAlert,
    },
    info: { colorClasses: "bg-info/80 text-info-content", icon: Info },
    loading: {
      colorClasses: "bg-info/80 text-info-content",
      icon: LoaderCircle,
    },
  };

  interface Props {
    /** Position par défaut pour les toasts sans position spécifiée */
    position?: ToastPosition;
    onShowDetails?: (details: {
      id: string;
      message: string;
      details: any;
    }) => void;
  }

  let { position = "toast-center toast-bottom", onShowDetails }: Props =
    $props();

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
      {@const config = VARIANT_CONFIG[toast.state]}
      {@const IconComponent = config.icon}
      <div
        class="flex items-center gap-2 rounded-lg px-2 py-1 shadow-lg transition-all duration-300 {config.colorClasses}"
        role="status"
        aria-live="polite"
        transition:slide
      >
        <IconComponent
          size={14}
          class={toast.state === "loading" ? "animate-spin" : ""}
        />

        <span class="text-sm font-medium">{toast.message}</span>

        <!-- Boutons d'action personnalisés -->
        {#if toast.actions && toast.actions.length > 0}
          {#each toast.actions as action}
            <button
              class="btn btn-ghost btn-xs"
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
            <ChevronDown size={14} />
          </button>
        {/if}

        <!-- Bouton de fermeture (erreurs, warnings et loading) -->
        {#if toast.state === "error" || toast.state === "warning" || toast.state === "loading"}
          <button
            class="btn btn-ghost btn-xs btn-circle"
            onclick={() => dismiss(toast)}
            title="Fermer"
            aria-label="Fermer la notification"
          >
            <X size={14} />
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/each}
