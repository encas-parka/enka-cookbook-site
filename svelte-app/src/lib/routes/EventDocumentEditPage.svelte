<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate, route, searchParams } from "$lib/router";
  import { onDestroy, onMount, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { Save, Lock, Edit3, Eye, Download } from "@lucide/svelte";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";
  import { online } from "svelte/reactivity/window";
  import {
    locksService,
    type AppwriteLock,
  } from "$lib/services/appwrite-locks";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  let eventId = $derived(route.params.id || "");
  let docId = $derived(route.params.docId || "");

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let title = $state("");
  let content = $state("");
  let isLoading = $state(true);
  let isSaving = $state(false);
  let autosaveInterval: ReturnType<typeof setInterval> | null = null;
  let pendingManualSave = $state(false);
  let initialDocumentSnapshot = $state<string>("");

  // Lock state (locksService)
  let activeLock = $state<AppwriteLock | null>(null);
  let lockUnsub: (() => void) | null = null;
  let isAcquiringLock = $state(false);
  // docId non-réactif capturé au moment de l'acquisition du lock
  // pour garantir sa disponibilité lors du cleanup (onDestroy)
  let lockedResourceId: string | null = null;

  // Mode édition ou preview
  const mode = $derived(
    (searchParams.get("mode") as "edit" | "preview" | null) || "preview",
  );

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

  // ============================================================================
  // LECTURE RÉACTIVE DU STORE
  // ============================================================================

  const storeDoc = $derived(teamdocsStore.getDocumentById(docId));
  const currentEvent = $derived(eventsStore.getEventById(eventId));

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const isDirty = $derived.by(() => {
    const currentSnapshot = JSON.stringify({
      title,
      content,
      tags: selectedTags,
    });
    return currentSnapshot !== initialDocumentSnapshot;
  });

  const isLockedByMe = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId === globalState.userId;
  });
  const isLockedByOthers = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId !== globalState.userId;
  });
  const canEdit = $derived(
    online.current && !isLockedByOthers && !isLoading && !isSaving,
  );
  const isValid = $derived(title.trim().length > 0);

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
        startAutosave();
        return true;
      } else {
        toastService.warning(
          `Ce document est en cours de modification par ${activeLock?.userName || "un autre utilisateur"}`,
        );
        return false;
      }
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur acquisition lock:", error);
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
    stopAutosave();
    lockedResourceId = null;

    // 2. Release serveur (fire-and-forget)
    try {
      await locksService.releaseLock(resourceIdToRelease, globalState.userId);
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur libération lock:", error);
    }
    // activeLock sera mis à jour par le realtime
  }

  // ============================================================================
  // AUTOSAVE (toutes les 5 minutes, sans quitter le mode édition)
  // ============================================================================

  const AUTOSAVE_DELAY = 300000; // 5 minutes

  async function performAutosave() {
    // 1. Heartbeat : rafraîchir le lock si on le détient (avant le early return)
    if (lockedResourceId && globalState.userId) {
      try {
        await locksService.acquireLock(
          lockedResourceId,
          globalState.userId,
          globalState.userName || "",
        );
      } catch (e) {
        console.error("[EventDocumentEditPage] Erreur heartbeat lock:", e);
      }
    }

    // 2. Sauvegarde si des modifications existent
    if (
      !isDirty ||
      isSaving ||
      !isLockedByMe ||
      !storeDoc ||
      !isValid ||
      !online.current
    )
      return;

    isSaving = true;
    try {
      await teamdocsStore.updateDocument(docId, {
        title: title.trim(),
        content,
        tags: [...selectedTags],
      });
      // Mettre à jour le snapshot → isDirty passe à false
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags: [...selectedTags],
      });
      toastService.info("Sauvegarde automatique effectuée");
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur autosave:", error);
      // Pas de toast d'erreur pour l'autosave — l'utilisateur sera notifié au prochain save manuel
    } finally {
      isSaving = false;
      // Si l'utilisateur a demandé un save manuel pendant l'autosave, on le déclenche
      if (pendingManualSave) {
        pendingManualSave = false;
        handleSave();
      }
    }
  }

  function startAutosave() {
    stopAutosave();
    autosaveInterval = setInterval(() => {
      performAutosave();
    }, AUTOSAVE_DELAY);
  }

  function stopAutosave() {
    if (autosaveInterval) {
      clearInterval(autosaveInterval);
      autosaveInterval = null;
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    if (!globalState.userId) {
      toastService.error("Vous devez être connecté");
      navigate("/");
      return;
    }

    if (!teamdocsStore.isInitialized) {
      await teamdocsStore.initialize();
    }

    isLoading = true;
    try {
      const doc = teamdocsStore.getDocumentById(docId);
      if (!doc) {
        toastService.error("Document introuvable");
        navigate(`/event/${eventId}/documents`);
        return;
      }

      title = doc.title || "";
      content = doc.content || "";
      selectedTags = doc.tags || [];
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags: selectedTags,
      });

      // Le lock est chargé et souscrit via le $effect dédié ci-dessous,
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur chargement:", error);
      toastService.error("Erreur lors du chargement du document");
    } finally {
      isLoading = false;
    }
  });

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

  // Souscription lock réactive au docId — quand le routeur réutilise le composant
  // avec un nouveau docId, la cleanup function désabonne l'ancien lock, puis l'effet
  // recrée la souscription pour le nouveau document.
  $effect(() => {
    const currentDocId = docId;
    if (!currentDocId) return;

    activeLock = null;
    let canceled = false;

    untrack(async () => {
      if (!storeDoc) return;
      if (canceled) return;

      try {
        const lock = await locksService.getLock(`doc_${currentDocId}`);
        if (canceled) return;
        activeLock = lock;

        const unsub = locksService.subscribeToLock(
          `doc_${currentDocId}`,
          (newLock) => {
            activeLock = newLock;
          },
        );

        if (canceled) {
          unsub();
          return;
        }

        lockUnsub = unsub;
      } catch (error) {
        console.error("[EventDocumentEditPage] Erreur chargement lock:", error);
      }
    });

    return () => {
      canceled = true;
      if (lockUnsub) {
        lockUnsub();
        lockUnsub = null;
      }
    };
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
      if (document.visibilityState !== "visible") return;
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
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
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

  async function handleSave() {
    if (!isValid || !storeDoc) return;
    // Si un autosave est en cours, on mémorise la demande pour l'exécuter après
    if (isSaving) {
      pendingManualSave = true;
      return;
    }
    isSaving = true;
    try {
      await teamdocsStore.updateDocument(docId, {
        title: title.trim(),
        content,
        tags: [...selectedTags],
      });
      // Mettre à jour le snapshot → isDirty passe à false
      initialDocumentSnapshot = JSON.stringify({
        title,
        content,
        tags: [...selectedTags],
      });

      // Basculer en mode preview
      // Le $effect réactif libérera le lock automatiquement
      // (condition : mode === "preview" && isLockedByMe && !isDirty)
      searchParams.set("mode", "preview");

      toastService.success("Document enregistré");
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur sauvegarde:", error);
      toastService.error("Erreur lors de la sauvegarde");
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
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
  // NAVBAR
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: storeDoc ? storeDoc.title : "Document",
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

  $effect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bg-base-200 min-h-lvh px-4 pt-4 pb-20 md:px-20"
  onkeydown={handleKeydown}
  role="region"
  tabindex="-1"
  transition:fade
>
  <div class="mx-auto mt-6 max-w-5xl">
    {#if !isLoading && storeDoc}
      <div class="mb-4">
        <div class="rounded-box px-4 py-1">
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

    {#if isLoading}
      <div class="flex justify-center py-20">
        <div class="loading loading-spinner loading-lg"></div>
      </div>
    {:else if storeDoc}
      <div class="space-y-4">
        {#if mode === "edit"}
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

          <!-- Sélecteur de tags -->
          {#if mode === "edit"}
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
          {/if}

          <fieldset class="fieldset">
            <MarkdownEditorAdvanced
              bind:value={content}
              placeholder="Commencez à rédiger votre document..."
            />
          </fieldset>
        {:else}
          <!-- Mode preview -->
          <div class="mb-6 flex items-center justify-between">
            <div class="flex-1">
              <div
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <h1 class="text-2xl font-bold">{title}</h1>
                <p class="text-sm opacity-70">
                  Événement : <span class="font-medium"
                    >{currentEvent?.name || ""}</span
                  >
                </p>
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
</div>

<UnsavedChangesGuard
  routeKey={`event-document-edit/${eventId}/${docId}`}
  shouldProtect={() => isDirty && isLockedByMe}
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
  :global(.dropdown-content) {
    z-index: 9999;
  }

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
