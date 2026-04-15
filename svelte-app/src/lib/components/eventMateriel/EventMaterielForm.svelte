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
  import MaterielNameSuggest from "$lib/components/eventMateriel/MaterielNameSuggest.svelte";

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
  const showWho = $derived(mode !== "header" && (status !== "to_find" || attempted));
  const showWhere = $derived(mode !== "header" && status !== "to_find");

  const statusClass = $derived(
    status === "confirmed"
      ? "select-success text-success"
      : status === "to_check"
        ? "select-warning text-warning"
        : "select-error text-error",
  );

  const types: { value: EventMaterielType; label: string }[] = [
    { value: "other", label: "Autre" },
    { value: "electronic", label: "Électronique" },
    { value: "manual", label: "Manuel" },
    { value: "tools", label: "Outils" },
    { value: "dish", label: "Vaisselle" },
    { value: "cooking", label: "Cuisine" },
    { value: "gaz", label: "Gaz" },
    { value: "hygiene", label: "Hygiène" },
  ];

  const statuses: { value: EventMaterielStatus; label: string }[] = [
    { value: "to_find", label: "À trouver" },
    { value: "to_check", label: "À vérifier" },
    { value: "confirmed", label: "Ok" },
  ];

  const validationErrors = $derived.by(() => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Le nom est requis.");
    if (quantity < 1) errs.push("La quantité doit être ≥ 1.");
    if (
      mode === "item" &&
      status !== "to_find" &&
      !who.trim() &&
      !where.trim()
    ) {
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
  }) {
    name = suggestion.name;
    type = suggestion.type;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    attempted = true;
    errors = validationErrors;
    if (!isValid) return;

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
        ><Hash class="inline size-4" /> Quantité</legend
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
        <label class="input w-full">
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
        <label class="input w-full">
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
      ></textarea>
    </fieldset>
  </div>

  {#if attempted && errors.length > 0}
    <div class="alert alert-warning alert-soft text-sm">
      <CircleAlert class="size-4 shrink-0" />
      <ul class="list-disc pl-2">
        {#each errors as err}
          <li>{err}</li>
        {/each}
      </ul>
    </div>
  {/if}
</form>
