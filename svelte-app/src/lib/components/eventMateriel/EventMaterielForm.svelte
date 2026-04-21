<script lang="ts">
  import type { EventMateriel } from "$lib/types/appwrite";
  import type {
    CreateEventMaterielData,
    EventMaterielType,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
   import {
     Hash,
     MapPin,
     Package,
     Shapes,
     User,
     CircleDot,
     CircleAlert,
   } from "@lucide/svelte";
   import { toastService } from "$lib/services/toast.service.svelte";
   import MaterielNameSuggest from "$lib/components/eventMateriel/MaterielNameSuggest.svelte";

  import {
    getEventMaterielStatusConfig,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";

  export type FormMode = "header" | "item" | "allocation";

  interface Props {
    eventId: string;
    initialData?: EventMateriel | null;
    onSubmit: (data: CreateEventMaterielData) => Promise<void>;
    onCancel: () => void;
    onDelete?: (() => void) | null;
    canEditWhere?: boolean;
    mode?: FormMode;
    submitting?: boolean;
    errors?: string[];
    dirty?: boolean;
    onExistingSelected?: ((itemId: string) => void) | null;
  }

  let {
    eventId,
    initialData = null,
    onSubmit,
    onCancel,
    onDelete = null,
    canEditWhere = true,
    mode = "item",
    submitting = $bindable(false),
    errors = $bindable([]),
    dirty = $bindable(false),
    onExistingSelected = null,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(initialData?.name || "");
  // svelte-ignore state_referenced_locally
  let quantity = $state(initialData?.quantity || 1);
  // svelte-ignore state_referenced_locally
  let type = $state<EventMaterielType>(
    (initialData?.type as EventMaterielType) || "other",
  );
  // svelte-ignore state_referenced_locally
  let status = $state<EventMaterielStatus>(
    (initialData?.status as EventMaterielStatus) || "to_find",
  );
  // svelte-ignore state_referenced_locally
  let who = $state(initialData?.who || "");
  // svelte-ignore state_referenced_locally
  let where = $state(initialData?.where || "");
  // svelte-ignore state_referenced_locally
  let notes = $state(initialData?.notes || "");

  let attempted = $state(false);

  const isEdit = $derived(!!initialData);

  // svelte-ignore state_referenced_locally
  const origName = initialData?.name || "";
  // svelte-ignore state_referenced_locally
  const origQuantity = initialData?.quantity || 1;
  // svelte-ignore state_referenced_locally
  const origType = (initialData?.type as EventMaterielType) || "other";
  // svelte-ignore state_referenced_locally
  const origStatus = (initialData?.status as EventMaterielStatus) || "to_find";
  // svelte-ignore state_referenced_locally
  const origWho = initialData?.who || "";
  // svelte-ignore state_referenced_locally
  const origWhere = initialData?.where || "";
  // svelte-ignore state_referenced_locally
  const origNotes = initialData?.notes || "";

  $effect(() => {
    dirty =
      name !== origName ||
      quantity !== origQuantity ||
      type !== origType ||
      status !== origStatus ||
      who !== origWho ||
      where !== origWhere ||
      notes !== origNotes;
  });

  const showStatus = $derived(mode !== "header");
  const needsSource = $derived(mode !== "header" && status !== "to_find");
  const showWho = $derived(mode !== "header");
  const showWhere = $derived(mode !== "header");

  const whoOrWhereError = $derived(
    attempted && needsSource && !who.trim() && !where.trim(),
  );
  const whoError = $derived(whoOrWhereError && !who.trim());
  const whereError = $derived(whoOrWhereError && !where.trim());

  const statusClass = $derived(
    getEventMaterielStatusConfig(status).selectClass,
  );

  const types: { value: EventMaterielType; label: string }[] = [
    "other",
    "electronic",
    "manual",
    "tools",
    "dish",
    "cooking",
    "gaz",
    "hygiene",
  ].map((t) => ({
    value: t as EventMaterielType,
    label: getMaterielTypeConfig(t).label,
  }));

  const statuses: { value: EventMaterielStatus; label: string }[] = [
    "to_find",
    "to_check",
    "confirmed",
  ].map((s) => ({
    value: s as EventMaterielStatus,
    label: getEventMaterielStatusConfig(s).label,
  }));

  const validationErrors = $derived.by(() => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Le nom est requis.");
    if (quantity < 1) errs.push("La quantité doit être ≥ 1.");
    if (needsSource && !who.trim() && !where.trim()) {
      errs.push("Indiquez qui apporte le matériel ou d'où il vient.");
    }
    return errs;
  });

  const isValid = $derived(validationErrors.length === 0);

  function handleNameInput(val: string) {
    name = val;
  }

  function handleNameSelect(suggestion: {
    name: string;
    type: EventMaterielType;
    source?: string;
    itemId?: string;
  }) {
    // Si c'est un header existant et qu'on a un callback → basculer en édition
    if (
      suggestion.source === "header" &&
      suggestion.itemId &&
      onExistingSelected
    ) {
      onExistingSelected(suggestion.itemId);
      return;
    }
    name = suggestion.name;
    type = suggestion.type;
  }

   async function handleSubmit(e: Event) {
     e.preventDefault();
     attempted = true;
     errors = validationErrors;
     if (!isValid) {
       validationErrors.forEach((err) => toastService.error(err));
       return;
     }
 
     submitting = true;

    try {
      await onSubmit({
        eventId,
        name: name.trim(),
        quantity,
        type,
        status,
        who: who.trim() || null,
        where: where.trim() || null,
        notes: notes.trim() || null,
      });
    } finally {
      submitting = false;
    }
  }

  export function getFormData(): CreateEventMaterielData {
    return {
      eventId,
      name: name.trim(),
      quantity,
      type,
      status,
      who: who.trim() || null,
      where: where.trim() || null,
      notes: notes.trim() || null,
    };
  }

  export function getIsEdit(): boolean {
    return isEdit;
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <div class="text-base-content/70 py-2 text-sm">
    {#if isEdit}
      <div class="mb-2">
        <strong>{initialData?.name}</strong>
        {#if mode === "allocation"}
          <span class="badge badge-info badge-xs ml-1">allocation</span>
        {:else}
          <span class="badge badge-warning badge-xs ml-1">besoin</span>
        {/if}
      </div>
      <p>
        Modifier les détails {#if mode === "allocation"}
          de l'apport
        {:else}
          concernant le besoin de ce matériel{/if}.
      </p>
    {:else}
      <p>Ajouter à la liste du matériel requis</p>
    {/if}
  </div>

  {#if isEdit}
    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><Package class="inline size-4" /> Nom</legend
      >
      <label class="input w-full">
        <Package class="h-4 w-4 opacity-50" />
        <input
          type="text"
          bind:value={name}
          placeholder="Nom * (ex: Table pliante)"
          class="grow"
          required
        />
      </label>
    </fieldset>
  {:else}
    <MaterielNameSuggest
      value={name}
      onSelect={handleNameSelect}
      onInput={handleNameInput}
    />
  {/if}

  <div class="grid grid-cols-1 gap-4">
    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><Hash class="inline size-4" /> Quantité {#if mode !== "allocation"}
          requise{/if}</legend
      >
      <label class="input w-full">
        <input
          type="number"
          min="1"
          bind:value={quantity}
          placeholder="Quantité"
          class="grow"
          required
        />
      </label>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><Shapes class="inline size-4" /> Type</legend
      >
      <select bind:value={type} class="select w-full">
        {#each types as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </fieldset>

    {#if showStatus}
      <fieldset class="fieldset">
        <legend class="fieldset-legend"
          ><CircleDot class="inline size-4" /> Statut</legend
        >
        <select bind:value={status} class="select w-full {statusClass}">
          {#each statuses as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </fieldset>
    {/if}

     {#if showWho}
       <fieldset class="fieldset">
         <legend class="fieldset-legend"
           ><User class="inline size-4" /> Qui ?</legend
         >
         <label class="input w-full {whoError ? 'input-error' : ''}">
           <User class="h-4 w-4 opacity-50" />
           <input
             type="text"
             bind:value={who}
             placeholder="Personne responsable"
             class="grow"
           />
         </label>
       </fieldset>
     {/if}


     {#if showWhere}
       <fieldset class="fieldset">
         <legend class="fieldset-legend"
           ><MapPin class="inline size-4" /> Où ?</legend
         >
         <label class="input w-full {whereError ? 'input-error' : ''}">
           <MapPin class="h-4 w-4 opacity-50" />
           <input
             type="text"
             bind:value={where}
             placeholder="Lieu de stockage"
             class="grow"
             disabled={!canEditWhere}
           />
         </label>
       </fieldset>
     {/if}


     <fieldset class="fieldset">
       <legend class="fieldset-legend">Notes</legend>
       <textarea
         rows="2"
         bind:value={notes}
         placeholder="Notes supplémentaires..."
         class="textarea w-full"
         maxlength="255"
       ></textarea>
     </fieldset>

  </div>

   {#if attempted && errors.length > 0}
     <!-- Les erreurs sont maintenant gérées par toastService -->
   {/if}
 </form>

