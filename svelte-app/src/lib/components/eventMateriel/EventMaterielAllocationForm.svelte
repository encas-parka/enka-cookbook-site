<script lang="ts">
  import type {
    EventMaterielType,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import { Hash, MapPin, User, CircleDot } from "@lucide/svelte";

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
      notes?: string;
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

  // svelte-ignore state_referenced_locally
  let quantity = $state(Math.min(1, maxQuantity));
  // svelte-ignore state_referenced_locally
  let status = $state<EventMaterielStatus>(presetStatus ?? "to_check");
  let who = $state("");
  let where = $state("");
  let notes = $state("");
  let submitting = $state(false);

  const statuses: { value: EventMaterielStatus; label: string }[] = [
    { value: "to_check", label: "À vérifier / demander" },
    { value: "confirmed", label: "Ok" },
    { value: "to_find", label: "À trouver" },
  ];

  const statusClass = $derived(
    status === "confirmed"
      ? "select-success text-success"
      : status === "to_check"
        ? "select-warning text-warning"
        : "select-error text-error",
  );

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
        notes: notes.trim() || undefined,
      });
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <div class="text-base-content/70 text-sm">
    <strong>{headerName}</strong>
    {#if maxQuantity > 0}
      <span class="badge badge-warning badge-xs ml-1"
        >besoin total: {maxQuantity}</span
      >
    {/if}
    <p>Indiquez la quantité disponible, empruntable ou à demander.</p>
  </div>

  <div class="grid grid-cols-1 gap-4">
    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><Hash class="inline size-4" /> Quantité</legend
      >
      <label class="input w-full">
        <input
          type="number"
          min="1"
          max={maxQuantity}
          bind:value={quantity}
          placeholder="Quantité"
          class="grow"
          required
        />
      </label>
    </fieldset>

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

    <fieldset class="fieldset">
      <legend class="fieldset-legend"
        ><User class="inline size-4" /> Qui ?</legend
      >
      <label class="input w-full">
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
        <input
          type="text"
          bind:value={where}
          placeholder="Lieu de stockage"
          class="grow"
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
</form>
