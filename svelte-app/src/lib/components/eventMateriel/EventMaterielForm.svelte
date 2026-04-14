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
    Save,
    Shapes,
    Trash2,
    User,
    X,
    CircleDot,
  } from "@lucide/svelte";
  import MaterielNameSuggest from "$lib/components/eventMateriel/MaterielNameSuggest.svelte";

  interface Props {
    eventId: string;
    initialData?: EventMateriel | null;
    onSubmit: (data: CreateEventMaterielData) => Promise<void>;
    onCancel: () => void;
    onDelete?: (() => void) | null;
    canEditWhere?: boolean;
  }

  let {
    eventId,
    initialData = null,
    onSubmit,
    onCancel,
    onDelete = null,
    canEditWhere = true,
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
  let submitting = $state(false);

  const isEdit = $derived(!!initialData);

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
    if (!name.trim()) return;

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

    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><CircleDot class="inline size-4" /> Statut</legend
      >
      <select bind:value={status} class="select w-full">
        {#each statuses as s (s.value)}
          <option value={s.value}>{s.label}</option>
        {/each}
      </select>
    </fieldset>

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

  {#if isEdit && onDelete}
    <div class="flex">
      <button
        type="button"
        class="btn btn-error btn-outline btn-sm"
        onclick={onDelete}
        disabled={submitting}
      >
        <Trash2 class="size-4" />
        Supprimer
      </button>
    </div>
  {/if}

  <div class="flex justify-end gap-2">
    <button type="button" class="btn btn-ghost" onclick={onCancel}>
      <X class="h-4 w-4" />
      Annuler
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      disabled={!name.trim() || submitting}
    >
      {#if submitting}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Save class="h-4 w-4" />
      {/if}
      {isEdit ? "Enregistrer" : "Ajouter"}
    </button>
  </div>
</form>
