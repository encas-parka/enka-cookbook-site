<script lang="ts">
  import { route } from "$lib/router";
  import EditDocumentPage from "./EditDocumentPage.svelte";

  // sv-router réutilise le composant entre deux urls du même motif : la page
  // suppose « un montage = un document » (chargement, snapshot, verrou doc_*,
  // heartbeat). Remonter l'instance au changement d'id restaure cette
  // sémantique — onDestroy libère le verrou quitté, onMount relit le nouveau.
  const pageKey = $derived(`${route.params.teamId}/${route.params.docId}`);
</script>

{#key pageKey}
  <EditDocumentPage />
{/key}
