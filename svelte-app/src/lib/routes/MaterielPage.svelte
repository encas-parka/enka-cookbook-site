<script lang="ts">
  import MaterielCard from "$lib/components/teamMatos/MaterielCard.svelte";
  import MaterielFilters, {
    type MaterielFiltersType,
  } from "$lib/components/teamMatos/MaterielFilters.svelte";
  import MaterielModal from "$lib/components/teamMatos/MaterielModal.svelte";
  import QuickAddCatalogModal from "$lib/components/teamMatos/QuickAddCatalogModal.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import { navigate, route } from "$lib/router";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { ListPlus, Package, Plus } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { navBarStore } from "../stores/NavBarStore.svelte";

  // État de la page
  let materielModalOpen = $state(false);
  let materielModalEditId = $state<string | null>(null);
  let catalogModalOpen = $state(false);
  let activeTeamId = $state<string | null>(null);
  let isRedirecting = $state(false);

  let filters = $state<Omit<MaterielFiltersType, "loanStatus">>({
    types: [],
    locations: [],
    statuses: [],
  });

  function openCreateModal() {
    materielModalEditId = null;
    materielModalOpen = true;
  }

  function openEditModal(materielId: string) {
    materielModalEditId = materielId;
    materielModalOpen = true;
  }

  function closeMaterielModal() {
    materielModalOpen = false;
    materielModalEditId = null;
  }

  // Types disponibles
  const availableTypes = [
    "electronic",
    "manual",
    "other",
    "tools",
    "dish",
    "cooking",
    "gaz",
    "hygiene",
  ];

  // Statuts disponibles
  const availableStatuses = ["ok", "lost", "loan", "reserved", "torepair"];

  // Équipes de l'utilisateur
  const userTeams = $derived(nativeTeamsStore.myTeams);

  // Équipe active
  const activeTeam = $derived(
    activeTeamId ? userTeams.find((t) => t.id === activeTeamId) : null,
  );

  // Matériel filtré pour l'équipe active
  const teamMateriels = $derived.by(() => {
    if (!activeTeamId) return [];
    return materielStore.materiels.filter((m) => {
      // Vérifier si le matériel appartient à l'équipe
      const ownerData = m.ownerData;
      return (
        ownerData.teamId === activeTeamId ||
        m.shareableWith?.includes(activeTeamId!)
      );
    });
  });

  // Localisations uniques (dérivées du matériel de l'équipe)
  const availableLocations = $derived.by(() => {
    const materiels = teamMateriels;
    const locations = new Set<string>();
    materiels.forEach((m) => {
      if (m.location) locations.add(m.location);
    });
    return Array.from(locations).sort();
  });

  // Liste des matériels filtrés
  const filteredMateriels = $derived.by(() => {
    const materiels = teamMateriels;

    const hasActiveFilters =
      filters.types.length > 0 ||
      filters.locations.length > 0 ||
      filters.statuses.length > 0;

    if (!hasActiveFilters) return materiels;

    return materiels.filter((materiel) => {
      // Type (OU logique)
      const typeMatch =
        filters.types.length === 0 ||
        (materiel.type && filters.types.includes(materiel.type));

      // Localisation (OU logique)
      const locationMatch =
        filters.locations.length === 0 ||
        (materiel.location && filters.locations.includes(materiel.location));

      // Statut (OU logique)
      const statusMatch =
        filters.statuses.length === 0 ||
        filters.statuses.includes(materiel.status);

      return typeMatch && locationMatch && statusMatch;
    });
  });

  // Fonction reset des filtres
  function resetFilters() {
    filters = {
      types: [],
      locations: [],
      statuses: [],
    };
  }

  // Changer d'équipe
  function switchTeam(teamId: string) {
    navigate(`/dashboard/materiel/${teamId}`);
  }

  // Surveiller les changements de teamId dans l'URL pour mettre à jour activeTeamId
  $effect(() => {
    const teamIdFromParams = route.params.teamId;

    if (teamIdFromParams && teamIdFromParams !== activeTeamId) {
      // Vérifier que l'utilisateur appartient à cette équipe
      const team = userTeams.find((t) => t.id === teamIdFromParams);
      if (team) {
        activeTeamId = teamIdFromParams;
      }
    } else if (
      !teamIdFromParams &&
      !activeTeamId &&
      !isRedirecting &&
      userTeams.length > 0
    ) {
      // Premier chargement sans teamId : rediriger vers la première équipe
      isRedirecting = true;
      navigate(`/dashboard/materiel/${userTeams[0].id}`);
    }
  });

  // =============================================================================
  // NAVBAR CONFIGURATION
  // =============================================================================

  $effect(() => {
    const team = activeTeamId
      ? userTeams.find((t) => t.id === activeTeamId)
      : null;
    const teamName = team?.name || "Matériel";

    navBarStore.setConfig({
      title: teamName,
    });
  });
</script>

<!-- Filtres - Sidebar Desktop / Drawer Mobile -->
<LeftPanel>
  <MaterielFilters
    bind:filters
    disabled={false}
    {availableTypes}
    {availableLocations}
    {availableStatuses}
    onReset={resetFilters}
  />
</LeftPanel>

<!-- Contenu principal -->
<div class="p-4 pb-20 lg:ml-96" transition:fade>
  <div class="mx-auto max-w-7xl sm:px-4 sm:py-8">
    <!-- Tabs Inventaire / Réservation -->
    <div class="tabs tabs-border bg-base-200 sm:tabs-lg mb-6 font-semibold">
      <button class="tab tab-active"> Inventaire </button>
      <button
        class="tab"
        onclick={() => navigate(`/dashboard/loans/${activeTeamId}`)}
        disabled={!activeTeamId}
      >
        Réservation
      </button>
    </div>

    <div class="mb-6 flex justify-end gap-2">
      <button
        class="btn btn-sm btn-outline btn-primary"
        onclick={() => (catalogModalOpen = true)}
      >
        <ListPlus class="h-4 w-4" />
        Catalogue
      </button>
      <button class="btn btn-sm btn-primary" onclick={openCreateModal}>
        <Plus class="h-4 w-4" />
        Ajouter
      </button>
    </div>

    <!-- Contenu -->
    {#if !globalState.isAuthenticated}
      <div class="alert alert-warning">
        <span>Vous devez être connecté pour voir le matériel.</span>
      </div>
    {:else if materielStore.error}
      <div class="alert alert-error shadow-lg">
        <span>{materielStore.error}</span>
      </div>
    {:else if !activeTeamId}
      <div class="alert alert-info">
        <span>Sélectionnez une équipe pour voir son matériel.</span>
      </div>
    {:else}
      <!-- Liste du matériel -->
      {#if filteredMateriels.length === 0}
        <!-- Vérifier si c'est à cause des filtres ou vraiment vide -->
        {#if filters.types.length > 0 || filters.locations.length > 0 || filters.statuses.length > 0}
          <!-- Aucun résultat avec les filtres -->
          <div class="py-12 text-center">
            <p class="text-base-content/60 mb-4 text-lg">
              Aucun matériel ne correspond aux critères de filtrage...
            </p>
            <button class="btn btn-warning btn-sm" onclick={resetFilters}>
              Effacer les filtres
            </button>
          </div>
        {:else}
          <!-- Empty state -->
          <div
            class="bg-base-200 rounded-box border-base-200 border-2 border-dashed py-20 text-center"
          >
            <div class="bg-base-200 mb-4 inline-block rounded-full p-4">
              <Package class="h-8 w-8 opacity-50" />
            </div>
            <h3 class="mb-2 text-lg font-bold">Aucun matériel</h3>
            <p class="text-base-content/60 mb-6">
              Cette équipe n'a pas encore de matériel.
            </p>
          </div>
        {/if}
      {:else}
        <!-- Grille de matériel -->
        <div class="grid grid-cols-1">
          {#each filteredMateriels as materiel (materiel.id)}
            <MaterielCard
              {materiel}
              onEdit={(materielId) => openEditModal(materielId)}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if activeTeam}
  <MaterielModal
    isOpen={materielModalOpen}
    onClose={closeMaterielModal}
    teamId={activeTeam.id}
    teamName={activeTeam.name}
    {availableLocations}
    materielId={materielModalEditId}
  />
  <QuickAddCatalogModal
    isOpen={catalogModalOpen}
    onClose={() => (catalogModalOpen = false)}
    teamId={activeTeam.id}
    teamName={activeTeam.name}
  />
{/if}
