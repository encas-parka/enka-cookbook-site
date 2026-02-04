<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    createRecipeAppwrite,
    executeManageDataRecipe,
  } from "$lib/services/appwrite-recipes";
  import { ingredientsToAppwrite } from "$lib/utils/ingredientUtils";
  import { astucesToAppwrite } from "$lib/utils/recipeUtils";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navigate, route } from "$lib/router";
  import { Save } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import RecipeHeaderForm from "$lib/components/recipeEdit/RecipeHeaderForm.svelte";
  import RecipePrepaForm from "$lib/components/recipeEdit/RecipePrepaForm.svelte";
  import RecipePermissionsManager from "$lib/components/recipeEdit/RecipePermissionsManager.svelte";
  import UnsavedChangesGuard from "$lib/components/ui/UnsavedChangesGuard.svelte";
  import { generateSlugUuid35 } from "$lib/utils/slugUtils";
  import { warmUpEnkaData } from "$lib/services/appwrite-warmup";
  import {
    type RecipeFormState,
    type ValidationError,
    createDefaultRecipe,
    transformStoreDataToForm,
    createRecipeSnapshot,
    normalizeRecipeForAppwrite,
    prepareHugoData,
    validateRecipe,
  } from "./RecipeEditPage";
  import { fade } from "svelte/transition";

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  const sourceRecipeId = $derived(route.params.uuid);

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  let recipe = $state<RecipeFormState | null>(null);
  let loaded = $state(false);
  let isSaving = $state(false);
  let initialRecipeSnapshot = $state<string | null>(null);
  let saveSuccessful = $state(false);

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

  const canEdit = $derived(true); // Toujours éditable en création

  // Données de référence depuis RecipeDataStore
  const recipeInfo = $derived.by(() => ({
    materiel: recipeDataStore.materiel,
    categories: recipeDataStore.categories,
    regimes: recipeDataStore.regimes,
  }));

  // ============================================================================
  // AUTO-EFFECTS
  // ============================================================================

  // Warm-up de la fonction enkaData
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

  // Initialiser la recette (mode création vs duplication)
  $effect(() => {
    if (loaded || !globalState.userId) return;

    // Mode duplication : charger la recette source
    if (sourceRecipeId && !loaded && !isSaving) {
      isSaving = true;
      recipesStore
        .getRecipeByUuid(sourceRecipeId)
        .then(async (data) => {
          if (data) {
            const userName = globalState.userName || "utilisateur";

            // Trouver la racine de la recette source
            const rootRecipeId = data.rootRecipeId || data.$id;

            // Récupérer les variantes existantes pour générer le numéro de version
            const variantGroup =
              await recipesStore.getVariantGroup(sourceRecipeId);
            const nextVersion = variantGroup.variants.length + 1;
            const versionLabel = `v${nextVersion} - ${userName}`;

            recipe = transformStoreDataToForm(data, {
              title: data.title, // Title inchangé
              $id: "new-recipe",
              $createdAt: undefined,
              $updatedAt: undefined,
              lockedBy: null,
              createdBy: globalState.userId || "",
              permissionWrite: [globalState.userId || ""],
              check: null,
              draft: true,
              // Nouveaux champs de versionnage
              rootRecipeId: rootRecipeId,
              versionLabel: versionLabel,
            });
            loaded = true;
          } else {
            toastService.error("Recette source introuvable");
            navigate("/recipe");
          }
        })
        .catch((error) => {
          console.error("Erreur chargement:", error);
          toastService.error("Erreur lors du chargement");
          navigate("/recipe");
        })
        .finally(() => {
          isSaving = false;
        });
      return;
    }

    // Mode création : initialiser avec la recette par défaut
    if (!sourceRecipeId && !loaded) {
      recipe = {
        ...createDefaultRecipe(),
        $id: "new-recipe",
      } as RecipeFormState;
      loaded = true;
      return;
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

  const navTitle = $derived(
    sourceRecipeId ? "Nouvelle version de recette" : "Nouvelle recette",
  );

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
      // Générer l'ID de la recette avec le versionLabel si présent
      recipe.$id = generateSlugUuid35(
        recipe.title,
        recipe.versionLabel || undefined,
      );

      // Normaliser les types UI vers types Appwrite
      const normalized = normalizeRecipeForAppwrite(recipe);

      const recipeToCreate: any = {
        ...normalized,
        ingredients: ingredientsToAppwrite(recipe.ingredients),
        astuces: astucesToAppwrite(recipe.astuces),
        prepAlt: recipe.prepAlt,
      };

      const created = await createRecipeAppwrite(
        recipeToCreate,
        globalState.userId,
      );
      toastService.update(toastId, {
        state: "success",
        message: "Recette créée avec succès !",
      });

      // Appel async pour synchroniser vers GitHub
      const hugoData = prepareHugoData(recipe, recipeToCreate, {
        id: created.$id,
        createdAt: created.$createdAt,
        updatedAt: created.$updatedAt,
        createdBy: created.createdBy,
      });

      executeManageDataRecipe(
        "save_recipe",
        created.$id,
        globalState.userId,
        hugoData,
        true,
      ).catch((error) => {
        console.error("Sync vers GitHub échouée:", error);
      });

      // Marquer la sauvegarde comme réussie pour le guard
      saveSuccessful = true;

      // Rediriger vers la page de détail de la nouvelle recette
      setTimeout(() => {
        navigate(`/recipe/${created.$id}`);
      }, 1500);
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toastService.update(toastId, {
        state: "error",
        message: "Erreur lors de la création",
      });
    } finally {
      isSaving = false;
      setTimeout(() => toastService.dismiss(toastId), 3000);
    }
  }
</script>

<!-- ============================================================================ -->
{#snippet navActions()}
  <div class="flex items-center gap-2">
    <!-- Save button -->
    <button
      onclick={save}
      disabled={isSaving || !isDirty}
      class="btn btn-primary btn-sm"
    >
      <Save class="h-4 w-4" />
      {isSaving ? "Sauvegarde..." : "Créer la recette"}
    </button>
  </div>
{/snippet}

<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div class="max-w-9xl container mx-auto px-4 py-8" in:fade>
  {#if !loaded}
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
    </div>
  {/if}
</div>

<!-- Guard de navigation pour modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey={sourceRecipeId
    ? `/recipe/${sourceRecipeId}/duplicate`
    : "/recipe/new"}
  shouldProtect={() => isDirty && !saveSuccessful}
  onLeaveWithoutSave={() => {}}
  onSaveAndLeave={async () => {
    // Sauvegarder et autoriser la navigation
    await save();
    // Le guard sera notifié du succès via saveSuccessful
  }}
  message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
/>
