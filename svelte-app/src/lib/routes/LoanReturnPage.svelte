<script lang="ts">
  /**
   * Url historique « fiche de retour » : la fiche vit désormais dans le
   * dossier emprunt (onglet Retour) — cette page ne fait que rediriger.
   */
  import { LoaderCircle } from "@lucide/svelte";
  import { navigate, navigateTo, route } from "$lib/router";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";

  const loanId = $derived(route.params.loanId);

  let redirected = $state(false);
  /** Délai dépassé sans emprunt en store : l'emprunt n'existe pas. */
  let missing = $state(false);

  $effect(() => {
    if (!loanId || redirected) return;
    const loan = materielStore.getLoanById(loanId);
    if (!loan) return;
    redirected = true;
    navigateTo(`/dashboard/loans/${loan.ownerId}/loan/${loan.id}`, {
      search: { tab: "return" },
    });
  });

  // Le store peut être en retard sur une url profonde : on patiente avant de
  // conclure à l'absence.
  $effect(() => {
    if (!loanId || redirected || materielStore.getLoanById(loanId)) return;
    const timer = setTimeout(() => (missing = true), 2000);
    return () => clearTimeout(timer);
  });

  function goBack() {
    navigate("/dashboard/loans");
  }
</script>

<div class="flex items-center justify-center py-12">
  {#if missing}
    <div class="alert alert-warning">
      <span>Emprunt introuvable.</span>
      <button class="btn btn-sm" onclick={goBack}>Retour</button>
    </div>
  {:else}
    <LoaderCircle class="h-10 w-10 animate-spin text-primary" />
  {/if}
</div>
