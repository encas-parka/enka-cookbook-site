<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { onDestroy, onMount } from "svelte";
  import {
    Save,
    X,
    Lock,
    Eye,
    Edit3,
    Loader2,
    PlusIcon,
    Download,
  } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import BtnGroupCheck from "$lib/components/ui/BtnGroupCheck.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";
  import { online } from "svelte/reactivity/window";
  import { locksService, type AppwriteLock } from "$lib/services/pb-locks";

  // ============================================================================
  // ROUTE PARAMETERS
  // ============================================================================

  import { route, searchParams } from "$lib/router";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  let teamId = $derived(route.params.teamId);
  let docId = $derived(route.params.docId);

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let title = $state("");
  let content = $state("");
  let tags = $state<string[]>([]);
  let newTag = $state("");
  let isPublic = $state(false);

  let isLoading = $state(true);
  let isSaving = $state(false);
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let initialDocumentSnapshot = $state<string>("");

  // Lock state (locksService)
  let activeLock = $state<AppwriteLock | null>(null);
  let lockUnsub: (() => void) | null = null;
  let isAcquiringLock = $state(false);
  // resourceId non-réactif capturé au moment de l'acquisition du lock
  // pour garantir sa disponibilité lors du cleanup (onDestroy)
  let lockedResourceId: string | null = null;

  // ============================================================================
  // LECTURE RÉACTIVE DU STORE (pour le lock)
  // ============================================================================

  /**
   * Document lu depuis le store — réactif aux mises à jour realtime
   * Permet de détecter les changements de lock par d'autres utilisateurs
   */
  const storeDoc = $derived(
    docId ? teamdocsStore.getDocumentById(docId) : undefined,
  );

  // Mode édition ou preview - lu depuis les query params
  const mode = $derived(
    (searchParams.get("mode") as "edit" | "preview" | null) || "preview",
  );

  // Équipe
  let team = $derived(nativeTeamsStore.myTeams.find((t) => t.id === teamId));

  // Tags disponibles depuis le store + tags ajoutés par l'utilisateur
  let availableTags = $derived.by(() => {
    const teamTags = teamId ? teamdocsStore.getTeamTags(teamId) : [];
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

  const isLockedByOthers = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId !== globalState.userId;
  });
  const isLockedByMe = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId === globalState.userId;
  });
  const canEdit = $derived(
    online.current && !isLockedByOthers && !isLoading && !isSaving,
  );

  // Validation
  const isValid = $derived(title.trim().length > 0 && team !== undefined);

  // ============================================================================
  // LOCK LIFECYCLE (locksService)
  // ============================================================================

  async function acquireLock(): Promise<boolean> {
    if (!docId || !globalState.userId || isAcquiringLock) return false;

    isAcquiringLock = true;
    try {
      const resourceId = `doc_${docId}`;
      const success = await locksService.acquireLock(
        resourceId,
        globalState.userId,
        globalState.userName || "",
      );

      if (success) {
        lockedResourceId = resourceId;
        startHeartbeat();
        console.log(`[EditDocumentPage] Lock acquis pour ${resourceId}`);
        return true;
      } else {
        toastService.warning(
          `Ce document est en cours de modification par ${activeLock?.userName || "un autre utilisateur"}`,
        );
        return false;
      }
    } catch (error) {
      console.error("[EditDocumentPage] Erreur acquisition lock:", error);
      toastService.error("Impossible de verrouiller le document");
      return false;
    } finally {
      isAcquiringLock = false;
    }
  }

  async function releaseLock(): Promise<void> {
    const resourceIdToRelease = lockedResourceId;
    if (!resourceIdToRelease || !globalState.userId) return;

    // 1. Cleanup local IMMÉDIAT (synchrone)
    stopHeartbeat();
    lockedResourceId = null;

    // 2. Release serveur
    try {
      await locksService.releaseLock(resourceIdToRelease, globalState.userId);
    } catch (error) {
      console.error("[EditDocumentPage] Erreur libération lock:", error);
    }
    // activeLock sera mis à jour par le realtime
  }

  // Heartbeat pour maintenir le lock en édition prolongée
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(async () => {
      if (lockedResourceId && globalState.userId) {
        try {
          await locksService.acquireLock(
            lockedResourceId,
            globalState.userId,
            globalState.userName || "",
          );
        } catch (e) {
          console.error("[EditDocumentPage] Erreur heartbeat lock:", e);
        }
      }
    }, 240000); // 4 minutes (lock expire à 7 min)
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
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
      if (!docId) {
        toastService.error("Document introuvable");
        navigate(`/teams/${teamId}`);
        return;
      }

      const doc = teamdocsStore.getDocumentById(docId);

      if (!doc) {
        toastService.error("Document introuvable");
        navigate(`/teams/${teamId}`);
        return;
      }

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

      // Charger le lock en arrière-plan + souscription realtime
      try {
        const resourceId = `doc_${docId}`;
        activeLock = await locksService.getLock(resourceId);
        lockUnsub = await locksService.subscribeToLock(resourceId, (lock) => {
          console.log("[EditDocumentPage] 🔒 Verrou mis à jour:", {
            lockedBy: lock?.userName,
            userId: lock?.userId,
            expiresAt: lock?.expiresAt,
          });
          activeLock = lock;
        });
      } catch (error) {
        console.error("[EditDocumentPage] Erreur chargement lock:", error);
      }

      // Le lock est acquis réactivement via le $effect ci-dessous,
      // uniquement si le mode initial est "edit"
    } catch (error) {
      console.error("[EditDocumentPage] Erreur chargement document:", error);
      toastService.error("Erreur lors du chargement du document");
    } finally {
      isLoading = false;
    }
  });

  // Libérer le lock à la destruction
  onDestroy(() => {
    // Désabonner du realtime des locks
    if (lockUnsub) {
      lockUnsub();
      lockUnsub = null;
    }
    // Libérer le lock si détenu
    releaseLock();
    statusBarStore.clearLockStatus();
  });

  // Lock réactif au mode
  $effect(() => {
    if (isLoading || !storeDoc) return;

    // Forcer le mode preview quand le document est locké par un autre
    if (isLockedByOthers && mode === "edit") {
      searchParams.set("mode", "preview");
      return;
    }

    if (mode === "edit" && !isLockedByOthers && !isLockedByMe) {
      acquireLock();
    }

    if (mode === "preview" && isLockedByMe && !isDirty) {
      releaseLock();
    }
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

  // Rafraîchir le lock quand l'onglet redevient visible (mobile/tab arrière-plan)
  $effect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!lockedResourceId || !globalState.userId) return;

      const success = await locksService.acquireLock(
        lockedResourceId,
        globalState.userId,
        globalState.userName || "",
      );

      if (!success) {
        toastService.warning(
          `Ce document est maintenant édité par ${activeLock?.userName || "un autre utilisateur"}`,
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  });

  // ============================================================================
  // MODE TOGGLE
  // ============================================================================

  function handleModeChange(newMode: "edit" | "preview") {
    if (newMode === "edit" && isLockedByOthers) return;
    searchParams.set("mode", newMode);
  }

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
    if (!isValid || isSaving || !storeDoc || !docId) return;

    isSaving = true;

    try {
      await teamdocsStore.updateDocument(docId, {
        title: title.trim(),
        content,
        tags: tags.length > 0 ? [...tags] : null,
        isPublic,
      });

      // Mettre à jour le snapshot → isDirty passe à false
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags,
        isPublic,
      });

      // Basculer en mode preview
      // Le $effect réactif libérera le lock automatiquement
      // (condition : mode === "preview" && isLockedByMe && !isDirty)
      searchParams.set("mode", "preview");

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

  function handleExport() {
    const md = content || "";
    shareOrDownload(
      md,
      `${toSlug(title || storeDoc?.title || "document")}.md`,
      "Document exporté",
    );
  }

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: storeDoc ? `Document: ${storeDoc.title}` : "Modifier le document",
      actions: navActions,
    });
  });

  // ============================================================================
  // STATUS BAR (lock info)
  // ============================================================================

  $effect(() => {
    if (isLockedByOthers) {
      statusBarStore.setLockStatus({
        type: "locked-by-other",
        userName: activeLock?.userName || "un autre utilisateur",
      });
    } else if (isLockedByMe) {
      statusBarStore.setLockStatus({ type: "locked-by-me" });
    } else {
      statusBarStore.setLockStatus(null);
    }
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
    <button
      class="btn btn-primary btn-circle btn-sm"
      onclick={handleExport}
      title="Exporter le document"
    >
      <Download size={18} />
    </button>
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
        <span class="hidden sm:inline">Enregistrer</span>
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
          <span class="font-bold"
            >{activeLock?.userName || "un autre utilisateur"}</span
          >. Vous ne pouvez pas le modifier pour le moment.
        </p>
      </div>
    </div>
  {/if}

  <!-- Tabs mode édition/aperçu -->
  {#if !isLoading && storeDoc}
    <div class="mb-4">
      <div class=" px-4 py-1">
        <div class="tabs tabs-border justify-center">
          <button
            class="tab gap-2 font-semibold"
            class:tab-active={mode === "edit"}
            onclick={() => handleModeChange("edit")}
            disabled={isLockedByOthers}
          >
            <Edit3 class="h-4 w-4" />
            Édition
          </button>
          <button
            class="tab gap-2 font-semibold"
            class:tab-active={mode === "preview"}
            onclick={() => handleModeChange("preview")}
          >
            <Eye class="h-4 w-4" />
            Aperçu
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Contenu principal -->
  {#if isLoading}
    <div class="flex justify-center py-20">
      <div class="loading loading-spinner loading-lg"></div>
    </div>
  {:else if storeDoc}
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
        <div class="mb-6 flex items-center justify-between">
          <div class="flex-1">
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
  onLeaveWithoutSave={() => {
    // Libérer le lock si on le détient
    if (isLockedByMe) {
      releaseLock();
    }
  }}
  message="Vous avez des modifications non sauvegardées. Voulez-vous quitter sans sauvegarder ?"
/>

<!-- Bouton flottant Enregistrer (mobile uniquement) -->
{#if isDirty && !isSaving}
  <button
    class="btn btn-primary btn-sm sticky bottom-2 shadow-lg {!globalState.isMobile &&
      'hidden'}"
    onclick={handleSave}
    disabled={!canEdit || !isValid || isSaving}
  >
    <Save size={16} class="mr-1" />
    Enregistrer
  </button>
{/if}

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
