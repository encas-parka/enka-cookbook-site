<script lang="ts">
  import { Euro } from "@lucide/svelte";

  interface Props {
    value: number | null;
    disabled?: boolean;
  }

  let { value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="input w-28">
  <Euro class="h-4 w-4 opacity-50" />
  <input
    type="number"
    step="1"
    min="0"
    placeholder="0.00"
    bind:value
    {disabled}
  />
</label>
