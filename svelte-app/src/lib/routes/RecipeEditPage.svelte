<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    executeManageDataRecipe,
    updateRecipeAppwrite,
  } from "$lib/services/appwrite-recipes";
  import { ingredientsToAppwrite } from "$lib/utils/ingredientUtils";
  import { astucesToAppwrite } from "$lib/utils/recipeUtils";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { route, navigate } from "$lib/router";
  import { Save, Lock, Copy, Trash2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import RecipeHeaderForm from "$lib/components/recipeEdit/RecipeHeaderForm.svelte";
  import RecipePrepaForm from "$lib/components/recipeEdit/RecipePrepaForm.svelte";
  import RecipeVersionManager from "$lib/components/recipeEdit/RecipeVersionManager.svelte";
  import RecipePermissionsManager from "$lib/components/recipeEdit/RecipePermissionsManager.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import RecipeMetadata from "$lib/components/recipes/RecipeMetadata.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import { warmUpEnkaData } from "$lib/services/appwrite-warmup";
  import {
    type RecipeFormState,
    type ValidationError,
    transformStoreDataToForm,
    createRecipeSnapshot,
    normalizeRecipeForAppwrite,
    prepareHugoData,
    normalizeAllIngredients,
    determineAllergensAndRegimes,
    validateRecipe,
    deleteRecipe,
  } from "./RecipeEditPage";
  import RecipeVariants from "../components/recipes/RecipeVariants.svelte";

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  const recipeId = $derived(route.params.uuid);

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
  let lockedBy = $state<string | null>(null);
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
    () => !!lockedBy && lockedBy !== globalState.userId,
  );
  const isLockedByMe = $derived.by(
    () => !!lockedBy && lockedBy === globalState.userId,
  );
  const canEdit = $derived(!isLockedByOthers && !isLoading);

  // Données de référence depuis RecipeDataStore
  const recipeInfo = $derived.by(() => ({
    materiel: recipeDataStore.materiel,
    categories: recipeDataStore.categories,
    regimes: recipeDataStore.regimes,
  }));

  // ============================================================================
  // AUTO-EFFECTS
  // ============================================================================

  // WARM-UP
  // $effect(() => {
  //   warmUpEnkaData();
  // });

  // Vérifier que l'utilisateur est connecté
  $effect(() => {
    if (!globalState.userId) {
      toastService.error("Vous devez être connecté");
      navigate("/");
      return;
    }
  });

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
        .then(async (data) => {
          if (data) {
            recipe = transformStoreDataToForm(data, {
              $createdAt: data.$createdAt,
              $updatedAt: data.$updatedAt,
              createdBy: data.createdBy,
            });
            lockedBy = data.lockedBy || null;
            loaded = true;
            isLoading = false;

            // Acquérir le verrou après chargement
            await acquireLock();
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

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: recipe?.title || "Édition de recette",
      actions: navActions,
    });
  });

  onDestroy(async () => {
    stopHeartbeat();
    if (isLockedByMe && !isSaving) {
      await releaseLock();
    }
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
    if (!recipeId || !isLockedByMe) return;

    heartbeatInterval = setInterval(async () => {
      try {
        console.log("💓 Heartbeat: Refreshing lock...");
        await recipesStore.updateRecipeLock(recipeId, globalState.userId);
      } catch (error) {
        console.error("❌ Heartbeat failed:", error);
      }
    }, 120000); // 2 minutes
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  // ============================================================================
  // LOCK MANAGEMENT
  // ============================================================================

  async function acquireLock(): Promise<boolean> {
    if (!recipeId || !globalState.userId || !recipe) return false;

    // Smart Lock: On ne verrouille que s'il y a plus d'un contributeur potentiel
    const contributors = recipe.permissionWrite || [];
    if (contributors.length <= 1) {
      console.log("ℹ️ Verrou ignoré (contributeur unique)");
      return true;
    }

    try {
      // Vérifier si le verrou actuel est expiré (plus de 5 minutes)
      const currentLockedBy = recipe.lockedBy;
      const lastUpdate = recipe.$updatedAt ? new Date(recipe.$updatedAt) : null;
      const isExpired =
        lastUpdate && Date.now() - lastUpdate.getTime() > 300000; // 5 min

      if (currentLockedBy && currentLockedBy !== globalState.userId) {
        if (isExpired) {
          console.log("⏳ Verrou précédent expiré, reprise de contrôle...");
        } else {
          return false;
        }
      }

      await recipesStore.updateRecipeLock(recipeId, globalState.userId);
      lockedBy = globalState.userId;
      console.log("🔒 Verrou acquis");
      startHeartbeat();
      return true;
    } catch (error) {
      console.error("❌ Erreur acquisition verrou:", error);
      toastService.error("Impossible de verrouiller la recette");
      return false;
    }
  }

  async function releaseLock(): Promise<void> {
    if (!recipeId) return;
    stopHeartbeat();

    try {
      await recipesStore.updateRecipeLock(recipeId, null);
      lockedBy = null;
      console.log("🔓 Verrou libéré");
    } catch (error) {
      console.error("❌ Erreur libération verrou:", error);
    }
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

      // Normaliser les types UI vers types Appwrite
      const normalized = normalizeRecipeForAppwrite(recipe);

      const recipeData: any = {
        ...normalized,
        categories: recipe.categories,
        regime: regimes,
        saison: recipe.saison,
        ingredients: ingredientsToAppwrite(recipe.ingredients),
        quantite_desc: recipe.quantite_desc,
        auteur: globalState.userName, // Utiliser le userName actuel plutôt que l'ancienne valeur
        preparation24h: recipe.preparation24h,
        astuces: astucesToAppwrite(recipe.astuces),
        prepAlt: recipe.prepAlt,
        $id: recipe.$id,
        // Libérer le lock atomiquement avec la sauvegarde
        lockedBy: null,
      };

      const updated = await updateRecipeAppwrite(
        recipeId,
        recipeData,
        globalState.userId,
      );

      // Réinitialiser isDirty après sauvegarde réussie en recapturant le snapshot
      initialRecipeSnapshot = createRecipeSnapshot(recipe);

      // Appel async pour synchroniser vers GitHub
      const hugoUpdateData = prepareHugoData(recipe, recipeData, {
        id: updated.$id,
        createdAt: updated.$createdAt,
        updatedAt: updated.$updatedAt,
        createdBy: updated.createdBy,
      });

      executeManageDataRecipe(
        "save_recipe",
        recipeId,
        globalState.userId,
        hugoUpdateData,
        true,
      ).catch((error) => {
        console.error("Sync vers GitHub échouée:", error);
      });

      toastService.update(toastId, {
        state: "success",
        message: "Recette sauvegardée !",
      });

      // Attendre que le realtime propage la mise à jour avant de rediriger
      // pour éviter les race conditions avec le cache
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      class="btn btn-secondary btn-soft btn-sm"
    >
      <Copy class="h-4 w-4" />
      Créer une version alternative
    </button>

    <!-- Save button -->
    <button
      onclick={save}
      disabled={!canEdit || isSaving || !isDirty}
      class="btn btn-accent btn-sm"
    >
      <Save class="h-4 w-4" />
      {isSaving ? "Sauvegarde..." : "Sauvegarder"}
    </button>
  </div>
{/snippet}

<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div transition:fade class="max-w-9xl container mx-auto px-4 py-8">
  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <div class="loading loading-spinner loading-lg"></div>
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
      {#if recipe.$createdAt}
        <RecipeMetadata
          auteur={recipe.auteur}
          createdBy={recipe.createdBy}
          id={recipe.$id ?? ""}
          createdAt={recipe.$createdAt}
          updatedAt={recipe.$updatedAt}
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
          class="alert alert-error alert-soft border-error max-md:alert-vertical mt-8 border"
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
    </div>
  {/if}
</div>

<!-- Lock indicator -->
{#if isLockedByOthers}
  <div class="bg-base-100 rounded-t-box fixed bottom-0 left-0">
    <div
      class=" bg-warning/40 rounded-t-box flex size-full items-center px-4 py-1"
    >
      <Lock class="me-2 h-4 w-4" />
      Vérouillé : document en cours d'édition par un·e autre utilisateur·ice.
    </div>
  </div>
{/if}

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
  onSaveAndLeave={async () => {
    // Sauvegarder et autoriser la navigation
    await save();
    // Le guard sera notifié du succès via le return implicite
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
