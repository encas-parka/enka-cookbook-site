<script lang="ts">
  import { Package } from "@lucide/svelte";
  import { QUANTITY_UNITS } from "$lib/constants/units";

  interface Props {
    quantity: number | null;
    unit: string;
    disabled?: boolean;
    required?: boolean;
  }

  let {
    quantity = $bindable(),
    unit = $bindable(),
    disabled = false,
    required = true,
  }: Props = $props();
</script>

<fieldset class="fieldset">
  <div class="flex gap-2 {required ? 'required' : ''}">
    <label class="input w-32">
      <Package class="opacity-50" />
      <input
        class="w-full text-center"
        type="number"
        step="1"
        min="0"
        placeholder="Quantité"
        bind:value={quantity}
        {disabled}
        {required}
        aria-required={required ? "true" : undefined}
      />
    </label>
    <label class="select w-44">
      <span class="label">unité</span>
      <select
        class="text-end"
        bind:value={unit}
        {disabled}
        {required}
        aria-required={required ? "true" : undefined}
      >
        <option disabled selected value="">-</option>
        {#each QUANTITY_UNITS as { value, label }}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
  </div>
</fieldset>
