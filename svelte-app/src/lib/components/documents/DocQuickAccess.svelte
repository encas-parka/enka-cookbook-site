<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { navigate } from '$lib/router';
  import {
    FileText,
    ArrowBigRight,
    Plus,
    FilePlus,
    AlertTriangle,
  } from "@lucide/svelte";
  import DocCard from "./DocCard.svelte";

  interface Props {
    teamId: string;
  }

  let { teamId }: Props = $props();

  // Récupérer les 5 derniers documents triés par updatedAt
  const latestDocs = $derived.by(() => {
    if (!teamdocsStore.isInitialized) {
      return [];
    }

    return teamdocsStore
      .getTeamDocuments(teamId)
      .sort((a, b) => {
        const dateA = a.$updatedAt ? new Date(a.$updatedAt).getTime() : 0;
        const dateB = b.$updatedAt ? new Date(b.$updatedAt).getTime() : 0;
        return dateB - dateA; // Plus récent d'abord
      })
      .slice(0, 5);
  });

  function viewAll() {
    navigate(`/documents/${teamId}`);
  }

  function createDocument() {
    navigate(`/createdocument/${teamId}/new`);
  }
</script>

<div class="card bg-base-100 card-sm border-neutral/20 border shadow-sm">
  <div class="card-body">
    <div class="flex flex-wrap items-center justify-between">
      <h2 class="card-title flex items-center gap-2">
        <FileText class="text-primary h-5 w-5" />
        Documents récents
      </h2>
      <button
        class="btn btn-sm"
        onclick={viewAll}
        title="Voir tous les documents"
      >
        Voir tout
        <ArrowBigRight size={16} />
      </button>
    </div>

    {#if teamdocsStore.loading}
      <div class="py-6 text-center">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="text-base-content/60 mt-2 text-sm">Chargement...</p>
      </div>
    {:else if teamdocsStore.error}
      <div class="py-6 text-center">
        <div class="text-error mb-2">
          <AlertTriangle class="mx-auto h-8 w-8" />
        </div>
        <p class="text-base-content/60 text-sm">
          Erreur de chargement des documents
        </p>
      </div>
    {:else if latestDocs.length === 0}
      <div class="py-6 text-center">
        <FilePlus size={32} class="text-base-content/20 mx-auto mb-3" />
        <p class="text-base-content/60 mb-4 text-sm">Aucun document</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each latestDocs as doc (doc.$id)}
          <DocCard {doc} {teamId} />
        {/each}
      </div>
    {/if}
    <!-- Bouton Créer -->
    <div class="card-actions mt-4 justify-end pt-4">
      <button class="btn btn-primary btn-soft btn-sm" onclick={createDocument}>
        <Plus class="h-4 w-4" />
        Créer un document
      </button>
    </div>
  </div>
</div>
