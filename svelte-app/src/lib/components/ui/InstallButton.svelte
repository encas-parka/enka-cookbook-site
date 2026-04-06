<script lang="ts">
  import { onMount } from "svelte";
  import { Download } from "@lucide/svelte";

  // beforeinstallprompt n'existe pas sur tous les navigateurs (pas Firefox)
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }

  let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
  let isInstallable = $state(false);
  let isInstalled = $state(false);

  function handleBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    isInstallable = true;
  }

  function handleAppInstalled() {
    isInstallable = false;
    isInstalled = true;
    deferredPrompt = null;
  }

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      isInstalled = true;
    }
    deferredPrompt = null;
    isInstallable = false;
  }

  onMount(() => {
    isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  });
</script>

{#if isInstallable && !isInstalled}
  <button class="btn btn-primary btn-sm gap-2 shadow-md" onclick={installApp}>
    <Download size={16} />
    <span>Installer</span>
  </button>
{/if}
