<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Plus, Package, LoaderCircle, Users } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { route } from "$lib/router";
  import MaterielCard from "$lib/components/teamMatos/MaterielCard.svelte";
  import MaterielForm from "$lib/components/teamMatos/MaterielForm.svelte";
  import EditMaterielModal from "$lib/components/teamMatos/EditMaterielModal.svelte";
  import MaterielFilters, {
    type MaterielFiltersType,
  } from "$lib/components/teamMatos/MaterielFilters.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import { fade, slide } from "svelte/transition";
  import { navigate } from "$lib/router";
  import type { EnrichedMateriel } from "$lib/types/materiel.types";

  // État de la page
  let showForm = $state(false);
  let createModalOpen = $state(false);
  let editModalMaterielId = $state<string | null>(null);
  let activeTeamId = $state<string | null>(null);
  let isRedirecting = $state(false);

  // État des filtres (sans loanStatus)
  let filters = $state<Omit<MaterielFiltersType, "loanStatus">>({
    types: [],
    locations: [],
    statuses: [],
  });

  // Basculer l'affichage du formulaire
  function toggleForm() {
    showForm = !showForm;
  }

  function closeForm() {
    showForm = false;
  }

  // Ouvrir le modal d'édition
  function openEditModal(materielId: string) {
    editModalMaterielId = materielId;
  }

  // Fermer le modal d'édition
  function closeEditModal() {
    editModalMaterielId = null;
  }

  // Gestion de la soumission du formulaire
  async function handleMaterielSubmit(data: any) {
    try {
      await materielStore.createMateriel(data);
      closeForm();
      console.log("[MaterielPage] Matériel créé avec succès");
    } catch (err) {
      console.error("[MaterielPage] Erreur création:", err);
    }
  }

  // Après édition
  function handleMaterielUpdated() {
    console.log("[MaterielPage] Matériel mis à jour");
    closeEditModal();
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
    activeTeamId ? userTeams.find((t) => t.$id === activeTeamId) : null,
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
      const team = userTeams.find((t) => t.$id === teamIdFromParams);
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
      navigate(`/dashboard/materiel/${userTeams[0].$id}`);
    }
  });

  // =============================================================================
  // NAVBAR CONFIGURATION
  // =============================================================================

  $effect(() => {
    const team = activeTeamId
      ? userTeams.find((t) => t.$id === activeTeamId)
      : null;
    const teamName = team?.name || "Matériel";

    navBarStore.setConfig({
      title: teamName,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });
</script>

<!-- Filtres - Sidebar Desktop / Drawer Mobile -->
<LeftPanel width="100">
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
<div class="p-4 lg:ml-100" transition:fade>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <!-- Tabs par équipe (seulement si plus d'une équipe) -->
    {#if userTeams.length > 1}
      <div class="tabs tabs-border bg-base-200 tabs-lg mb-6 font-semibold">
        {#each userTeams as team (team.$id)}
          <button
            class="tab {activeTeamId === team.$id ? 'tab-active' : ''}"
            onclick={() => switchTeam(team.$id)}
          >
            <Users class="mr-2 h-4 w-4" />
            {team.name}
            <span class="badge badge-sm badge-neutral ml-2">
              {materielStore.materiels.filter(
                (m) =>
                  m.ownerData.teamId === team.$id ||
                  m.shareableWith?.includes(team.$id),
              ).length}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Bouton dépliable pour ajouter du matériel -->
    {#if !showForm}
      <div class="mb-6 text-end">
        <button class="btn btn-wide btn-primary" onclick={toggleForm}>
          <Plus class="h-4 w-4" />
          Ajouter du matériel
        </button>
      </div>
    {/if}

    <!-- Formulaire déployable -->
    {#if showForm && activeTeam}
      <div class="card bg-base-100 mb-6 shadow-lg" transition:slide>
        <div class="card-body">
          <MaterielForm
            showStatus={false}
            onSubmit={handleMaterielSubmit}
            onCancel={closeForm}
            ownerId={activeTeam.$id}
            ownerName={activeTeam.name}
          />
        </div>
      </div>
    {/if}

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
          {#each filteredMateriels as materiel (materiel.$id)}
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

<EditMaterielModal
  materielId={editModalMaterielId}
  isOpen={editModalMaterielId !== null}
  onClose={closeEditModal}
  onSuccess={handleMaterielUpdated}
/>
