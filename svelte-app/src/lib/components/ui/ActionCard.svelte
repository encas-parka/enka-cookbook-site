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
  <div class="card bg-base-100 border-base-200 border shadow-sm">
    <div class="card-body">
      <div class="flex items-center gap-3">
        <div class="text-primary self-baseline stroke-3">{@render icon()}</div>
        <div>
          <h4 class="">{title}</h4>
          <p class="text-base-content/60 py-2 text-sm">{description}</p>
        </div>
      </div>
      <div class="card-actions mt-auto justify-end">
        {@render action()}
      </div>
    </div>
  </div>
{:else}
  <div class="bg-base-100 border-base-200 rounded-lg border">
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
        class="text-base-content/40 size-4 shrink-0 transition-transform {open
          ? 'rotate-180'
          : ''}"
      />
    </button>
    {#if open}
      <div class="border-base-200 border-t px-3 py-2">
        <p class="text-base-content/60 text-sm">{description}</p>
      </div>
    {/if}
  </div>
{/if}
