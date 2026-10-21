<script lang="ts">
  import { route } from "$lib/router";
  import EventDocumentEditPage from "./EventDocumentEditPage.svelte";

  // sv-router réutilise le composant entre deux urls du même motif : la page
  // suppose « un montage = un document » (chargement, snapshot, verrou doc_*,
  // heartbeat). Remonter l'instance au changement d'id restaure cette
  // sémantique — onDestroy libère le verrou quitté, onMount relit le nouveau.
  // L'event fait partie de la clé : deux events peuvent porter des docIds
  // voisins et le draft ne doit jamais traverser.
  const pageKey = $derived(`${route.params.id}/${route.params.docId}`);
</script>

{#key pageKey}
  <EventDocumentEditPage />
{/key}
