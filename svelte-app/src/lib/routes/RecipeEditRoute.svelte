<script lang="ts">
  import { route } from "$lib/router";
  import RecipeEditPage from "./RecipeEditPage.svelte";

  // sv-router réutilise le composant entre deux urls du même motif : la page
  // suppose « un montage = une recette » (chargement, snapshot, verrou
  // recipe_*, heartbeat, gate). Remonter l'instance au changement d'id
  // restaure cette sémantique — onDestroy libère le verrou quitté, onMount
  // relit la nouvelle recette.
  const pageKey = $derived(route.params.uuid);
</script>

{#key pageKey}
  <RecipeEditPage />
{/key}
