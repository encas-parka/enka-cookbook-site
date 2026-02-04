<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { Save, X, PlusIcon } from "@lucide/svelte";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import BtnGroupCheck from "$lib/components/ui/BtnGroupCheck.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";

  // ============================================================================
  // PROPS & ROUTE
  // ============================================================================

  import { route } from "$lib/router";

  let teamId = $derived(route.params.teamId);

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let title = $state("");
  let content = $state("");
  let tags = $state<string[]>([]);
  let newTag = $state("");
  let isPublic = $state(false);
  let isSaving = $state(false);

  // Équipe
  let team = $derived(nativeTeamsStore.myTeams.find((t) => t.$id === teamId));

  // Tags disponibles depuis le store + tags ajoutés par l'utilisateur
  let availableTags = $derived.by(() => {
    const teamTags = teamdocsStore.getTeamTags(teamId);
    const allTags = new Set([...teamTags, ...tags]);

    return Array.from(allTags).map((tag) => ({
      id: tag,
      label: tag,
      selected: tags.includes(tag),
    }));
  });

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const canEdit = $derived(!isSaving);

  // Validation
  const isValid = $derived(title.trim().length > 0 && team !== undefined);

  // Détection des modifications non sauvegardées
  const hasUnsavedChanges = $derived(
    title.trim().length > 0 || content.trim().length > 0 || tags.length > 0,
  );

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  // Vérifier que l'utilisateur est connecté et que l'équipe existe
  $effect(() => {
    if (!globalState.userId) {
      toastService.error("Vous devez être connecté");
      navigate("/");
      return;
    }

    if (!team) {
      toastService.error("Équipe introuvable");
      navigate("/");
      return;
    }

    // Initialiser le store si nécessaire
    if (!teamdocsStore.isInitialized) {
      teamdocsStore.initialize();
    }
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  const navTitle = $derived(`Nouveau document - ${team?.name} `);

  $effect(() => {
    navBarStore.setConfig({
      title: navTitle,
      actions: navActions,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Ajoute un nouveau tag
   */
  function addTag() {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      tags = [...tags, trimmedTag];
      newTag = "";
    }
  }

  /**
   * Ajoute un tag avec la touche Entrée
   */
  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  /**
   * Bascule un tag via BtnGroupCheck
   */
  function toggleTag(tagId: string) {
    if (tags.includes(tagId)) {
      tags = tags.filter((t) => t !== tagId);
    } else {
      tags = [...tags, tagId];
    }
  }

  /**
   * Crée le document
   */
  async function handleCreate() {
    if (!isValid || isSaving || !team) return;

    isSaving = true;

    try {
      const doc = await teamdocsStore.createDocument(
        {
          title: title.trim(),
          content,
          tags: tags.length > 0 ? tags : null,
          isPublic,
          teamName: team.name,
          status: "doc",
        },
        teamId,
      );

      toastService.success("Document créé avec succès");

      // Rediriger vers la page d'édition
      navigate(`/editdocument/${teamId}/${doc.$id}`);
    } catch (error) {
      console.error("[CreateDocumentPage] Erreur création document:", error);
      toastService.error("Erreur lors de la création du document");
    } finally {
      isSaving = false;
    }
  }

  /**
   * Gestion du raccourci clavier pour sauvegarder
   */
  function handleKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd + S pour sauvegarder
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleCreate();
    }
  }

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Enregistrer le gestionnaire de clavier
  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<!-- ============================================================================ -->
{#snippet navActions()}
  <div class="flex items-center gap-2">
    <!-- Create button -->
    <button
      class="btn btn-primary btn-sm"
      onclick={handleCreate}
      disabled={!canEdit || !isValid || isSaving}
    >
      {#if isSaving}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <Save class="h-4 w-4" />
      {/if}
      Créer
    </button>
  </div>
{/snippet}

<!-- Guard de protection contre les modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey="create-document"
  shouldProtect={() => hasUnsavedChanges}
  message="Vous avez commencé à créer un document. Voulez-vous quitter sans sauvegarder ?"
/>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="mx-auto max-w-5xl p-4"
  onkeydown={handleKeydown}
  role="region"
  tabindex="-1"
  transition:fade
>
  <!-- Formulaire -->
  <div class="space-y-4">
    <!-- Titre -->
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

    <!-- Contenu -->
    <fieldset class="fieldset">
      <MarkdownEditorAdvanced
        bind:value={content}
        placeholder="Commencez à rédiger votre document..."
      />
    </fieldset>

    <!-- Tags -->
    <fieldset class="fieldset">
      <legend class="fieldset-legend">Tags</legend>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        {#if availableTags.length > 0}
          <div class="">
            <BtnGroupCheck
              items={availableTags}
              onToggleItem={(tagId) => toggleTag(tagId)}
              size="md"
              showStats={false}
            />
          </div>
        {/if}
        <label class="input w-80">
          <input
            type="text"
            bind:value={newTag}
            placeholder="Nouveau tag..."
            onkeydown={handleTagKeydown}
            disabled={isSaving}
            maxlength="30"
          />
          <button
            class="btn btn-primary btn-sm"
            onclick={addTag}
            disabled={isSaving || !newTag.trim()}
          >
            <PlusIcon class="h-4 w-4" />
            Ajouter
          </button>
        </label>
      </div>
    </fieldset>

    <!-- Visibilité -->
    <!-- <fieldset class="fieldset">
      <legend class="fieldset-legend">Visibilité</legend>
      <label class="label cursor-pointer justify-start gap-4">
        <input
          type="checkbox"
          class="checkbox checkbox-primary"
          bind:checked={isPublic}
          disabled={isSaving}
        />
        <div class="flex flex-col">
          <span class="font-semibold"> Document public </span>
          <span class="text-xs text-wrap">
            Cochez pour rendre ce document accessible à n'importe qui possédant
            l'url. Si non coché, seul les membres de l'équipe <span
              class="font-semibold">{team?.name}</span
            >
            peuvent consulter ce document.
          </span>
        </div>
      </label>
    </fieldset> -->
  </div>
</div>

<style>
  /* Assurer que le dropdown du heading est bien au-dessus */
  :global(.dropdown-content) {
    z-index: 9999;
  }
</style>
