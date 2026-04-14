<script lang="ts">
  import type {
    EventMaterielType,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import { Hash, MapPin, Save, User, X, CircleDot } from "@lucide/svelte";

  interface Props {
    maxQuantity: number;
    headerName: string;
    headerType: EventMaterielType;
    presetStatus?: EventMaterielStatus;
    onSubmit: (data: {
      quantity: number;
      status: EventMaterielStatus;
      who: string;
      where: string;
    }) => Promise<void>;
    onCancel: () => void;
  }

  let {
    maxQuantity,
    headerName,
    headerType,
    presetStatus,
    onSubmit,
    onCancel,
  }: Props = $props();

  let quantity = $state(Math.min(1, maxQuantity));
  let status = $state<EventMaterielStatus>(presetStatus ?? "to_check");
  let who = $state("");
  let where = $state("");
  let submitting = $state(false);

  const statuses: { value: EventMaterielStatus; label: string }[] = [
    { value: "to_check", label: "À vérifier / demander" },
    { value: "confirmed", label: "Ok" },
    { value: "to_find", label: "À trouver" },
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (quantity <= 0 || quantity > maxQuantity) return;

    submitting = true;
    try {
      await onSubmit({
        quantity,
        status,
        who: who.trim(),
        where: where.trim(),
      });
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3">
  <div class="text-base-content/70 mb-4 text-sm">
    <strong>{headerName}</strong>
    {#if maxQuantity > 0}
      <span class="badge badge-warning badge-xs ml-1"
        >besoin total: {maxQuantity}</span
      >
    {/if}
    <span>Indiquez la quantité disponibile empruntable ou à demander</span>
  </div>

  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label class="input">
      <span class="label"><Hash class="size-4" /> quantité</span>
      <input
        type="number"
        min="1"
        max={maxQuantity}
        bind:value={quantity}
        placeholder="Quantité"
        required
      />
    </label>

    <fieldset class="fieldset gap-0.5">
      <label class="select">
        <CircleDot class="h-4 w-4 opacity-50" />
        <select bind:value={status}>
          {#each statuses as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </label>
      <span class="label">ok où a demander ?</span>
    </fieldset>
    <label class="input">
      <User class="h-4 w-4 opacity-50" />
      <input type="text" bind:value={who} placeholder="Qui s'en charge ?" />
    </label>

    <label class="input">
      <MapPin class="h-4 w-4 opacity-50" />
      <input type="text" bind:value={where} placeholder="Où le trouver ?" />
    </label>
  </div>

  <div class="modal-action flex justify-end gap-2">
    <button type="button" class="btn btn-ghost btn-sm" onclick={onCancel}>
      <X class="h-4 w-4" />
      Annuler
    </button>
    <button
      type="submit"
      class="btn btn-primary btn-sm"
      disabled={quantity <= 0 || quantity > maxQuantity || submitting}
    >
      {#if submitting}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Save class="h-4 w-4" />
      {/if}
      Allouer
    </button>
  </div>
</form>
