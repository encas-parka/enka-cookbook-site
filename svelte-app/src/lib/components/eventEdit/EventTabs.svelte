<script lang="ts">
  import { navigate, route } from "$lib/router";

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

  function navigateToTab(index: number) {
    if (!eventId) return;

    const relativePath = eventTabs[index].relativePath;

    const fullPath = relativePath
      ? `${basePath}/${eventId}/${relativePath}`
      : `${basePath}/${eventId}`;

    navigate(fullPath);
  }
</script>

<div class="rounded-box bg-secondary/10 px-4 py-1">
  <div class="tabs tabs-border justify-center">
    {#each eventTabs as tab, index (index)}
      <button
        class="tab font-semibold {index === activeTab ? 'tab-active' : ''}"
        onclick={() => navigateToTab(index)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
</div>
