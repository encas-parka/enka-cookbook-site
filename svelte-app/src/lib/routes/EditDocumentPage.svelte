<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { onDestroy, onMount } from "svelte";
  import { Save, X, Lock, Eye, Edit3, Loader2, PlusIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import BtnGroupCheck from "$lib/components/ui/BtnGroupCheck.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import type { Teamdocs } from "$lib/types/appwrite.d";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";

  // ============================================================================
  // ROUTE PARAMETERS
  // ============================================================================

  import { route, searchParams } from "$lib/router";

  let teamId = $derived(route.params.teamId);
  let docId = $derived(route.params.docId);

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let document = $state<Teamdocs | null>(null);
  let title = $state("");
  let content = $state("");
  let tags = $state<string[]>([]);
  let newTag = $state("");
  let isPublic = $state(false);

  let isLoading = $state(true);
  let isSaving = $state(false);
  let lockedBy = $state<string | null>(null);
  let lockedByName = $state<string>("");
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let initialDocumentSnapshot = $state<string>("");

  // Mode édition ou preview - lu depuis les query params
  const mode = $derived(
    (searchParams.get("mode") as "edit" | "preview" | null) || "preview",
  );

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

  // Calcul de isDirty par comparaison avec le snapshot initial
  const isDirty = $derived.by(() => {
    const currentSnapshot = JSON.stringify({ title, content, tags, isPublic });
    return currentSnapshot !== initialDocumentSnapshot;
  });

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const isLockedByOthers = $derived(
    !!lockedBy && lockedBy !== globalState.userId,
  );
  const isLockedByMe = $derived(!!lockedBy && lockedBy === globalState.userId);
  const canEdit = $derived(!isLockedByOthers && !isLoading && !isSaving);

  // Validation
  const isValid = $derived(title.trim().length > 0 && team !== undefined);

  // ============================================================================
  // LOCK LIFECYCLE
  // ============================================================================

  /**
   * Acquiert le lock sur le document
   * Pattern RecipeEditPage : lock basé sur lockedBy + expiration $updatedAt
   */
  async function acquireLock(): Promise<boolean> {
    if (!docId || !globalState.userId || !document) return false;

    try {
      // Vérifier si le verrou actuel est expiré (plus de 5 minutes)
      const currentLockedBy = document.lockedBy;
      const lastUpdate = document.$updatedAt
        ? new Date(document.$updatedAt)
        : null;
      const isExpired =
        lastUpdate && Date.now() - lastUpdate.getTime() > 300000; // 5 min

      if (currentLockedBy && currentLockedBy !== globalState.userId) {
        if (isExpired) {
          console.log(
            "[EditDocumentPage] Verrou précédent expiré, reprise de contrôle...",
          );
        } else {
          lockedBy = currentLockedBy;
          console.warn("[EditDocumentPage] Document déjà verrouillé");
          return false;
        }
      }

      // Acquérir le lock
      await teamdocsStore.updateDocumentLock(docId, globalState.userId);
      lockedBy = globalState.userId;
      lockedByName = globalState.userName || "";
      startHeartbeat();
      console.log(`[EditDocumentPage] Lock acquis pour ${docId}`);
      return true;
    } catch (error) {
      console.error("[EditDocumentPage] Erreur acquisition lock:", error);
      toastService.error("Impossible de verrouiller le document");
      return false;
    }
  }

  /**
   * Démarre le heartbeat pour maintenir le lock
   */
  function startHeartbeat() {
    // Arrêter l'ancien heartbeat si exists
    stopHeartbeat();

    // Heartbeat toutes les 2 minutes
    heartbeatInterval = setInterval(async () => {
      if (lockedBy === globalState.userId && docId) {
        try {
          await teamdocsStore.updateDocumentLock(docId, globalState.userId);
          console.log(`[EditDocumentPage] Heartbeat envoyé pour ${docId}`);
        } catch (error) {
          console.error("[EditDocumentPage] Erreur heartbeat:", error);
        }
      }
    }, 120000); // 2 minutes
  }

  /**
   * Arrête le heartbeat
   */
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  /**
   * Libère le lock
   */
  async function releaseLock(): Promise<void> {
    if (!docId) return;

    stopHeartbeat();

    if (isLockedByMe) {
      try {
        await teamdocsStore.updateDocumentLock(docId, null);
        lockedBy = null;
        lockedByName = "";
        console.log(`[EditDocumentPage] Lock libéré pour ${docId}`);
      } catch (error) {
        console.error("[EditDocumentPage] Erreur libération lock:", error);
      }
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  // Charger le document et initialiser
  onMount(async () => {
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
      await teamdocsStore.initialize();
    }

    // Charger le document
    isLoading = true;
    try {
      const doc = teamdocsStore.getDocumentById(docId);

      if (!doc) {
        toastService.error("Document introuvable");
        navigate(`/teams/${teamId}`);
        return;
      }

      document = doc;
      title = doc.title || "";
      content = doc.content || "";
      tags = doc.tags || [];
      isPublic = doc.isPublic || false;

      // Créer le snapshot initial
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags,
        isPublic,
      });

      // Tenter d'acquérir le lock
      await acquireLock();
    } catch (error) {
      console.error("[EditDocumentPage] Erreur chargement document:", error);
      toastService.error("Erreur lors du chargement du document");
    } finally {
      isLoading = false;
    }
  });

  // Libérer le lock à la destruction
  onDestroy(async () => {
    await releaseLock();
  });

  // Guard avant de quitter
  $effect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && isLockedByMe) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
   * Sauvegarde le document
   */
  async function handleSave() {
    if (!isValid || isSaving || !document) return;

    isSaving = true;

    try {
      await teamdocsStore.updateDocument(docId, {
        title: title.trim(),
        content,
        tags: tags.length > 0 ? tags : null,
        isPublic,
      });

      // Mettre à jour le snapshot
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags,
        isPublic,
      });

      toastService.success("Document enregistré avec succès");
    } catch (error) {
      console.error("[EditDocumentPage] Erreur sauvegarde:", error);
      toastService.error("Erreur lors de la sauvegarde du document");
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
      handleSave();
    }
  }

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  const navTitle = $derived(
    document ? `Document: ${document.title}` : "Modifier le document",
  );

  $effect(() => {
    navBarStore.setConfig({
      title: navTitle,
      actions: navActions,
      isLockedByOthers: isLockedByOthers,
      lockedByUserName: lockedByName,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });

  // Enregistrer le gestionnaire de clavier
  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<!-- ============================================================================ -->
{#snippet navActions()}
  <div class="flex items-center gap-2">
    {#if isDirty}
      <!-- Save button -->
      <button
        class="btn btn-primary btn-sm"
        onclick={handleSave}
        disabled={!canEdit || !isValid || isSaving}
      >
        {#if isSaving}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Save class="h-4 w-4" />
        {/if}
        Enregistrer
      </button>
    {/if}
  </div>
{/snippet}

<!-- svelte-ignore /a11y_no_noninteractive_element_interactions  -->
<div
  class="mx-auto max-w-5xl p-4"
  onkeydown={handleKeydown}
  role="region"
  tabindex="-1"
  transition:fade
>
  <!-- Alertes -->
  {#if isLockedByOthers}
    <div class="alert alert-warning max-md:alert-vertical mb-4">
      <Lock class="h-5 w-5" />
      <div>
        <h4 class="font-bold">Document verrouillé</h4>
        <p class="text-sm">
          Ce document est actuellement édité par
          <span class="font-bold">{lockedByName || "un autre utilisateur"}</span
          >
          . Vous ne pouvez pas le modifier pour le moment.
        </p>
      </div>
    </div>
  {/if}

  <!-- Contenu principal -->
  {#if isLoading}
    <div class="flex justify-center py-20">
      <div class="loading loading-spinner loading-lg"></div>
    </div>
  {:else if document}
    <div class="space-y-4">
      {#if mode === "edit"}
        <!-- Titre -->
        <fieldset class="fieldset flex">
          <label class="input input-lg w-full">
            <span class="label">Nom</span>
            <input
              type="text"
              bind:value={title}
              placeholder="Titre du document"
              disabled={!canEdit}
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
                disabled={!canEdit}
                maxlength="30"
              />
              <button
                class="btn btn-primary btn-sm"
                onclick={addTag}
                disabled={!canEdit || !newTag.trim()}
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
              disabled={!canEdit}
            />
            <div class="flex flex-col">
              <span class="font-semibold"> Document public </span>
              <span class="text-xs text-wrap">
                Cochez pour rendre ce document accessible à n'importe qui
                possédant l'url. Si non coché, seul les membres de l'équipe <span
                  class="font-semibold">{team?.name}</span
                >
                peuvent consulter ce document.
              </span>
            </div>
          </label>
        </fieldset> -->
      {:else}
        <!-- Mode preview -->
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div class="flex-1">
            {#if isLoading}
              <div class="flex items-center gap-2">
                <Loader2 class="h-5 w-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            {:else if document}
              <div
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <h1 class="text-2xl font-bold">{title}</h1>
                <p class="text-sm opacity-70">
                  Équipe : <span class="font-medium">{team?.name}</span>
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                {#each tags as tag, index (index)}
                  <span class="badge badge-secondary badge-soft">#{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="prose bg-base-100 max-w-none rounded-lg p-6 shadow-lg">
          {#if content}
            <SvelteMarkdown source={content} />
          {:else}
            <p class="text-sm opacity-70">Aucun contenu</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Guard pour les modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey={`editdocument/${teamId}/${docId}`}
  shouldProtect={() => isDirty && isLockedByMe}
  onLeaveWithoutSave={() => {}}
  onSaveAndLeave={async () => {
    await handleSave();
    return true;
  }}
  message="Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?"
/>

<style>
  /* Assurer que le dropdown du heading est bien au-dessus */
  :global(.dropdown-content) {
    z-index: 9999;
  }

  /* Styles pour le markdown rendu */
  :global(.prose h1) {
    font-size: 1.875rem;
    font-weight: bold;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }
  :global(.prose h2) {
    font-size: 1.5rem;
    font-weight: bold;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  :global(.prose h3) {
    font-size: 1.25rem;
    font-weight: bold;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  :global(.prose p) {
    margin-bottom: 1.1rem;
  }
  :global(.prose ul) {
    list-style-type: disc;
    list-style-position: inside;
    margin-bottom: 1rem;
  }
  :global(.prose ol) {
    list-style-type: decimal;
    list-style-position: inside;
    margin-bottom: 1rem;
  }
  :global(.prose mark) {
    background-color: #fef08a;
    padding: 0.25rem;
    border-radius: 0.25rem;
  }
  :global(.prose hr) {
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
    border-top: 2px solid;
  }
  :global(.prose del) {
    text-decoration: line-through;
  }
</style>
