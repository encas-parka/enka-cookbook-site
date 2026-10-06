<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { fade } from "svelte/transition";
  import { Save } from "@lucide/svelte";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { online } from "svelte/reactivity/window";

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
  let isSaving = $state(false);

  // Équipe
  let team = $derived(nativeTeamsStore.myTeams.find((t) => t.id === teamId));

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const canEdit = $derived(online.current && !isSaving);

  // Validation
  const isValid = $derived(title.trim().length > 0 && team !== undefined);

  // Détection des modifications non sauvegardées
  // Retourne false pendant la sauvegarde pour autoriser la navigation
  const hasUnsavedChanges = $derived(
    !isSaving && (title.trim().length > 0 || content.trim().length > 0),
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

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Crée le document
   */
  async function handleCreate() {
    if (!isValid || isSaving || !team || !teamId) return;

    isSaving = true;

    try {
      const doc = await teamdocsStore.createDocument(
        {
          title: title.trim(),
          content,
          status: "doc",
        },
        teamId,
      );

      toastService.success("Document créé avec succès");

      // Rediriger vers la page d'édition
      navigate(`/editdocument/${teamId}/${doc.id}`);
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
      <span class="hidden sm:inline">Créer</span>
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

    <!-- Bouton flottant Créer (mobile uniquement) -->
    {#if hasUnsavedChanges && !isSaving}
      <button
        class="btn btn-primary btn-sm sticky bottom-2 shadow-lg {!globalState.isMobile &&
          'hidden'}"
        onclick={handleCreate}
        disabled={!canEdit || !isValid || isSaving}
      >
        <Save size={16} class="mr-1" />
        Créer
      </button>
    {/if}
  </div>
</div>

<style>
  /* Assurer que le dropdown du heading est bien au-dessus */
  :global(.dropdown-content) {
    z-index: 9999;
  }
</style>
