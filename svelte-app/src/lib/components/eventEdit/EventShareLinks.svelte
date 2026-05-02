<script lang="ts">
  import { onMount } from "svelte";
  import { Shield, Link as LinkIcon, Copy, Plus } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import {
    createShareLink,
    getEventShareLinks,
  } from "$lib/services/pb-invitations";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";

  let { eventId } = $props<{ eventId: string }>();

  let isGenerating = $state(false);
  let shareLinkIds = $state<string[]>([]);

  async function loadShareLinks() {
    if (!eventId) return;
    try {
      shareLinkIds = await getEventShareLinks(eventId);
    } catch {
      shareLinkIds = [];
    }
  }

  onMount(() => {
    loadShareLinks();
  });

  async function handleGenerateLink() {
    if (!globalState.userId || !eventId) return;
    try {
      isGenerating = true;
      await createShareLink(eventId, globalState.userId);
      toastService.success("Lien généré avec succès !");
      await loadShareLinks();
    } catch (e: any) {
      toastService.error(e.message || "Erreur lors de la génération du lien");
    } finally {
      isGenerating = false;
    }
  }

  function copyToClipboard(linkId: string) {
    const url = `${window.location.origin}/join/${linkId}`;
    navigator.clipboard.writeText(url).then(() => {
      toastService.success("Lien copié dans le presse-papier !");
    });
  }
</script>

<Fieldset legend="Lien de partage" iconComponent={LinkIcon}>
  <div class="space-y-4">
    <div class="text-base-content/70 flex gap-2 text-sm">
      <Shield class="text-info h-5 w-5 shrink-0" />
      <p>
        Les liens magiques permettent à n'importe qui d'accéder à l'événement en
        un clic. Partagez-les uniquement avec les personnes de confiance.
      </p>
    </div>

    <!-- Liste des liens déjà générés -->
    {#if shareLinkIds.length > 0}
      <div class="space-y-2">
        {#each shareLinkIds as linkId, i}
          <div
            class="bg-base-200 flex items-center justify-between gap-2 rounded-md p-2"
          >
            <div
              class="text-base-content/80 flex-1 overflow-auto font-mono text-xs"
            >
              {window.location.origin}/join/{linkId}
            </div>
            <button
              class="btn btn-ghost btn-xs text-primary"
              aria-label="Copier"
              title="Copier le lien"
              onclick={() => copyToClipboard(linkId)}
            >
              <Copy class="h-4 w-4" />
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-base-content/50 py-2 text-sm italic">
        Aucun lien de partage généré pour le moment.
      </p>
    {/if}

    <button
      class="btn btn-outline btn-sm btn-primary w-full"
      onclick={handleGenerateLink}
      disabled={isGenerating}
    >
      {#if isGenerating}
        <span class="loading loading-spinner loading-xs hidden md:inline-block"
        ></span>
        Génération...
      {:else}
        <Plus class="mr-1 hidden h-4 w-4 md:inline-block" />
        Nouveau lien de partage
      {/if}
    </button>
  </div>
</Fieldset>
