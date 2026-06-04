<script lang="ts">
  import { onMount } from "svelte";
  import { WifiOff, Lock, PencilLine, CloudOff } from "@lucide/svelte";
  import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";

  // --- Offline state ---
  let showOffline = $state(false);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    showOffline = !navigator.onLine;
  });

  function handleOffline() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    showOffline = true;
  }

  function handleOnline() {
    hideTimer = setTimeout(() => {
      showOffline = false;
    }, 2000);
  }

  // --- Lock state (réactif) ---
  const lockStatus = $derived(statusBarStore.lockStatus);

  // --- Server state (réactif) ---
  const serverStatus = $derived(statusBarStore.serverStatus);

  // --- Affichage prioritaire : offline > serveur inaccessible > lock by other > lock by me ---
  type StatusEntry = {
    variant: "warning" | "info";
    icon: typeof WifiOff;
    label: string;
  };

  const activeStatus = $derived.by<StatusEntry | null>(() => {
    if (showOffline) {
      return { variant: "warning", icon: WifiOff, label: "Hors ligne" };
    }

    if (serverStatus === "unreachable") {
      return { variant: "warning", icon: CloudOff, label: "Serveur indisponible" };
    }

    const lock = lockStatus;
    if (!lock) return null;

    if (lock.type === "locked-by-other") {
      return {
        variant: "warning",
        icon: Lock,
        label: `Édition par ${lock.userName}`,
      };
    }

    if (lock.type === "locked-by-me") {
      return {
        variant: "info",
        icon: PencilLine,
        label: "Édition en cours",
      };
    }

    return null;
  });

  const colorClasses = $derived(
    activeStatus?.variant === "warning"
      ? "bg-warning/90 text-warning-content"
      : "bg-info/80 text-info-content",
  );
</script>

<svelte:window onoffline={handleOffline} ononline={handleOnline} />

{#if activeStatus}
  <div
    class="fixed right-1 bottom-1 z-50 flex items-center gap-2 rounded-lg px-2 py-1 shadow-lg transition-all duration-300 {colorClasses}"
    role="status"
    aria-live="polite"
  >
    <activeStatus.icon size={14} />
    <span class="text-sm font-medium">{activeStatus.label}</span>
  </div>
{/if}
