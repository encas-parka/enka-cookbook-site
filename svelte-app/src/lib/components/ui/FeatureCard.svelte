<script lang="ts">
  import { globalState } from "../../stores/GlobalState.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    images: string[];
    title: string;
    description?: string;
    buttonText?: string;
    buttonAction?: () => void;
    theme?: "primary" | "secondary";
    extra?: Snippet;
  }

  let {
    images,
    title,
    description,
    buttonText,
    buttonAction,
    theme = "primary",
    extra,
  }: Props = $props();

  const themeClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
  };
</script>

<div class="card bg-base-100 h-[60vh] w-full shadow-xl">
  <!-- Figure with hover gallery -->
  {#if images.length > 0}
    <figure class="hover-gallery">
      {#each images as image, index (index)}
        <img src={image} alt={title} class="w-full object-cover" />
      {/each}
    </figure>
  {/if}

  <div
    class="card-body absolute bottom-0 {buttonAction &&
      'pb-15'} w-full bg-gray-700/30"
  >
    <h2 class="card-title {themeClasses[theme]} text-2xl">
      {title}
    </h2>

    {#if description}
      <p class="text-base-content/80">{@html description}</p>
    {/if}

    {#if extra}
      {@render extra()}
    {/if}

    {#if buttonText && buttonAction}
      <button
        class="btn btn-{theme} btn-sm absolute right-4 bottom-4"
        onclick={buttonAction}
      >
        {buttonText}
      </button>
    {/if}
  </div>
</div>
