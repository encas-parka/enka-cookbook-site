<script lang="ts">
  import { type Component } from "svelte";

  interface Props {
    legend: string;
    children?: () => any;
    bgClass?: string;
    iconComponent?: Component<{ size?: number; class?: string }>;
    legendSize?: string;
    legendFont?: string;
    iconSize?: number;
  }
  let {
    legend,
    children,
    bgClass = "bg-base-100",
    iconComponent,
    legendSize = "text-base",
    legendFont = "font-medium",
    iconSize = 16,
  }: Props = $props();
</script>

<fieldset
  class="text-sm {bgClass}  rounded-box border-neutral/20 border-y-2 p-4 md:border print:p-2"
>
  <legend
    class="fieldset-legend {legendFont} {bgClass} rounded-box border-neutral/20 text-base-content/80 border-t-1 px-4 py-1 print:text-sm {legendSize}"
  >
    {#if iconComponent}
      {@const IconComp = iconComponent}
      <IconComp size={iconSize} class="mr-1"></IconComp>
    {/if}
    {legend}
  </legend>
  {@render children?.()}
</fieldset>
