<script lang="ts">
  import { WifiOff } from "@lucide/svelte";

  let showOffline = $state(!navigator.onLine);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

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
</script>

<svelte:window onoffline={handleOffline} ononline={handleOnline} />

{#if showOffline}
  <div
    class="bg-warning/90 text-warning-content fixed right-1 bottom-1 z-50 flex items-center gap-2 rounded-lg px-2 py-1 shadow-lg transition-opacity duration-300"
    role="status"
    aria-live="polite"
  >
    <WifiOff size={14} />
    <span class="text-sm font-medium">Hors ligne</span>
  </div>
{/if}
