<script lang="ts">
  import { onMount } from "svelte";
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { p } from "$lib/router";
  import {
    FileText,
    ArrowBigRight,
    Plus,
    FilePlus,
    AlertTriangle,
    ArrowRight,
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
        const dateA = a.updated ? new Date(a.updated).getTime() : 0;
        const dateB = b.updated ? new Date(b.updated).getTime() : 0;
        return dateB - dateA; // Plus récent d'abord
      })
      .slice(0, 5);
  });

  // Initialiser le store si nécessaire
  onMount(async () => {
    if (!teamdocsStore.isInitialized) {
      await teamdocsStore.initialize();
    }
  });
</script>

<div class="card border border-neutral/20 bg-base-100 shadow-sm card-sm">
  <div class="card-body">
    <div class="flex flex-wrap items-center justify-between">
      <h2 class="card-title flex items-center gap-2">
        <FileText class="h-5 w-5 text-primary" />
        Documents récents
      </h2>
      <a
        class="btn btn-link btn-sm"
        href={p(`/documents/${teamId}`)}
        title="Voir tous les documents"
      >
        Voir tout
        <ArrowRight class="size-4" />
      </a>
    </div>

    {#if teamdocsStore.loading}
      <div class="py-6 text-center">
        <span class="loading loading-md loading-spinner text-primary"></span>
        <p class="mt-2 text-sm text-base-content/60">Chargement...</p>
      </div>
    {:else if teamdocsStore.error}
      <div class="py-6 text-center">
        <div class="mb-2 text-error">
          <AlertTriangle class="mx-auto h-8 w-8" />
        </div>
        <p class="text-sm text-base-content/60">
          Erreur de chargement des documents
        </p>
      </div>
    {:else if latestDocs.length === 0}
      <div class="py-6 text-center">
        <FilePlus size={32} class="mx-auto mb-3 text-base-content/20" />
        <p class="mb-4 text-sm text-base-content/60">Aucun document</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each latestDocs as doc (doc.id)}
          <DocCard {doc} {teamId} />
        {/each}
      </div>
    {/if}
    <!-- Bouton Créer -->
    <div class="mt-4 card-actions justify-end pt-4">
      <a
        class="btn btn-soft btn-primary sm:btn-sm"
        href={p(`/createdocument/${teamId}/new`)}
      >
        <Plus class="h-4 w-4" />
        Créer un document
      </a>
    </div>
  </div>
</div>
