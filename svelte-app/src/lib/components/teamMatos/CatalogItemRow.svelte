<script lang="ts">
  import { Check, Minus, Plus, X } from "@lucide/svelte";

  interface Props {
    name: string;
    quantity: number;
    existingQuantity?: number;
    existingLabel?: string;
    sourcedBatches?: { label: string; qty: number }[];
    onchange: (quantity: number) => void;
    /** Taille des contrôles ; "md" cible le tactile (emprunts). */
    size?: "xs" | "md";
    /** Plafond de quantité ; undefined = incrément toujours permis. */
    maxQuantity?: number;
    /** Bouton "Tout" (quantité = maxQuantity). */
    showTakeAll?: boolean;
    /** Bouton de remise à zéro (icône X) à gauche du decrement. */
    showClear?: boolean;
    /** Ligne grisée, contrôles inactifs (matériel indisponible sur la période). */
    disabled?: boolean;
    /** Badge de remplacement affiché quand disabled (ex. "Indisponible"). */
    unavailableLabel?: string;
    /** Badge informatif à côté du nom (ex. "2/5" : dispo/possédé). */
    badge?: string;
  }

  let {
    name,
    quantity,
    existingQuantity = 0,
    existingLabel = "déjà possédé",
    sourcedBatches = [],
    onchange,
    size = "xs",
    maxQuantity,
    showTakeAll = false,
    showClear = false,
    disabled = false,
    unavailableLabel,
    badge,
  }: Props = $props();

  const isActive = $derived(quantity > 0);
  const hasExisting = $derived(existingQuantity > 0);
  const canIncrement = $derived(
    !disabled && (maxQuantity === undefined || quantity < maxQuantity),
  );
  const showStatusBadge = $derived(disabled && unavailableLabel !== undefined);

  function increment() {
    if (!canIncrement) return;
    onchange(quantity + 1);
  }

  function decrement() {
    if (disabled) return;
    if (quantity > 0) onchange(quantity - 1);
  }

  function takeAll() {
    if (disabled || maxQuantity === undefined) return;
    onchange(maxQuantity);
  }

  function clearAll() {
    if (disabled || quantity <= 0) return;
    onchange(0);
  }
</script>

<div
  class="bg-base-100 border-base-300 flex flex-col gap-2 rounded-lg border px-3 py-2 transition-colors sm:flex-row sm:items-center sm:justify-between {disabled
    ? 'border-base-300 bg-base-300/50 opacity-60 '
    : isActive
      ? 'text-primary ring-neutral/30 border-0 font-medium ring-2 ring-inset'
      : ''}"
>
  <div class="flex min-w-0 items-center gap-2">
    <span class="text-base sm:truncate">{name}</span>
    {#if showStatusBadge}
      <span class="badge badge-sm badge-error flex-none"
        >{unavailableLabel}</span
      >
    {:else if badge !== undefined}
      <span class="badge badge-ghost flex-none tabular-nums"
        >{badge} <span class="opacity-70">dispo.</span></span
      >
    {:else if hasExisting}
      <span class="badge badge-ghost badge-sm flex-none"
        >{existingLabel} {existingQuantity}</span
      >
    {/if}
    {#if sourcedBatches.length > 0}
      {#each sourcedBatches as batch (batch.label)}
        <span class="badge badge-xs badge-success flex-none gap-0.5">
          <Check class="size-2.5" />
          {batch.label}: {batch.qty}
        </span>
      {/each}
    {/if}
  </div>

  <div class="flex flex-none items-center justify-end gap-1">
    {#if showClear}
      <button
        class="btn btn-square btn-ghost scroll-mt-40 {size === 'md'
          ? 'btn-md'
          : 'btn-xs'}"
        onclick={clearAll}
        disabled={disabled || quantity <= 0}
        aria-label="Tout retirer"
      >
        <X class={size === "md" ? "size-5" : "size-3"} />
      </button>
    {/if}

    <button
      class="btn btn-square btn-ghost scroll-mt-40 {size === 'md'
        ? 'btn-md'
        : 'btn-xs'}"
      onclick={decrement}
      disabled={disabled || quantity <= 0}
      aria-label="Diminuer"
    >
      <Minus class={size === "md" ? "size-5" : "size-3"} />
    </button>

    <input
      type="number"
      min="0"
      max={maxQuantity === undefined ? undefined : maxQuantity}
      step="1"
      value={quantity}
      autocomplete="off"
      onfocus={(e) => e.currentTarget.select()}
      oninput={(e) => {
        const v = parseInt(e.currentTarget.value);
        if (!isNaN(v) && v >= 0) onchange(v);
      }}
      class="qty-input input scroll-mt-40 {size === 'md'
        ? 'input-md w-16'
        : 'input-xs w-14'} text-center font-semibold tabular-nums {isActive
        ? 'input-primary'
        : ''}"
      aria-label="Quantité"
      {disabled}
    />

    <button
      class="btn btn-square btn-ghost scroll-mt-40 {size === 'md'
        ? 'btn-md'
        : 'btn-xs'}"
      onclick={increment}
      disabled={!canIncrement}
      aria-label="Augmenter"
    >
      <Plus class={size === "md" ? "size-5" : "size-3"} />
    </button>

    {#if showTakeAll && maxQuantity !== undefined}
      <button
        class="btn btn-ghost scroll-mt-40 {size === 'md' ? 'btn-sm' : 'btn-xs'}"
        onclick={takeAll}
        disabled={disabled || quantity >= maxQuantity}
      >
        Tout
      </button>
    {/if}
  </div>
</div>
