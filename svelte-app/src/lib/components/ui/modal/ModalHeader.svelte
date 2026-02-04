<script lang="ts">
  import type { Snippet } from "svelte";
  import { X, ChevronLeft } from "@lucide/svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";

  interface Props {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    onClose: () => void;
    children?: Snippet;
  }

  let {
    title,
    subtitle,
    showBackButton = true,
    onClose,
    children,
  }: Props = $props();
</script>

<div class="border-base-300 flex-none border-b px-4 py-3">
  <div class="absolute top-2 right-2">
    {#if !globalState.isMobile}
      <button
        class="btn btn-circle btn-ghost btn-sm flex-none"
        onclick={onClose}
        aria-label="Retour"
      >
        <X class="h-5 w-5" />
      </button>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <!-- Left side: back button + title (3/4 space minimum) -->
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {#if showBackButton && globalState.isMobile}
        <button
          class="btn btn-circle btn-ghost btn-sm flex-none"
          onclick={onClose}
          aria-label="Retour"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
      {/if}

      <div class="max-w-11/12 min-w-0 flex-1 items-baseline">
        <h3 class="truncate text-lg font-bold">{title}</h3>
        {#if subtitle}
          <p class="text-base-content/70 truncate text-sm">{subtitle}</p>
        {/if}
      </div>
    </div>

    <!-- Right side: custom content -->
    {#if children}
      <div class="flex items-center gap-2 sm:me-10">
        {@render children()}
      </div>
    {/if}
  </div>
</div>
