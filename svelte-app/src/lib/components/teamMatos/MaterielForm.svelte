<script lang="ts">
  import {
    Package,
    MapPin,
    Hash,
    X,
    Check,
    Trash2,
    Wrench,
  } from "@lucide/svelte";
  import RadioBadgeGroup from "$lib/components/ui/RadioBadgeGroup.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import TeamMaterielNameSuggest from "./TeamMaterielNameSuggest.svelte";
  import Suggestions from "$lib/components/ui/Suggestions.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";

  // Types littéraux pour éviter les erreurs TypeScript avec les enums
  type MaterielTypeLiteral =
    | "electronic"
    | "manual"
    | "other"
    | "tools"
    | "dish"
    | "cooking"
    | "gaz"
    | "hygiene"
    | "";

  interface MaterielInitialValues {
    id: string;
    name: string;
    description: string | null;
    type: MaterielTypeLiteral | null;
    quantity: number;
    repairQuantity: number;
    location: string | null;
    shareableWith: string[] | null;
  }

  interface Props {
    buttonAction?: boolean;
    ownerId?: string;
    ownerName?: string;
    initialValues?: MaterielInitialValues | null;
    teamId?: string;
    availableLocations?: string[];
    onSubmit?: (data: {
      name: string;
      description: string | null;
      type: MaterielTypeLiteral | null;
      quantity: number;
      location: string | null;
      shareableWith: string[] | null;
      teamId: string | null;
    }) => void;
    onCancel?: () => void;
    onExistingSelected?: (materielId: string) => void;
    onDelete?: (() => void) | null;
  }

  let {
    onSubmit,
    onCancel,
    buttonAction = true,
    ownerId,
    ownerName,
    initialValues,
    teamId,
    availableLocations = [],
    onExistingSelected,
    onDelete = null,
  }: Props = $props();

  // Import des composants UI
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import BadgeList from "../ui/BadgeList.svelte";

  // État du formulaire - initialisé avec initialValues si fournis
  // svelte-ignore state_referenced_locally
  let name = $state(initialValues?.name || "");
  // svelte-ignore state_referenced_locally
  let description = $state(initialValues?.description || "");
  // svelte-ignore state_referenced_locally
  let type = $state<MaterielTypeLiteral>(initialValues?.type || "");
  // svelte-ignore state_referenced_locally
  let quantity = $state(initialValues?.quantity ?? 1);
  // Exemplaires en réparation (édition) — snapshot décrémenté après chaque
  // geste réussi ; la vérité vit dans le store.
  // svelte-ignore state_referenced_locally
  let repairStock = $state(initialValues?.repairQuantity ?? 0);
  let gestureQuantity = $state(1);
  let gestureBusy = $state(false);
  // svelte-ignore state_referenced_locally
  let location = $state(initialValues?.location || "");
  // svelte-ignore state_referenced_locally
  let shareableWithTeamNames = $state<string[]>(
    initialValues?.shareableWith || [],
  );

  let loading = $state(false);
  let error = $state<string | null>(null);
  let showDeleteConfirm = $state(false);

  // L'owner est-il verrouillé (pré-rempli depuis les props) ?
  const isOwnerLocked = $derived(ownerId);

  const isEdit = $derived(!!initialValues);

  // Options pour les RadioBadgeGroups
  const typeOptions = $derived([
    { id: "electronic", label: "Électronique" },
    { id: "manual", label: "Ustensile" },
    { id: "tools", label: "Outils" },
    { id: "dish", label: "Vaisselle" },
    { id: "cooking", label: "Matériel de Cuisine" },
    { id: "gaz", label: "Gaz" },
    { id: "hygiene", label: "Hygiène" },
    { id: "other", label: "Autre" },
  ]);

  // Options d'équipes pour owner
  const teamOptions = $derived(
    nativeTeamsStore.myTeams.map((t) => ({ id: t.id, name: t.name })),
  );

  // Options d'équipes pour shareableWith (BadgeItem format)
  const shareableWithTeamOptions = $derived(
    nativeTeamsStore.myTeams.map((t) => ({
      id: t.id,
      label: t.name,
      selected: shareableWithTeamNames.includes(t.id),
    })),
  );

  // Validation
  // En création le stock commence à 1 ; en édition 0 est valide (rebut
  // re-sauvable — l'item reste visible mais n'est plus empruntable).
  const isValid = $derived(
    name.trim().length > 0 &&
      quantity >= (isEdit ? 0 : 1) &&
      !loading &&
      !gestureBusy,
  );

  // Gestion du toggle d'équipe pour shareableWith
  function handleShareableWithToggle(teamId: string) {
    if (shareableWithTeamNames.includes(teamId)) {
      shareableWithTeamNames = shareableWithTeamNames.filter(
        (id) => id !== teamId,
      );
    } else {
      shareableWithTeamNames = [...shareableWithTeamNames, teamId];
    }
  }

  // Soumission
  function handleSubmit() {
    if (!isValid) return;

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      type: type || "other", // "other" par défaut si non renseigné
      quantity,
      location: location.trim() || null,
      shareableWith:
        shareableWithTeamNames.length > 0 ? shareableWithTeamNames : null,
      teamId: ownerId || null,
    };

    onSubmit?.(data);
  }

  function handleCancel() {
    onCancel?.();
  }

  function resetForm() {
    name = "";
    description = "";
    type = "";
    quantity = 1;
    location = "";
    shareableWithTeamNames = [];
    error = null;
  }

  /** Quantité du geste valide : entière, entre 1 et le stock en réparation. */
  const isGestureQuantityValid = $derived(
    Number.isInteger(gestureQuantity) &&
      gestureQuantity >= 1 &&
      gestureQuantity <= repairStock,
  );

  /**
   * Remise en service / réforme des exemplaires en réparation (ADR 0003) :
   * la garde fine (1 ≤ n ≤ repairQuantity) vit dans le store et lève sans
   * écriture ; après un succès constaté, le snapshot du formulaire est relu
   * du store (quantity ET repairQuantity) — nouvelle baseline : « Enregistrer »
   * soumet l'état post-geste, jamais celui d'ouverture.
   */
  async function handleRepairGesture(scrap: boolean) {
    if (!initialValues || !isGestureQuantityValid || gestureBusy) return;
    const n = gestureQuantity;
    gestureBusy = true;
    try {
      await toastService.track(
        scrap
          ? materielStore.scrapUnits(initialValues.id, n)
          : materielStore.returnToService(initialValues.id, n),
        {
          loading: "Opération en cours...",
          success: scrap
            ? `${n} exemplaire${n > 1 ? "s" : ""} réformé${n > 1 ? "s" : ""} — retiré${n > 1 ? "s" : ""} du stock`
            : `${n} exemplaire${n > 1 ? "s" : ""} remis${n > 1 ? "s" : ""} en service`,
          error: (err) => (err instanceof Error ? err.message : undefined),
        },
      );
      // Resync sur la vérité du store : le geste a réécrit quantity et
      // repairQuantity sous le formulaire — soumettre l'état d'ouverture
      // restaurerait silencieusement ce que le geste a retiré (le décrément
      // de réforme est définitif). La relecture suit un tour de macrotâche :
      // l'update est optimiste (Dexie déjà écrit) et la liveQuery propage en
      // microtâches. Item absent du cache : miroir local du geste, même
      // arithmétique que le store.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const fresh = materielStore.getMaterielById(initialValues.id);
      if (fresh) {
        repairStock = fresh.repairQuantity ?? 0;
        if (fresh.quantity !== null) quantity = fresh.quantity;
      } else {
        repairStock = Math.max(0, repairStock - n);
        if (scrap) quantity = Math.max(0, quantity - n);
      }
      gestureQuantity = 1;
    } catch {
      // Erreur déjà toastée par track ; le formulaire reste ouvert.
    } finally {
      gestureBusy = false;
    }
  }

  function handleNameInput(val: string) {
    name = val;
  }

  function handleNameSelect(suggestion: {
    name: string;
    type: string;
    source?: string;
    materielId?: string;
  }) {
    if (
      suggestion.source === "existing" &&
      suggestion.materielId &&
      onExistingSelected
    ) {
      onExistingSelected(suggestion.materielId);
      return;
    }
    name = suggestion.name;
    type = suggestion.type as MaterielTypeLiteral;
  }

  const locationSuggestionItems = $derived(
    availableLocations
      .filter((l) => l !== location)
      .map((l) => ({ id: l, label: l })),
  );
</script>

<div class="space-y-6">
  <div class="text-lg font-medium">
    Ajouter du matériel a l'inventaire de <span class="font-bold italic"
      >{ownerName}</span
    >
  </div>
  <!-- Section 1: Nom + Description -->
  <div class="space-y-3">
    <div class="flex flex-wrap gap-x-6 gap-y-4">
      <!-- Nom -->
      {#if isEdit}
        <label class="input min-w-1/2">
          <span class="required label"
            ><Package class="h-4 w-4" />
            Nom</span
          >
          <input
            type="text"
            class="grow"
            bind:value={name}
            placeholder="Ex: Mixeur professionnel"
            maxlength="100"
            disabled={loading}
            required
            aria-required="true"
          />
        </label>
      {:else}
        <div class="min-w-1/2">
          <TeamMaterielNameSuggest
            value={name}
            onSelect={handleNameSelect}
            onInput={handleNameInput}
            teamId={teamId || ownerId || ""}
          />
        </div>
      {/if}

      <!-- owner -->
      <!-- <label class="select min-w-[250px]">
        <span class="l required">Propriétaire</span>
        <select
          class="w-full"
          bind:value={selectedOwnerId}
          disabled={loading}
          required
        >
          {#each ownerOptions as ownerOpt (ownerOpt.id)}
            <option value={ownerOpt.id}>{ownerOpt.name}</option>
          {/each}
        </select>
      </label> -->
    </div>
    <!-- Description -->
    <fieldset class="fieldset bg-base-100">
      <legend class="fieldset-legend">Description</legend>
      <textarea
        class="textarea-bordered textarea w-full"
        rows="2"
        bind:value={description}
        placeholder="Décrivez le matériel..."
        maxlength="500"
        disabled={loading}></textarea>
    </fieldset>
  </div>

  <!-- Section 3: Type + Quantité + Localisation -->
  <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
    <!-- Type -->
    <div class="flex min-w-[200px] flex-1 flex-col gap-1">
      <span class="label-text-alt text-base-content/70">Type</span>
      <RadioBadgeGroup
        items={typeOptions}
        bind:selected={type}
        size="sm"
        disabled={loading}
      />
    </div>
  </div>

  <div class="flex flex-1 flex-wrap gap-x-6 gap-y-4">
    <!-- Quantité -->
    <div>
      <label class="input w-58">
        <span class="required label"> <Hash class="size-4" />Quantité</span>
        <input
          type="number"
          class=""
          min={isEdit ? 0 : 1}
          bind:value={quantity}
          disabled={loading}
          required
          aria-required="true"
        />
      </label>
      {#if isEdit}
        <p class="text-base-content/60 mt-1 text-xs">
          0 = au rebut : l'item reste visible mais n'est plus empruntable
        </p>
      {/if}
    </div>

    <!-- Localisation -->
    <div class="flex flex-1 flex-col gap-1">
      <label class="input w-full">
        <MapPin class="h-4 w-4 opacity-50" />
        <input
          type="text"
          bind:value={location}
          placeholder="Où c'est stocké"
          maxlength="50"
          disabled={loading}
        />
      </label>
      {#if locationSuggestionItems.length > 0}
        <Suggestions
          suggestions={locationSuggestionItems}
          onSuggestionClick={(s) => (location = s.label)}
          buttonSize="btn-xs"
        />
      {/if}
    </div>
  </div>

  <!-- Réparation (édition) : fermeture de cycle des exemplaires abîmés -->
  {#if isEdit && repairStock > 0}
    <fieldset class="fieldset bg-base-100">
      <legend class="fieldset-legend">En réparation</legend>
      <p class="mb-2 text-sm opacity-70">
        {repairStock}
        exemplaire(s) en réparation. Remettez-les en service une fois réparés, ou
        réformez-les s'ils sont irréparables (ils quittent alors définitivement le
        stock).
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <label class="input w-28">
          <span class="label"><Hash class="size-4" />Quantité</span>
          <input
            type="number"
            min="1"
            max={repairStock}
            bind:value={gestureQuantity}
            disabled={loading || gestureBusy}
            aria-label="Quantité concernée par le geste"
          />
        </label>
        <button
          class="btn btn-outline btn-success btn-sm"
          onclick={() => handleRepairGesture(false)}
          disabled={loading || gestureBusy || !isGestureQuantityValid}
        >
          <Wrench class="size-4" />
          Remettre en service
        </button>
        <button
          class="btn btn-outline btn-error btn-sm"
          onclick={() => handleRepairGesture(true)}
          disabled={loading || gestureBusy || !isGestureQuantityValid}
        >
          <Trash2 class="size-4" />
          Réformer
        </button>
      </div>
    </fieldset>
  {/if}

  <!-- Section 4: ShareableWith -->
  <!-- <fieldset class="fieldset bg-base-100">
    <legend class="fieldset-legend">Partageable avec</legend>
    <div class="space-y-2">
      <p class="text-sm opacity-70">
        Les équipes sélectionnées pourront voir / emprunter ce matériel
      </p>
      <BtnGroupCheck
        items={shareableWithTeamOptions}
        onToggleItem={handleShareableWithToggle}
        size="lg"
        color="primary"
      />
    </div>
  </fieldset> -->

  <!-- Message d'erreur -->
  {#if error}
    <div class="alert-sm alert alert-error">
      <span class="text-sm">{error}</span>
    </div>
  {/if}
</div>
<div>
  <!-- Boutons -->
  {#if buttonAction}
    <div class="mt-8 flex items-center gap-2">
      {#if isEdit && onDelete}
        <button
          class="btn btn-ghost text-error"
          onclick={() => (showDeleteConfirm = true)}
          disabled={loading}
          title="Supprimer"
        >
          <Trash2 class="h-5 w-5" />
          <span class="hidden md:inline">Supprimer</span>
        </button>
      {/if}
      <div class="ms-auto flex gap-2">
        <button class="btn btn-ghost" onclick={handleCancel} disabled={loading}>
          <X class="h-5 w-5" />
          Annuler
        </button>
        <button
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={!isValid}
        >
          {#if loading}
            <span class="loading loading-sm loading-spinner"></span>
          {:else}
            <Check class="h-5 w-5" />
          {/if}
          Enregistrer
        </button>
      </div>
    </div>
  {/if}
</div>

{#if isEdit && onDelete}
  <ConfirmModal
    isOpen={showDeleteConfirm}
    title="Supprimer le matériel"
    message="Supprimer « {name} » de l'inventaire ?"
    variant="danger"
    confirmLabel="Supprimer"
    onConfirm={() => {
      showDeleteConfirm = false;
      onDelete?.();
    }}
    onCancel={() => (showDeleteConfirm = false)}
  />
{/if}
