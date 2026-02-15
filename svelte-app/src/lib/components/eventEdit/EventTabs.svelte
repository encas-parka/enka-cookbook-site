<script lang="ts">
  import { route } from "$lib/router";

  // Props : eventId et basePath optionnel
  let {
    eventId,
    basePath = "/event",
  }: {
    eventId: string;
    basePath?: string;
  } = $props();

  // Configuration des onglets pour les pages d'événement
  // Les chemins relatifs seront combinés avec basePath + eventId
  const eventTabs = [
    { label: "Éditer l'événement", relativePath: "" },
    { label: "Voir les recettes", relativePath: "recipes" },
    { label: "Listes des produits", relativePath: "products" },
    { label: "Affiches", relativePath: "posters" },
  ];

  // Déterminer l'onglet actif depuis l'URL courante
  const activeTab = $derived.by(() => {
    const currentPath = route.pathname;

    // Pattern matching pour déterminer l'onglet basé sur le basePath
    // Routes: /event/:id, /event/:id/recipes, /event/:id/products, /event/:id/posters
    if (currentPath.includes(`/recipes`)) return 1;
    if (currentPath.includes(`/products`)) return 2;
    if (currentPath.includes(`/posters`)) return 3;
    // Par défaut, si on est sur {basePath}/{eventId} (sans sous-route)
    return 0; // Défaut
  });

  function getTabPath(index: number) {
    if (!eventId) return "#";

    const relativePath = eventTabs[index].relativePath;

    return relativePath
      ? `${basePath}/${eventId}/${relativePath}`
      : `${basePath}/${eventId}`;
  }
</script>

<div class="rounded-box bg-accent/10 px-4 py-0">
  <div class="tabs justify-center py-1">
    {#each eventTabs as tab, index (index)}
      <a
        class="tab rounded-box {index === activeTab
          ? 'text-base-content/80  bg-accent/30 font-bold'
          : 'text-accent  font-medium '}"
        href={getTabPath(index)}
      >
        {tab.label}
      </a>
    {/each}
  </div>
</div>
