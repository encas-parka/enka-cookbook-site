<script lang="ts">
  import type { EventMateriel } from "$lib/types/appwrite";
  import type {
    CreateEventMaterielData,
    EventMaterielType,
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
  } from "@lucide/svelte";

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

  // Capture un snapshot des valeurs au montage — le formulaire est démonté
  // après chaque soumission/annulation, donc pas de risque de stale data.
  // svelte-ignore state_referenced_locally
  let name = $state(initialData?.name || "");
  // svelte-ignore state_referenced_locally
  let quantity = $state(initialData?.quantity || 1);
  // svelte-ignore state_referenced_locally
  let type = $state<EventMaterielType>(
    (initialData?.type as EventMaterielType) || "other",
  );
  // svelte-ignore state_referenced_locally
  let who = $state(initialData?.who || "");
  // svelte-ignore state_referenced_locally
  let where = $state(initialData?.where || "");
  // svelte-ignore state_referenced_locally
  let notes = $state(initialData?.notes || "");
  // // TODO: status derive de where - supprimer ces lignes si on reintroduit un statut
  // let status = $state<EventMaterielStatus>(
  //   (initialData?.status as EventMaterielStatus) || "needed",
  // );
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
        who: who.trim() || null,
        where: where.trim() || null,
        // status, // TODO: supprimer si on reintroduit un statut
        notes: notes.trim() || null,
      });
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3">
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <!-- Nom -->
    <label class="input sm:col-span-2">
      <Package class="h-4 w-4 opacity-50" />
      <input
        type="text"
        bind:value={name}
        placeholder="Nom * (ex: Table pliante)"
        required
      />
    </label>

    <!-- Quantité -->
    <label class="input">
      <span class="label"><Hash class="size-4" /> quantité</span>
      <input
        type="number"
        min="1"
        bind:value={quantity}
        placeholder="Quantité"
      />
    </label>

    <!-- Type -->
    <label class="select">
      <Shapes class="h-4 w-4 opacity-50" />
      <select bind:value={type}>
        {#each types as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </label>

    <!-- Qui -->
    <label class="input">
      <User class="h-4 w-4 opacity-50" />
      <input type="text" bind:value={who} placeholder="Qui s'en charge ?" />
    </label>

    <!-- Où -->
    <label class="input">
      <MapPin class="h-4 w-4 opacity-50" />
      <input
        type="text"
        bind:value={where}
        placeholder="Où le trouver ?"
        disabled={!canEditWhere}
      />
    </label>

    <!-- Notes -->
    <label class="textarea sm:col-span-2">
      <textarea
        rows="2"
        class="size-full"
        bind:value={notes}
        placeholder="Notes..."
      ></textarea>
    </label>
  </div>

  <!-- Delete (edit mode only) -->
  {#if isEdit && onDelete}
    <div class="mt-4 flex">
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

  <!-- Actions -->
  <div class="modal-action flex justify-end gap-2">
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
