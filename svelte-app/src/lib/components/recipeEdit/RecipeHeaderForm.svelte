<script lang="ts">
  import { RecettesTypeR } from "$lib/types/recipes.types";
  import MultiSelect from "$lib/components/ui/MultiSelect.svelte";
  import CreateMaterielModal from "$lib/components/recipeEdit/CreateMaterielModal.svelte";
  import CreateCategoryModal from "$lib/components/recipeEdit/CreateCategoryModal.svelte";
  import {
    BookOpen,
    Utensils,
    FileText,
    ChefHat,
    Thermometer,
    Flame,
    MapPin,
  } from "@lucide/svelte";

  interface Props {
    recipe: any;
    recipeInfo: any;
    validationErrors: any;
    canEdit: boolean;
  }

  let {
    recipe = $bindable(),
    recipeInfo,
    validationErrors,
    canEdit,
  }: Props = $props();

  // État des modals de création
  let showCreateMaterielModal = $state(false);
  let showCreateCategoryModal = $state(false);

  // Handlers pour créer du matériel
  function handleCreateMateriel() {
    showCreateMaterielModal = true;
  }

  function handleMaterielCreated(newMateriel: string) {
    // Ajouter automatiquement à la sélection
    if (!recipe.materiel) {
      recipe.materiel = [];
    }
    recipe.materiel = [...recipe.materiel, newMateriel];
  }

  // Handlers pour créer une catégorie
  function handleCreateCategory() {
    showCreateCategoryModal = true;
  }

  function handleCategoryCreated(newCategory: string) {
    // Ajouter automatiquement à la sélection
    if (!recipe.categories) {
      recipe.categories = [];
    }
    recipe.categories = [...recipe.categories, newCategory];
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title mb-4">
      <BookOpen class="h-5 w-5" />
      Informations générales
    </h2>

    <div class="flex flex-col gap-4">
      <!-- Titre et description -->
      <div class="flex flex-col gap-x-10 gap-y-2">
        <div class="flex flex-wrap items-start gap-x-10">
          <!-- Titre -->
          <fieldset class="fieldset min-w-3/5 flex-1">
            <legend class="fieldset-legend required">Titre de la recette</legend
            >
            <label
              class="input input-lg w-full {validationErrors.title
                ? 'input-error'
                : ''}"
            >
              <BookOpen class="h-4 w-4 opacity-50" />
              <input
                id="recipe-title"
                type="text"
                bind:value={recipe.title}
                placeholder="Ex: Houmous maison"
                disabled={!canEdit}
                maxlength="80"
                aria-describedby="title-help"
                aria-required="true"
              />
            </label>
            <div class="fieldset-label" id="title-help">
              {#if validationErrors.title}
                <span class="text-error">{validationErrors.title}</span>
              {/if}
              <span class="fieldset-label ms-auto italic"
                >{recipe.title?.length || 0}/80 caractères</span
              >
            </div>
          </fieldset>

          <!-- Version input -->
          {#if canEdit}
            {#if recipe.versionLabel}
              {@const versionNumber = recipe.versionLabel.match(/^v(\d+)/)
                ? parseInt(recipe.versionLabel.match(/^v(\d+)/)[1])
                : null}
              {#if versionNumber}
                <fieldset class="fieldset min-w-1/5">
                  <legend class="fieldset-legend">Version</legend>
                  <label class="input input-lg w-full">
                    <span class="badge badge-ghost font-mono"
                      >v{versionNumber}</span
                    >
                    <span class="px-1 opacity-40">-</span>
                    <input
                      type="text"
                      value={recipe.versionLabel.replace(/^v\d+\s*-\s*/, "")}
                      oninput={(e) => {
                        const input = e.target as HTMLInputElement;
                        let newValue = input.value.toLowerCase().trim();
                        recipe.versionLabel = `v${versionNumber} - ${newValue}`;
                      }}
                      placeholder="username"
                      maxlength="20"
                      class="grow font-mono text-sm"
                    />
                  </label>
                  <p
                    class="fieldset-label truncate"
                    title="ex: &quot;économique&quot;, &quot;sans fromages&quot;, &quot;plus rapide&quot;..."
                  >
                    ex: "économique", "sans fromages", "plus rapide"...
                  </p>
                  {#if validationErrors.versionLabel}
                    <span class="text-error text-wrap"
                      >{validationErrors.versionLabel}</span
                    >
                  {/if}
                </fieldset>
              {/if}
            {/if}
          {:else if recipe.versionLabel}
            <span class="badge badge-secondary badge-lg h-full">
              {recipe.versionLabel}
            </span>
          {/if}
        </div>

        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend">Description</legend>
          <input
            type="text"
            name="description"
            id="description"
            maxlength="200"
            bind:value={recipe.description}
            placeholder="Brève description de la recette"
            disabled={!canEdit}
            class="input w-full {validationErrors.description
              ? 'input-error'
              : ''}"
          />
          <span class="fieldset-label">
            <span class="ms-auto italic"
              >{recipe.description?.length || 0}/200 caractères</span
            >
            {#if validationErrors.description}
              <span class="text-error">{validationErrors.description}</span>
            {/if}
          </span>
        </fieldset>
      </div>

      <div class="flex flex-wrap justify-between gap-10">
        <div class="flex flex-wrap gap-x-10 gap-y-2">
          <fieldset class="fieldset">
            <legend class="fieldset-legend required">Nombre de couverts</legend>
            <label class="input {validationErrors.plate ? 'input-error' : ''}">
              <Utensils class="h-4 w-4 opacity-50" />
              <input
                id="recipe-plate"
                type="number"
                bind:value={recipe.plate}
                min="1"
                max="80000"
                disabled={!canEdit}
                aria-describedby="plate-help"
                aria-required="true"
              />
            </label>
            <div class="fieldset-label" id="plate-help">
              <span class="italic">Quantités indiquées pour combien ?</span>
              {#if validationErrors.plate}
                <span class="text-error">{validationErrors.plate}</span>
              {/if}
            </div>
          </fieldset>

          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend">Description des quantités</legend>
            <label
              class="input w-full min-w-lg {validationErrors.quantite_desc
                ? 'input-error'
                : ''}"
            >
              <FileText class="h-4 w-4 opacity-50" />
              <input
                id="recipe-quantite-desc"
                type="text"
                bind:value={recipe.quantite_desc}
                placeholder="Ex: '24 parts par gastro'; '2 beignets/personne' ..."
                disabled={!canEdit}
                maxlength="100"
              />
            </label>
            <div class="fieldset-label">
              {#if validationErrors.quantite_desc}
                <span class="text-error">{validationErrors.quantite_desc}</span>
              {/if}
              <span class="ms-auto italic"
                >{recipe.quantite_desc?.length || 0}/100 caractères</span
              >
            </div>
          </fieldset>
        </div>
      </div>

      <!-- Type et Catégories -->
      <div class="flex flex-col gap-x-10 gap-y-2 sm:flex-row sm:items-start">
        <fieldset class="fieldset sm:w-auto">
          <legend class="fieldset-legend required">Type de recette</legend>
          <label class="select {validationErrors.typeR ? 'select-error' : ''}">
            <ChefHat class="h-4 w-4 opacity-50" />
            <select
              id="recipe-type"
              bind:value={recipe.typeR}
              disabled={!canEdit}
              aria-describedby="type-help"
            >
              <option value="" disabled selected>Sélectionner un type</option>
              <option value={RecettesTypeR.ENTREE}>Entrée</option>
              <option value={RecettesTypeR.PLAT}>Plat</option>
              <option value={RecettesTypeR.DESSERT}>Dessert</option>
              <option value={RecettesTypeR.AUTRE}>Autre</option>
            </select>
          </label>
          {#if validationErrors.typeR}
            <div class="fieldset-label">
              <span class="text-error">{validationErrors.typeR}</span>
            </div>
          {/if}
        </fieldset>

        <div class="flex-1 sm:max-w-md">
          {#if recipeInfo && recipeInfo.categories && recipe.categories}
            <MultiSelect
              options={recipeInfo.categories}
              bind:selected={recipe.categories}
              label="Sous-Catégories"
              placeholder="Rechercher une catégorie..."
              disabled={!canEdit}
              closeOnSelect={true}
              onCreateNew={handleCreateCategory}
              createLabel="Créer une catégorie..."
            />
          {/if}
        </div>
      </div>

      <!-- Température et Cuisson -->
      <div class="flex flex-col gap-x-10 gap-y-2 sm:flex-row sm:items-start">
        <fieldset class="fieldset flex-1 sm:max-w-xs">
          <legend class="fieldset-legend required">
            <Thermometer class="h-4 w-4" />
            <span>Température de service</span>
          </legend>
          <label
            class="select w-full {validationErrors.serveHot
              ? 'select-error'
              : ''}"
          >
            <select
              id="recipe-servehot"
              bind:value={recipe.serveHot}
              disabled={!canEdit}
            >
              <option value="" disabled selected>--</option>
              <option value={true}>Chaud</option>
              <option value={false}>Froid</option>
            </select>
          </label>
          {#if validationErrors.serveHot}
            <div class="fieldset-label">
              <span class="text-error">{validationErrors.serveHot}</span>
            </div>
          {/if}
        </fieldset>

        <fieldset class="fieldset flex-1 sm:max-w-xs">
          <legend class="fieldset-legend required">
            <Flame class="h-4 w-4" />
            <span>Nécessite une cuisson</span>
          </legend>
          <label
            class="select w-full {validationErrors.cuisson
              ? 'select-error'
              : ''}"
          >
            <select
              id="recipe-cuisson"
              bind:value={recipe.cuisson}
              disabled={!canEdit}
            >
              <option value="" disabled selected>--</option>
              <option value={true}>Oui</option>
              <option value={false}>Non</option>
            </select>
          </label>
          {#if validationErrors.cuisson}
            <div class="fieldset-label">
              <span class="text-error">{validationErrors.cuisson}</span>
            </div>
          {/if}
        </fieldset>
      </div>

      <!-- Le reste -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <!-- Saison -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Saisons</legend>
          <div class="flex flex-wrap gap-2">
            {#each [{ value: "printemps", label: "Printemps" }, { value: "ete", label: "Été" }, { value: "automne", label: "Automne" }, { value: "hiver", label: "Hiver" }] as season (season.value)}
              <label class="flex cursor-pointer items-center gap-1">
                <input
                  type="checkbox"
                  bind:group={recipe.saison}
                  value={season.value}
                  disabled={!canEdit}
                  class="checkbox checkbox-sm"
                />
                <span class="text-sm">{season.label}</span>
              </label>
            {/each}
          </div>
          <div class="fieldset-label italic">
            Si certains ingrédients ne se trouvent qu'à certaines saisons...
          </div>
        </fieldset>

        <!-- Spécialité -->
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend">Spécialité</legend>
          <label class="input {validationErrors.region ? 'input-error' : ''}">
            <MapPin class="h-4 w-4 opacity-50" />
            <input
              id="recipe-region"
              type="text"
              bind:value={recipe.region}
              placeholder="Ex: Basque, Italien"
              disabled={!canEdit}
              maxlength="50"
            />
          </label>
          {#if validationErrors.region}
            <div class="fieldset-label">
              <span class="text-error">{validationErrors.region}</span>
            </div>
          {/if}
        </fieldset>

        <!-- Matériel nécessaire -->
        {#if recipeInfo && recipeInfo.materiel}
          <div class="lg:col-span-1">
            <MultiSelect
              options={recipeInfo.materiel}
              bind:selected={recipe.materiel}
              label="Matériel nécessaire"
              placeholder="Rechercher du matériel..."
              disabled={!canEdit}
              closeOnSelect={true}
              onCreateNew={handleCreateMateriel}
              createLabel="Créer ..."
            />
          </div>
        {/if}
      </div>
      <div
        id="recipe-check-fieldset"
        class=" my-4 flex w-full flex-wrap space-y-6 rounded-xl border p-4 {validationErrors.check
          ? 'border-error'
          : 'border-base-300'}"
      >
        <div class="flex w-full flex-wrap gap-x-6 gap-y-2">
          <div class="required">
            Avez-vous testé la recette pour le nombre de couverts indiqué ?
          </div>
          <div class="flex gap-4">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="check"
                checked={recipe?.check === true}
                onchange={() => recipe && (recipe.check = true)}
                disabled={!canEdit}
                class="radio radio-primary radio-sm"
              />
              <span class="text-sm">Oui</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="check"
                checked={recipe?.check === false}
                onchange={() => recipe && (recipe.check = false)}
                disabled={!canEdit}
                class="radio radio-primary radio-sm"
              />
              <span class="text-sm">Non</span>
            </label>
          </div>
        </div>
        {#if validationErrors.check}
          <div class="fieldset-label">
            <span class="text-error">{validationErrors.check}</span>
          </div>
        {/if}
        <label class="flex w-full cursor-pointer gap-3">
          <input
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm mt-1"
            bind:checked={recipe.draft}
            disabled={!canEdit || recipe.check !== true}
          />
          <div class="flex flex-col">
            <p class="text-sm font-medium">Brouillon</p>
            <p class="opacity-70">
              Les brouillons sont visibles uniquement pour les utilisateur·ices
              inscrite, mais peuvent tout de même être ajoutés à vos événements.
              Le status "brouillon" vous permettra de retrouver facilement les
              recettes que vous n'avez pas finalisé.
            </p>
            {#if recipe.check !== true}
              <p class="text-warning/70">
                Une recette non testée est forcément conservée en brouillon.
              </p>
            {/if}
          </div>
        </label>
      </div>
    </div>
  </div>
</div>

<!-- Modals de création -->
<CreateMaterielModal
  bind:open={showCreateMaterielModal}
  onMaterielCreated={handleMaterielCreated}
/>

<CreateCategoryModal
  bind:open={showCreateCategoryModal}
  onCategoryCreated={handleCategoryCreated}
/>
