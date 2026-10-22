<script lang="ts">
  import { route } from "$lib/router";
  import LoanEditPage from "./LoanEditPage.svelte";

  // sv-router réutilise le composant entre deux urls du même motif (liste
  // création `/new` → dossier d'un autre emprunt) : la page suppose
  // « un montage = un emprunt ». Remonter l'instance au changement
  // d'identité restaure cette sémantique (état local, onglets, formulaire).
  const pageKey = $derived(
    `${route.params.teamId}/${route.params.loanId ?? "new"}`,
  );
</script>

{#key pageKey}
  <LoanEditPage />
{/key}
