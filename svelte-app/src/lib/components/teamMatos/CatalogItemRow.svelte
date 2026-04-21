<script lang="ts">
  import { Check, Minus, Plus } from "@lucide/svelte";

  interface Props {
    name: string;
    quantity: number;
    existingQuantity?: number;
    existingLabel?: string;
    sourcedBatches?: { label: string; qty: number }[];
    onchange: (quantity: number) => void;
  }

  let {
    name,
    quantity,
    existingQuantity = 0,
    existingLabel = "déjà possédé",
    sourcedBatches = [],
    onchange,
  }: Props = $props();

  const isActive = $derived(quantity > 0);
  const hasExisting = $derived(existingQuantity > 0);

  function increment() {
    onchange(quantity + 1);
  }

  function decrement() {
    if (quantity > 0) onchange(quantity - 1);
  }
</script>

<div
  class="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors {isActive
    ? 'border-primary/40 bg-primary/10'
    : 'border-base-300 bg-base-100'}"
>
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <span class="truncate text-sm">{name}</span>
    {#if hasExisting}
      <span class="badge badge-ghost badge-xs flex-none"
        >{existingLabel} {existingQuantity}</span
      >
    {/if}
    {#if sourcedBatches.length > 0}
      {#each sourcedBatches as batch (batch.label)}
        <span class="badge badge-success badge-xs flex-none gap-0.5">
          <Check class="size-2.5" />
          {batch.label}: {batch.qty}
        </span>
      {/each}
    {/if}
  </div>

  <div class="flex flex-none items-center gap-1">
    <button
      class="btn btn-square btn-ghost btn-xs"
      onclick={decrement}
      disabled={quantity <= 0}
      aria-label="Diminuer"
    >
      <Minus class="size-3" />
    </button>

    <input
      type="number"
      min="0"
      step="1"
      value={quantity}
      oninput={(e) => {
        const v = parseInt(e.currentTarget.value);
        if (!isNaN(v) && v >= 0) onchange(v);
      }}
      class="quantity-input input input-xs w-14 text-center font-semibold tabular-nums {isActive
        ? 'input-primary'
        : ''}"
      aria-label="Quantité"
    />

    <button
      class="btn btn-square btn-ghost btn-xs"
      onclick={increment}
      aria-label="Augmenter"
    >
      <Plus class="size-3" />
    </button>
  </div>
</div>

<style>
  .quantity-input::-webkit-inner-spin-button,
  .quantity-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  .quantity-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
