<script lang="ts">
  import { route } from "$lib/router";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";

  // Props : teamId optionnel pour la page matériel
  interface Props {
    currentTeamId?: string;
  }

  let { currentTeamId }: Props = $props();

  // Configuration des onglets
  const tabs = [
    { label: "Matériel", getPath: () => getMaterielPath() },
    { label: "Reservations", getPath: () => getLoansPath() },
  ];

  // Déterminer l'onglet actif depuis l'URL courante
  const activeTab = $derived.by(() => {
    const currentPath = route.pathname;

    // Si on est sur /dashboard/loans
    if (currentPath.includes("/loans")) return 1;

    // Sinon, on est sur Materiel
    return 0;
  });

  // Obtenir le chemin pour la page matériel
  function getMaterielPath(): string {
    // Si un teamId est fourni, l'utiliser
    if (currentTeamId) {
      return `/dashboard/materiel/${currentTeamId}`;
    }

    // Sinon, prendre la première équipe de l'utilisateur
    const myTeams = teamsStore.myTeams;
    if (myTeams.length > 0) {
      return `/dashboard/materiel/${myTeams[0].$id}`;
    }

    // Fallback (ne devrait pas arriver si l'utilisateur a des équipes)
    return "/dashboard/materiel";
  }

  // Obtenir le chemin pour la page emprunts
  function getLoansPath(): string {
    // Si un teamId est fourni, l'utiliser
    if (currentTeamId) {
      return `/dashboard/loans/${currentTeamId}`;
    }

    // Sinon, prendre la première équipe de l'utilisateur
    const myTeams = teamsStore.myTeams;
    if (myTeams.length > 0) {
      return `/dashboard/loans/${myTeams[0].$id}`;
    }

    // Fallback
    return "/dashboard/loans";
  }
</script>

<div class="tabs sm:tabs-lg tabs-border justify-center">
  {#each tabs as tab, index (index)}
    <a
      class="tab font-medium {index === activeTab ? 'tab-active' : ''}"
      href={tab.getPath()}
    >
      {tab.label}
    </a>
  {/each}
</div>
