<script lang="ts">
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate } from "$lib/router";
  import { onDestroy, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { Save, Lock, Edit3, Eye, Download } from "@lucide/svelte";
  import MarkdownEditorAdvanced from "$lib/components/MarkdownEditorAdvanced.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";
  import { online } from "svelte/reactivity/window";
  import { route, searchParams } from "$lib/router";
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
  let iHoldLock = $state(false);
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let initialDocumentSnapshot = $state<string>("");

  // docId non-réactif capturé au moment de l'acquisition du lock
  // pour garantir sa disponibilité lors du cleanup (onDestroy)
  let lockedDocId: string | null = null;

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

  const lockHolder = $derived(storeDoc?.lockedBy ?? null);
  const lockHolderName = $derived(storeDoc?.lockedByName ?? null);

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const isDirty = $derived.by(() => {
    const currentSnapshot = JSON.stringify({ title, content, tags: selectedTags });
    return currentSnapshot !== initialDocumentSnapshot;
  });

  const isLockedByMe = $derived(iHoldLock);
  const isLockedByOthers = $derived(
    !!lockHolder && lockHolder !== globalState.userId && !iHoldLock,
  );
  const canEdit = $derived(
    online.current && !isLockedByOthers && !isLoading && !isSaving,
  );
  const isValid = $derived(title.trim().length > 0);

  // ============================================================================
  // LOCK LIFECYCLE
  // ============================================================================

  async function attemptAcquireLock(): Promise<boolean> {
    if (!docId || !globalState.userId || !storeDoc) return false;

    try {
      const currentLockedBy = storeDoc.lockedBy;
      const lastUpdate = storeDoc.$updatedAt
        ? new Date(storeDoc.$updatedAt)
        : null;
      const isExpired =
        lastUpdate && Date.now() - lastUpdate.getTime() > 300000;

      if (currentLockedBy && currentLockedBy !== globalState.userId) {
        if (!isExpired) {
          return false; // Verrouillé par quelqu'un d'autre, non expiré
        }
        console.log(
          "[EventDocumentEditPage] Verrou précédent expiré, reprise...",
        );
      }

      await teamdocsStore.updateDocumentLock(
        docId,
        globalState.userId,
        globalState.userName || null,
      );
      iHoldLock = true;
      lockedDocId = docId;
      startHeartbeat();
      return true;
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur acquisition lock:", error);
      toastService.error("Impossible de verrouiller le document");
      return false;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(async () => {
      if (iHoldLock && docId) {
        try {
          await teamdocsStore.updateDocumentLock(
            docId,
            globalState.userId,
            globalState.userName || null,
          );
        } catch (error) {
          console.error("[EventDocumentEditPage] Erreur heartbeat:", error);
        }
      }
    }, 120000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  /**
   * Libère le lock
   * Cleanup local synchrone + release serveur fire-and-forget
   *
   * Utilise lockedDocId (non-réactif) car docId (réactif) peut déjà
   * être vide lors du onDestroy si la route a déjà changé.
   */
  function releaseLock(): void {
    const docIdToRelease = lockedDocId;
    if (!docIdToRelease || !iHoldLock) return;

    // 1. Cleanup local IMMÉDIAT (synchrone)
    stopHeartbeat();
    iHoldLock = false;
    lockedDocId = null;

    // 2. Release serveur (fire-and-forget)
    teamdocsStore
      .updateDocumentLock(docIdToRelease, null, null)
      .catch((error) => {
        console.error("[EventDocumentEditPage] Erreur libération lock:", error);
      });
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
      initialDocumentSnapshot = JSON.stringify({ title, content, tags: selectedTags });

      // Le lock est acquis réactivement via le $effect ci-dessous,
      // uniquement si le mode initial est "edit"
    } catch (error) {
      console.error("[EventDocumentEditPage] Erreur chargement:", error);
      toastService.error("Erreur lors du chargement du document");
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    releaseLock();
    statusBarStore.clearLockStatus();
  });

  // Lock réactif au mode
  $effect(() => {
    if (isLoading || !storeDoc) return;

    if (mode === "edit" && !isLockedByOthers && !iHoldLock) {
      attemptAcquireLock();
    }

    if (mode === "preview" && iHoldLock && !isDirty) {
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
    if (!isValid || isSaving || !storeDoc) return;
    isSaving = true;
    try {
      await teamdocsStore.updateDocument(docId, {
        title: title.trim(),
        content,
        tags: [...selectedTags],
      });
      // Mettre à jour le snapshot → isDirty passe à false
      initialDocumentSnapshot = JSON.stringify({ title, content, tags: [...selectedTags] });

      // Basculer en mode preview
      // Le $effect réactif libérera le lock automatiquement
      // (condition : mode === "preview" && iHoldLock && !isDirty)
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
        userName: lockHolderName || "un autre utilisateur",
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
              >{lockHolderName || "un autre utilisateur"}</span
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
