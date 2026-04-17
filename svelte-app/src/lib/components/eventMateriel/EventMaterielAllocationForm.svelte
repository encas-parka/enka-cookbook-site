<script lang="ts">
  import type {
    EventMaterielType,
    EventMaterielStatus,
  } from "$lib/types/event-materiel.types";
  import { getEventMaterielStatusConfig } from "$lib/utils/materiel.utils";
  import { Hash, MapPin, User, CircleDot, CircleAlert } from "@lucide/svelte";

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

  let quantity = $state(Math.min(1, maxQuantity));
  let status = $state<EventMaterielStatus>(presetStatus ?? "to_check");
  let who = $state("");
  let where = $state("");
  let notes = $state("");
  let submitting = $state(false);
  let attempted = $state(false);

  const statuses: { value: EventMaterielStatus; label: string }[] = [
    "to_check",
    "confirmed",
    "to_find",
  ].map((s) => ({
    value: s as EventMaterielStatus,
    label: getEventMaterielStatusConfig(s).label,
  }));

  const statusClass = $derived(
    getEventMaterielStatusConfig(status).selectClass,
  );

  const needsSource = $derived(status === "to_check" || status === "confirmed");

  const whoOrWhereError = $derived(
    attempted && needsSource && !who.trim() && !where.trim(),
  );

  const whoError = $derived(whoOrWhereError && !who.trim());
  const whereError = $derived(whoOrWhereError && !where.trim());

  const validationErrors = $derived.by(() => {
    const errs: string[] = [];
    if (quantity <= 0 || quantity > maxQuantity)
      errs.push("La quantité doit être entre 1 et " + maxQuantity + ".");
    if (needsSource && !who.trim() && !where.trim()) {
      errs.push("Indiquez qui apporte le matériel ou d'où il vient.");
    }
    return errs;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    attempted = true;
    if (validationErrors.length > 0) return;

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
  <div class="text-base-content/70 py-2 text-sm">
    <div class="mb-2">
      <strong>{headerName}</strong>
      {#if maxQuantity > 0}
        <span class="badge badge-warning badge-sm float-end"
          >besoin total: {maxQuantity}</span
        >
      {/if}
    </div>
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
      <legend class="fieldset-legend required"
        ><User class="inline size-4" /> Qui ?</legend
      >
      <label class="input w-full">
        <input
          type="text"
          bind:value={who}
          placeholder="Personne responsable"
          class="grow {whoError ? 'input-error' : ''}"
          required={needsSource}
        />
      </label>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend required"
        ><MapPin class="inline size-4" /> Où ?</legend
      >
      <label class="input w-full">
        <input
          type="text"
          bind:value={where}
          placeholder="Lieu de stockage"
          class="grow {whereError ? 'input-error' : ''}"
          required={needsSource}
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

  {#if attempted && validationErrors.length > 0}
    <div class="alert alert-warning alert-soft text-sm">
      <CircleAlert class="size-4 shrink-0" />
      <ul class="list-disc pl-2">
        {#each validationErrors as err}
          <li>{err}</li>
        {/each}
      </ul>
    </div>
  {/if}
</form>
