<script lang="ts">
  import { globalState } from "@/lib/stores/GlobalState.svelte";
  import { ChevronDown } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    icon: Snippet;
    action: Snippet;
  }

  let { title, description, icon, action }: Props = $props();
  let open = $state(false);
</script>

{#if !globalState.isMobile}
  <div class="card border border-base-200 bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="flex items-center gap-3">
        <div class="self-baseline stroke-3 text-primary">{@render icon()}</div>
        <div>
          <h4 class="">{title}</h4>
          <p class="py-2 text-sm text-base-content/60">{description}</p>
        </div>
      </div>
      <div class="mt-auto card-actions justify-end">
        {@render action()}
      </div>
    </div>
  </div>
{:else}
  <div class="rounded-lg border border-base-200 bg-base-100">
    <button
      class="flex w-full items-center gap-2 p-3 text-left"
      onclick={() => (open = !open)}
    >
      <span class="text-primary">{@render icon()}</span>
      <span class="font-medium">{title}</span>
      <!-- Wrapper to isolate action button clicks from accordion toggle -->
      <div class="ml-auto" role="none" onclick={(e) => e.stopPropagation()}>
        {@render action()}
      </div>
      <ChevronDown
        class="size-4 shrink-0 text-base-content/40 transition-transform {open
          ? 'rotate-180'
          : ''}"
      />
    </button>
    {#if open}
      <div class="border-t border-base-200 px-3 py-2">
        <p class="text-sm text-base-content/60">{description}</p>
      </div>
    {/if}
  </div>
{/if}
