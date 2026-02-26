<script lang="ts">
  import { Package, MapPin, Hash, X, Check } from "@lucide/svelte";
  import RadioBadgeGroup from "$lib/components/ui/RadioBadgeGroup.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";

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
  type MaterielStatusLiteral = "ok" | "lost" | "torepair";

  interface MaterielInitialValues {
    name: string;
    description: string | null;
    type: MaterielTypeLiteral | null;
    status: MaterielStatusLiteral;
    quantity: number;
    location: string | null;
    shareableWith: string[] | null;
  }

  interface Props {
    showStatus?: boolean;
    buttonAction?: boolean;
    ownerId?: string; // Optionnel : si fourni, pré-remplit l'owner (teamId)
    ownerName?: string; // Optionnel : nom de l'owner pour l'affichage
    initialValues?: MaterielInitialValues | null; // Optionnel : valeurs initiales pour l'édition
    onSubmit?: (data: {
      name: string;
      description: string | null;
      type: MaterielTypeLiteral | null;
      status: MaterielStatusLiteral;
      quantity: number;
      location: string | null;
      shareableWith: string[] | null;
      owner: string; // JSON string
    }) => void;
    onCancel?: () => void;
  }

  let {
    showStatus = false,
    onSubmit,
    onCancel,
    buttonAction = true,
    ownerId,
    ownerName,
    initialValues,
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
  let status = $state<MaterielStatusLiteral>(initialValues?.status || "ok");
  // svelte-ignore state_referenced_locally
  let quantity = $state(initialValues?.quantity || 1);
  // svelte-ignore state_referenced_locally
  let location = $state(initialValues?.location || "");
  // svelte-ignore state_referenced_locally
  let shareableWithTeamNames = $state<string[]>(
    initialValues?.shareableWith || [],
  );

  let loading = $state(false);
  let error = $state<string | null>(null);

  // L'owner est-il verrouillé (pré-rempli depuis les props) ?
  const isOwnerLocked = $derived(ownerId);

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

  const statusOptions = $derived([
    { id: "ok", label: "OK" },
    { id: "lost", label: "Perdu" },
    { id: "torepair", label: "À réparer" },
  ]);

  // Options d'équipes pour owner
  const teamOptions = $derived(
    nativeTeamsStore.myTeams.map((t) => ({ id: t.$id, name: t.name })),
  );

  // Options d'équipes pour shareableWith (BadgeItem format)
  const shareableWithTeamOptions = $derived(
    nativeTeamsStore.myTeams.map((t) => ({
      id: t.$id,
      label: t.name,
      selected: shareableWithTeamNames.includes(t.$id),
    })),
  );

  // Objet owner JSON - uniquement pour les teams
  const ownerJson = $derived.by(() => {
    // Si l'owner est verrouillé via les props, les utiliser
    if (isOwnerLocked && ownerId) {
      return JSON.stringify({
        teamName: ownerName || "",
        teamId: ownerId,
      });
    }

    // Sinon, retourner un owner vide (ne devrait pas arriver en mode normal)
    return JSON.stringify({
      teamName: "",
      teamId: "",
    });
  });

  // Validation
  const isValid = $derived(name.trim().length > 0 && quantity >= 1 && !loading);

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
      status,
      quantity,
      location: location.trim() || null,
      shareableWith:
        shareableWithTeamNames.length > 0 ? shareableWithTeamNames : null,
      owner: ownerJson, // JSON string déjà construit
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
    status = "ok";
    quantity = 1;
    location = "";
    shareableWithTeamNames = [];
    error = null;
  }
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
      <label class="input min-w-1/2">
        <span class="label required"
          ><Package class="h-4 w-4 " />
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
        class="textarea textarea-bordered w-full"
        rows="2"
        bind:value={description}
        placeholder="Décrivez le matériel..."
        maxlength="500"
        disabled={loading}
      ></textarea>
    </fieldset>
  </div>

  <!-- Section 3: Type + Status + Quantité + Localisation -->
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

    <!-- Status -->
    {#if showStatus}
      <div class="flex min-w-[200px] flex-1 flex-col gap-1">
        <span class="label-text-alt text-base-content/70">Status</span>
        <RadioBadgeGroup
          items={statusOptions}
          bind:selected={status}
          size="sm"
          disabled={loading}
        />
      </div>
    {/if}
  </div>

  <div class="flex flex-1 flex-wrap gap-x-6 gap-y-4">
    <!-- Quantité -->
    <label class="input w-58">
      <span class="label required"> <Hash class="size-4" />Quantité</span>
      <input
        type="number"
        class=""
        min="1"
        bind:value={quantity}
        disabled={loading}
        required
        aria-required="true"
      />
    </label>

    <!-- Localisation -->
    <label class="input flex-1">
      <span class="label"><MapPin class="size-4" />Localisation</span>
      <input
        type="text"
        class="grow"
        bind:value={location}
        placeholder="où c'est stocker"
        maxlength="50"
        disabled={loading}
      />
    </label>
  </div>

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
    <div class="alert alert-error alert-sm">
      <span class="text-sm">{error}</span>
    </div>
  {/if}
</div>
<div>
  <!-- Boutons -->
  {#if buttonAction}
    <div class="ms-auto mt-8 flex justify-end gap-2">
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
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Check class="h-5 w-5" />
        {/if}
        Enregistrer
      </button>
    </div>
  {/if}
</div>
