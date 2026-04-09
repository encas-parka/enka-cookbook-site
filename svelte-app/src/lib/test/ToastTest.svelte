<script lang="ts">
  import { toastService } from "$lib/services/toast.service.svelte";

  function testAllToasts() {
    // Toast de succès avec délai personnalisé (devrait s'auto-fermer)
    toastService.success("Succès avec délai personnalisé", {
      autoCloseDelay: 3000,
    });

    // Toast d'erreur avec délai personnalisé (devrait s'auto-fermer)
    toastService.error("Erreur avec délai personnalisé", {
      autoCloseDelay: 5000,
    });

    // Toast d'erreur sans délai personnalisé (ne devrait pas s'auto-fermer)
    toastService.error("Erreur sans délai personnalisé");

    // Toast d'avertissement avec délai personnalisé (devrait s'auto-fermer)
    toastService.warning("Avertissement avec délai personnalisé", {
      autoCloseDelay: 4000,
    });

    // Toast d'avertissement sans délai personnalisé (ne devrait pas s'auto-fermer)
    toastService.warning("Avertissement sans délai personnalisé");

    // Toast d'information avec délai personnalisé (devrait s'auto-fermer)
    toastService.info("Information avec délai personnalisé", {
      autoCloseDelay: 6000,
    });

    // Toast de chargement (ne devrait pas s'auto-fermer)
    toastService.loading("Chargement (ne s'auto-ferme pas)");
  }

  async function testAsyncOperation() {
    await toastService.track(
      new Promise((resolve) => setTimeout(() => resolve("Test réussi"), 2000)),
      {
        loading: "Opération asynchrone en cours...",
        success: "Opération réussie",
        error: "Opération échouée",
        successDelay: 3000,
        errorDelay: 5000,
      },
    );
  }
</script>

<div class="space-y-4 p-8">
  <h2 class="mb-4 text-xl font-bold">Test du service Toast</h2>

  <div class="space-y-2">
    <p>Cliquez sur les boutons pour tester différents types de toasts:</p>
    <ul class="list-disc pl-6 text-sm">
      <li>
        Les toasts avec un délai personnalisé devraient s'auto-fermer après le
        temps spécifié
      </li>
      <li>
        Les toasts sans délai personnalisé (sauf success/info) ne devraient pas
        s'auto-fermer
      </li>
    </ul>
  </div>

  <div class="flex flex-wrap gap-2">
    <button class="btn btn-primary" onclick={testAllToasts}>
      Tester tous les types de toasts
    </button>

    <button class="btn btn-secondary" onclick={testAsyncOperation}>
      Tester l'opération asynchrone
    </button>

    <button class="btn btn-ghost" onclick={() => toastService.dismissAll()}>
      Fermer tous les toasts
    </button>
  </div>

  <div class="bg-base-200 rounded-lg p-4">
    <h3 class="mb-2 font-bold">Toasts actifs:</h3>
    <div class="space-y-1 text-sm">
      {#each toastService.toasts as toast (toast.id)}
        <div class="bg-base-100 flex items-center justify-between rounded p-2">
          <span>
            {toast.state}: {toast.message}
            {toast.autoCloseDelay && `(ferme après ${toast.autoCloseDelay}ms)`}
          </span>
          <button
            class="btn btn-xs btn-ghost"
            onclick={() => toastService.dismiss(toast.id)}
          >
            Fermer
          </button>
        </div>
      {/each}
      {#if toastService.toasts.length === 0}
        <p class="text-base-content/60">Aucun toast actif</p>
      {/if}
    </div>
  </div>
</div>
