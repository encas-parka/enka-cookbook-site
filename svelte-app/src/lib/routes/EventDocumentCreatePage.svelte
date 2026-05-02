<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { fade } from "svelte/transition";
  import { Save } from "@lucide/svelte";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { route, searchParams } from "$lib/router";

  let eventId = $derived(route.params.id || "");

  // État local
  let title = $state("");
  let content = $state("");
  let isSaving = $state(false);

  // Tags prédéfinis pour lier aux pages d'événement
  const PREDEFINED_TAGS = ["produit", "recette", "tache", "materiel"] as const;
  const TAG_LABELS: Record<string, string> = {
    produit: "Produits",
    recette: "Recettes",
    tache: "Tâches",
    materiel: "Matériel",
  };

  // Tags sélectionnés
  let selectedTags = $state<string[]>([]);

  // Pré-cocher le tag depuis query param
  $effect(() => {
    const tagParam = searchParams.get("tag");
    if (tagParam && PREDEFINED_TAGS.includes(tagParam as typeof PREDEFINED_TAGS[number])) {
      if (!selectedTags.includes(tagParam)) {
        selectedTags = [...selectedTags, tagParam];
      }
    }
  });

  // Événement
  const currentEvent = $derived(eventsStore.getEventById(eventId));

  // Validation
  const isValid = $derived(title.trim().length > 0);

  // Détection modifications
  const hasUnsavedChanges = $derived(
    !isSaving && (title.trim().length > 0 || content.trim().length > 0 || selectedTags.length > 0),
  );

  // Navbar
  $effect(() => {
    navBarStore.setConfig({
      title: `Nouveau document - ${currentEvent?.name || "Événement"}`,
      actions: navActions,
    });
  });

  // Vérification
  $effect(() => {
    if (!globalState.userId) {
      toastService.error("Vous devez être connecté");
      navigate("/");
    }
    if (!teamdocsStore.isInitialized) {
      teamdocsStore.initialize();
    }
  });

  // Création
  async function handleCreate() {
    if (!isValid || isSaving) return;
    isSaving = true;
    try {
      const doc = await teamdocsStore.createEventDocument(
        {
          title: title.trim(),
          content,
          tags: [...selectedTags],
        },
        eventId,
      );
      toastService.success("Document créé avec succès");
      navigate(`/event/${eventId}/document/${doc.id}/edit`);
    } catch (error) {
      console.error("[EventDocumentCreatePage] Erreur:", error);
      toastService.error("Erreur lors de la création du document");
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleCreate();
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#snippet navActions()}
  <button
    class="btn btn-primary btn-sm"
    onclick={handleCreate}
    disabled={!isValid || isSaving}
  >
    {#if isSaving}
      <span class="loading loading-spinner loading-sm"></span>
    {:else}
      <Save class="h-4 w-4" />
    {/if}
    <span class="hidden sm:inline">Créer</span>
  </button>
{/snippet}

<UnsavedChangesGuard
  routeKey="create-event-document"
  shouldProtect={() => hasUnsavedChanges}
  message="Vous avez commencé à créer un document. Voulez-vous quitter sans sauvegarder ?"
/>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bg-base-200 min-h-lvh px-4 pt-4 pb-20 md:px-20"
  onkeydown={handleKeydown}
  role="region"
  tabindex="-1"
  transition:fade
>
  <div class="mx-auto mt-6 max-w-5xl">
    <div class="space-y-4">
<fieldset class="fieldset flex">
          <label class="input input-lg w-full">
            <span class="label">Nom</span>
            <input
              type="text"
              bind:value={title}
              placeholder="Titre du document"
              disabled={isSaving}
              maxlength="50"
              required
            />
          </label>
        </fieldset>

        <!-- Sélecteur de tags -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Lier aux pages</legend>
          <div class="flex flex-wrap gap-2">
            {#each PREDEFINED_TAGS as tag}
              <button
                type="button"
                class="btn btn-sm {selectedTags.includes(tag)
                  ? 'btn-primary'
                  : 'btn-outline'}"
                onclick={() => {
                  if (selectedTags.includes(tag)) {
                    selectedTags = selectedTags.filter((t) => t !== tag);
                  } else {
                    selectedTags = [...selectedTags, tag];
                  }
                }}
              >
                {TAG_LABELS[tag]}
              </button>
            {/each}
          </div>
          <p class="text-base-content/60 text-xs">
            Sélectionnez les pages où ce document apparaîtra
          </p>
        </fieldset>

      <fieldset class="fieldset">
        <MarkdownEditorAdvanced
          bind:value={content}
          placeholder="Commencez à rédiger votre document..."
        />
      </fieldset>
    </div>
  </div>

  <!-- Bouton flottant Créer (mobile uniquement) -->
  {#if hasUnsavedChanges && !isSaving}
    <button
      class="btn btn-primary btn-sm sticky bottom-2 shadow-lg {!globalState.isMobile &&
        'hidden'}"
      onclick={handleCreate}
      disabled={!isValid || isSaving}
    >
      <Save size={16} class="mr-1" />
      Créer
    </button>
  {/if}
</div>

<style>
  :global(.dropdown-content) {
    z-index: 9999;
  }
</style>
