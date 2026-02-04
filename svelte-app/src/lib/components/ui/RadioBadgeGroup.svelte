<script lang="ts">
  import RadioBadge from "./RadioBadge.svelte";

  interface RadioItem {
    id: string;
    label: string;
  }

  interface Props {
    items: RadioItem[];
    selected: string;
    size?: "xs" | "sm" | "lg" | "md";
    disabled?: boolean;
    color?:
      | "primary"
      | "secondary"
      | "accent"
      | "success"
      | "warning"
      | "error"
      | "info"
      | "neutral";
  }

  let {
    items,
    selected = $bindable(),
    size = "sm",
    disabled = false,
    color = "primary",
  }: Props = $props();
</script>

<div class="flex flex-wrap gap-2">
  {#each items as item (item.id)}
    <RadioBadge
      value={item.id}
      bind:selectedValue={selected}
      label={item.label}
      {color}
      {size}
      {disabled}
    />
  {/each}
</div>
