<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type IconNames =
    | "add-to-cart"
    | "bread"
    | "cake-slice"
    | "cook-hot"
    | "cooking-pot"
    | "cup-soda"
    | "dish"
    | "fast-food-pudding"
    | "food"
    | "fryer"
    | "hamburger"
    | "hot"
    | "lettuce"
    | "oven"
    | "pan"
    | "pie"
    | "pizza"
    | "pot"
    | "salad"
    | "sandwich"
    | "sauce"
    | "soup"
    | "tartinade"
    | "temperature-snow";

  interface Props extends HTMLAttributes<SVGElement> {
    name: IconNames;
    size?: number;
    title?: string;
  }

  let {
    name,
    size = 24,
    title,
    class: className = "",
    ...restProps
  }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  class={className}
  aria-hidden={title ? undefined : "true"}
  {...restProps}
>
  {#if title}
    <title>{title}</title>
  {/if}
  <use href="/icons/sprite.svg#{name}" />
</svg>
