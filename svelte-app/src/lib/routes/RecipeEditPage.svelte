<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { locksService, type Lock as PbLock } from "$lib/services/pb-locks";
  import { route, navigate } from "$lib/router";
  import { Save, Lock, Copy, Trash2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { statusBarStore } from "../stores/StatusBarStore.svelte";
  import RecipeHeaderForm from "$lib/components/recipeEdit/RecipeHeaderForm.svelte";
  import RecipePrepaForm from "$lib/components/recipeEdit/RecipePrepaForm.svelte";
  import RecipePermissionsManager from "$lib/components/recipeEdit/RecipePermissionsManager.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import RecipeMetadata from "$lib/components/recipes/RecipeMetadata.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import {
    type RecipeFormState,
    type ValidationError,
    transformStoreDataToForm,
    createRecipeSnapshot,
    normalizeRecipeForSave,
    determineAllergensAndRegimes,
    validateRecipe,
    deleteRecipe,
  } from "./RecipeEditPage";
  import RecipeVariants from "../components/recipes/RecipeVariants.svelte";
  import { online } from "svelte/reactivity/window";

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  const recipeId = $derived(route.params.uuid as string);

  // svelte-ignore state_referenced_locally
  if (!recipeId) {
    toastService.error("ID de recette manquant");
    navigate("/recipe");
    throw new Error("recipeId is required");
  }

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let recipe = $state<RecipeFormState | null>(null);
  let loaded = $state(false);
  let isLoading = $state(true);
  let isSaving = $state(false);

  // Verrou porté par la collection `locks` (locksService) : TTL `expiresAt`,
  // takeover de l'expiré, release idempotent. L'ancien champ recipes.lockedBy
  // est mort — retrait du schéma au cutover.
  let activeLock = $state<PbLock | null>(null);
  let lockedResourceId: string | null = null;
  let isAcquiringLock = $state(false);
  // Résolution du verrou : smart lock (contributeur unique, pas de verrou
  // posé) et tentative d'acquisition terminée (succès, refus ou panne).
  let smartLock = $state(false);
  let lockSettled = $state(false);
  let lockUnsub: (() => void) | null = null;
  let heartbeatInterval: any = null;
  let initialRecipeSnapshot = $state<string | null>(null);

  // Modal de suppression
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);

  // État de validation
  let validationErrors = $state<{ value: ValidationError }>({
    value: {},
  });

  // Calcul de isDirty par comparaison avec le snapshot initial
  const isDirty = $derived.by(() => {
    if (!recipe || !initialRecipeSnapshot) return false;
    return createRecipeSnapshot(recipe) !== initialRecipeSnapshot;
  });

  // Logique réactive pour le brouillon
  $effect(() => {
    if (recipe && recipe.check !== true) {
      recipe.draft = true;
    }
  });

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  const isLockedByOthers = $derived.by(
    () => !!activeLock && activeLock.userId !== globalState.userId,
  );
  const isLockedByMe = $derived.by(
    () => !!activeLock && activeLock.userId === globalState.userId,
  );
  // isAcquiringLock ferme l'édition pendant l'acquisition : aucune fenêtre
  // éditable hors verrou (la refus du lock verrouille dès sa réponse).
  const canEdit = $derived(
    !!online.current &&
      !isLockedByOthers &&
      !isLoading &&
      !isAcquiringLock &&
      !isSaving,
  );

  const lockedByUserName = $derived(
    activeLock?.userName || "un autre utilisateur",
  );

  // Machine à états de rendu (option A, gate bloquant) : le formulaire
  // n'est JAMAIS rendu sans verrou résolu en notre faveur — détenu par nous
  // ou smart lock. Pas de handover à chaud, donc pas de formulaire périmé.
  const pageState = $derived.by(() => {
    if (isLoading || isAcquiringLock) return "loading";
    if (isLockedByOthers) return "gate";
    if (isLockedByMe || smartLock) return "ready";
    if (!lockSettled) return "loading"; // acquisition en cours de résolution
    return "gate"; // échec d'acquisition sans état lisible : bloquer (fail-closed)
  });
  const gateTitle = $derived(
    isLockedByOthers ? "Édition en cours" : "Édition indisponible",
  );
  const gateMessage = $derived(
    isLockedByOthers
      ? `${lockedByUserName} modifie actuellement cette recette. Attendez la fin de son édition pour la modifier à votre tour.`
      : "Impossible de vérifier le verrou d'édition. Vérifiez votre connexion puis réessayez.",
  );

  // Données de référence depuis RecipeDataStore
  const recipeInfo = $derived.by(() => ({
    materiel: recipeDataStore.materiel,
    categories: recipeDataStore.categories,
    regimes: recipeDataStore.regimes,
  }));

  // ============================================================================
  // AUTO-EFFECTS
  // ============================================================================

  // Charger la recette depuis le store
  $effect(() => {
    if (recipeId && !loaded && !isLoading) {
      return; // Déjà en cours de chargement
    }

    if (recipeId && loaded) {
      return; // Déjà chargé
    }

    if (recipeId && !loaded && isLoading) {
      recipesStore
        .getRecipeByUuid(recipeId)
        .then((data) => {
          if (data) {
            recipe = transformStoreDataToForm(data, {
              created: data.created,
              updated: data.updated ?? undefined,
              createdBy: data.createdBy ?? undefined,
            });
            loaded = true;
            isLoading = false;
            // Verrou : lecture initiale + souscription temps réel —
            // l'acquisition est pilotée par l'$effect réactif plus bas
            setupLockSubscription();
          } else {
            toastService.error("Recette introuvable");
            navigate("/recipe");
          }
        })
        .catch((error) => {
          console.error("Erreur chargement:", error);
          toastService.error("Erreur lors du chargement");
          navigate("/recipe");
        })
        .finally(() => {
          isLoading = false;
        });
    }
  });

  // Capturer le snapshot initial quand la recette est chargée
  $effect(() => {
    if (recipe && loaded && !initialRecipeSnapshot) {
      initialRecipeSnapshot = createRecipeSnapshot(recipe);
    }
  });

  // Acquérir le lock quand la page est chargée et le verrou libre — réactif :
  // si le détenteur libère (SSE), le gate bascule seul vers l'acquisition.
  $effect(() => {
    if (loaded && !isLockedByOthers && !isLockedByMe) {
      acquireLock().catch((err) =>
        console.error("[RecipeEditPage] Auto-acquire lock failed:", err),
      );
    }
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: recipe?.title || "Édition de recette",
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
        userName: lockedByUserName,
      });
    } else if (isLockedByMe) {
      statusBarStore.setLockStatus({ type: "locked-by-me" });
    } else {
      statusBarStore.setLockStatus(null);
    }
  });

  onDestroy(() => {
    if (lockUnsub) {
      lockUnsub();
      lockUnsub = null;
    }
    stopHeartbeat();
    releaseLock();
    statusBarStore.clearLockStatus();
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  $effect(() => {
    if (isDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

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
          console.error("[RecipeEditPage] Erreur heartbeat lock:", e);
        }
      }
    }, 240000); // 4 minutes (le lock expire à 7 min)
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  // ============================================================================
  // LOCK MANAGEMENT (locksService — collection `locks`)
  // ============================================================================

  /**
   * Lecture initiale du verrou + souscription temps réel. L'état local
   * `activeLock` est la seule source du badge : plus aucun aller-retour via
   * l'index des recettes (source des releases manquées au destroy).
   */
  async function setupLockSubscription(): Promise<void> {
    if (!recipeId) return;
    const resourceId = `recipe_${recipeId}`;
    // Lecture initiale best-effort : un échec (autocancel du SDK au remount
    // rapide, panne passagère) ne doit pas empêcher la souscription — le
    // temps réel fait foi pour la suite.
    try {
      activeLock = await locksService.getLock(resourceId);
    } catch (error) {
      console.warn("[RecipeEditPage] Lock initial illisible:", error);
    }
    try {
      lockUnsub = await locksService.subscribeToLock(resourceId, (lock) => {
        activeLock = lock;
      });
    } catch (error) {
      console.error("[RecipeEditPage] Erreur souscription lock:", error);
    }
  }

  async function acquireLock(): Promise<boolean> {
    if (!recipeId || !globalState.userId || !recipe || isAcquiringLock)
      return false;

    // Smart Lock: on ne verrouille que s'il y a plus d'un contributeur potentiel
    const contributors = recipe.permissionWrite || [];
    if (contributors.length <= 1) {
      smartLock = true;
      console.log("ℹ️ Verrou ignoré (contributeur unique)");
      return true;
    }

    isAcquiringLock = true;
    try {
      const resourceId = `recipe_${recipeId}`;
      // Le service renvoie TOUJOURS l'état du verrou après tentative — on le
      // pose immédiatement : acquis ou pas, la page reflète qui détient le
      // verrou (statusBar + canEdit), sans attendre le SSE.
      const lock = await locksService.acquireLock(
        resourceId,
        globalState.userId,
        globalState.userName || "",
      );
      activeLock = lock;

      if (lock.userId === globalState.userId) {
        lockedResourceId = resourceId;
        startHeartbeat();
        console.log(`[RecipeEditPage] Lock acquis pour ${resourceId}`);
        return true;
      }
      // Verrou d'autrui : le gate bloque l'accès au formulaire.
      return false;
    } catch (error) {
      console.error("[RecipeEditPage] Erreur acquisition lock:", error);
      // L'échec peut masquer une prise concurrente (la règle update répond
      // 404 quand le verrou vient d'être repris par autrui) : relire l'état
      // réel du verrou avant quoi que ce soit — le gate suivra.
      try {
        activeLock = await locksService.getLock(`recipe_${recipeId}`);
      } catch {
        toastService.error("Impossible de vérifier le verrou de la recette");
      }
      return false;
    } finally {
      isAcquiringLock = false;
      lockSettled = true;
    }
  }

  async function releaseLock(): Promise<void> {
    const resourceIdToRelease = lockedResourceId;
    if (!resourceIdToRelease || !globalState.userId) return;

    // 1. Cleanup local IMMÉDIAT (synchrone) — rend le release idempotent
    //    quand onDestroy suit le release du save
    stopHeartbeat();
    lockedResourceId = null;

    // 2. Release serveur ; activeLock suivra par SSE
    try {
      await locksService.releaseLock(resourceIdToRelease, globalState.userId);
    } catch (error) {
      console.error("[RecipeEditPage] Erreur libération lock:", error);
    }
  }

  /**
   * Re-cycle complet depuis le gate : désabonner le verrou, repartir du
   * chargement (recette puis verrou puis acquisition). Le formulaire
   * n'étant jamais rendu sans verrou résolu, tout rechargement est frais
   * par construction — il n'existe aucun handover à chaud.
   */
  function retryAcquisition(): void {
    if (!recipeId) return;
    if (lockUnsub) {
      lockUnsub();
      lockUnsub = null;
    }
    stopHeartbeat();
    lockedResourceId = null;
    activeLock = null;
    smartLock = false;
    lockSettled = false;
    loaded = false;
    isLoading = true;
    recipe = null;
    initialRecipeSnapshot = null;
  }

  function goBackToRecipe(): void {
    navigate(`/recipe/${recipeId}`);
  }

  // ============================================================================
  // SAVE
  // ============================================================================

  async function save(): Promise<void> {
    if (!recipe || isSaving || !globalState.userId) return;

    const isValid = validateRecipe(recipe, validationErrors);
    if (!isValid) {
      return;
    }

    isSaving = true;
    const toastId = toastService.loading("Sauvegarde en cours...");

    try {
      // Déterminer les régimes automatiquement
      const { regimes } = determineAllergensAndRegimes(recipe.ingredients);

      // Normaliser les types UI vers types DB
      const normalized = normalizeRecipeForSave(recipe);

      const recipeData: any = {
        ...normalized,
        categories: recipe.categories,
        regime: regimes,
        saison: recipe.saison,
        ingredients: recipe.ingredients,
        quantite_desc: recipe.quantite_desc,
        auteur: recipe.auteur,
        preparation24h: recipe.preparation24h,
        astuces: recipe.astuces,
        prepAlt: recipe.prepAlt,
        id: recipe.id,
        // Conserver createdBy pour l'upsert (création si nécessaire)
        createdBy: recipe.createdBy || globalState.userId,
      };

      const updated = await recipesStore.updateRecipe(recipeId, recipeData);

      // Libérer le verrou — la consultation n'en a plus besoin
      await releaseLock();

      // Réinitialiser isDirty après sauvegarde réussie en recapturant le snapshot
      initialRecipeSnapshot = createRecipeSnapshot(recipe);

      toastService.update(toastId, {
        state: "success",
        message: "Recette sauvegardée !",
      });

      // Rediriger vers la page de consultation
      navigate(`/recipe/${recipeId}`);
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toastService.update(toastId, {
        state: "error",
        message: "Erreur lors de la sauvegarde",
      });
    } finally {
      isSaving = false;
      setTimeout(() => toastService.dismiss(toastId), 3000);
    }
  }

  // ============================================================================
  // DUPLICATE
  // ============================================================================

  function duplicate(): void {
    if (!recipe) return;
    // Rediriger vers le mode duplication
    navigate(`/recipe/${recipeId}/duplicate`);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  function confirmDelete(): void {
    showDeleteModal = true;
  }

  async function handleDelete(): Promise<void> {
    if (!recipeId) return;

    isDeleting = true;

    try {
      await deleteRecipe(recipeId, async () => {
        // Libérer le verrou si on le détient
        if (isLockedByMe) {
          await releaseLock();
        }
      });

      // Rediriger vers la liste des recettes après un court délai
      setTimeout(() => {
        navigate("/recipe");
      }, 1500);
    } catch (error) {
      // L'erreur est déjà gérée par deleteRecipe()
      console.error("Erreur lors de la suppression:", error);
    } finally {
      isDeleting = false;
      showDeleteModal = false;
    }
  }
</script>

<!-- ============================================================================ -->
{#snippet navActions()}
  <div class="flex items-center gap-2">
    <!-- Duplicate button -->
    <button
      onclick={duplicate}
      disabled={!canEdit || isSaving}
      class="btn btn-soft btn-secondary btn-sm"
    >
      <Copy class="h-4 w-4" />
      <span class="hidden sm:inline">Créer une version alternative</span>
    </button>

    <!-- Save button -->
    <button
      onclick={save}
      disabled={!canEdit || isSaving || !isDirty}
      class="btn btn-accent btn-sm"
    >
      {#if isSaving}
        <span class="loading loading-xs loading-spinner text-primary"></span>
      {:else}
        <Save class="h-4 w-4" />
      {/if}
      <span class="hidden sm:inline"
        >{isSaving ? "Sauvegarde..." : "Sauvegarder"}</span
      >
    </button>
  </div>
{/snippet}

<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div transition:fade class="max-w-9xl container mx-auto px-4 py-8">
  {#if pageState === "gate"}
    <!-- Gate bloquant : aucun formulaire rendu sans verrou résolu en notre
         faveur — l'écrasement de modifications concurrentes est impossible
         par construction. -->
    <div
      class="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <div class="rounded-full bg-warning/20 p-4">
        <Lock class="h-8 w-8 text-warning" />
      </div>
      <h2 class="text-lg font-bold">{gateTitle}</h2>
      <p class="max-w-md text-base-content/70">{gateMessage}</p>
      <div class="mt-2 flex gap-2">
        <button class="btn btn-ghost" onclick={goBackToRecipe}>Retour</button>
        <button class="btn btn-primary" onclick={retryAcquisition}>
          Réessayer
        </button>
      </div>
    </div>
  {:else if recipe}
    <!-- Form -->
    <div class="space-y-6">
      <!-- Métadonnées de base -->
      <RecipeHeaderForm
        bind:recipe
        {recipeInfo}
        validationErrors={validationErrors.value}
        {canEdit}
      />

      <!-- Ingrédients et Préparation -->
      <RecipePrepaForm
        bind:recipe
        validationErrors={validationErrors.value}
        {canEdit}
      />

      <!-- Permissions / Collaborateurs -->
      <RecipePermissionsManager
        bind:permissionWrite={recipe.permissionWrite}
        createdBy={recipe.createdBy}
        {canEdit}
      />

      <!-- Métadonnées système -->
      {#if recipe.created}
        <RecipeMetadata
          auteur={recipe.auteur}
          createdBy={recipe.createdBy}
          id={recipe.id ?? ""}
          createdAt={recipe.created}
          updatedAt={recipe.updated}
        />
      {/if}

      {#if recipeId}
        <div class="mt-8 print:hidden">
          <RecipeVariants {recipeId} />
        </div>
      {/if}

      <!-- Zone de danger - Suppression -->
      {#if canEdit}
        <div
          class="mt-8 alert border border-error alert-soft alert-error max-md:alert-vertical"
        >
          <Trash2 class="h-5 w-5 shrink-0" />
          <div class="flex-1">
            <h4 class="font-bold">Zone de danger</h4>
            <p class="text-sm">
              La suppression d'une recette est irréversible. Si elle était
              utilisé dans des événements, ceux-ci n'y auront plus accès. Vous
              êtes seul·e autorisé à supprimer une recettes que vous avez crée.
              Les versions alternatives crées à partir de celle-ci ne seront pas
              supprimée.
            </p>
          </div>
          <button
            onclick={confirmDelete}
            disabled={isDeleting}
            class="btn btn-error btn-sm"
          >
            {isDeleting ? "Suppression..." : "Supprimer la recette"}
          </button>
        </div>
      {/if}

      <!-- Bouton flottant Sauvegarder (mobile uniquement) -->
      {#if isDirty && !isSaving}
        <button
          class="btn sticky bottom-2 shadow-lg btn-accent btn-sm {!globalState.isMobile &&
            'hidden'}"
          onclick={save}
          disabled={!canEdit || isSaving || !isDirty}
        >
          <Save size={16} class="mr-1" />
          Sauvegarder
        </button>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-center py-20">
      <div class="loading loading-lg loading-spinner"></div>
    </div>
  {/if}
</div>

<!-- Guard de navigation pour modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey={`/recipe/${recipeId}/edit`}
  shouldProtect={() => isDirty && !isLockedByOthers}
  onLeaveWithoutSave={async () => {
    // Libérer le lock si on le détient
    if (isLockedByMe) {
      await releaseLock();
    }
  }}
  message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
/>

<!-- Modal de confirmation de suppression -->
<ConfirmModal
  isOpen={showDeleteModal}
  title="Supprimer cette recette ?"
  message="Cette action est irréversible, êtes vous sur de vouloir supprimer cette recette ?"
  variant="danger"
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
  onConfirm={handleDelete}
  onCancel={() => (showDeleteModal = false)}
/>
