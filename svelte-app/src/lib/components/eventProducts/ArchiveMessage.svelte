<script lang="ts">
  import { History, Lock } from "@lucide/svelte";

  let {
    title = "Événement terminé",
    message = "Cet événement est terminé. Ces données ne sont plus modifiables mais sont conservées pour consultation.",
    showData = true,
    data = null,
    dataLabel = "",
  } = $props<{
    title?: string;
    message?: string;
    showData?: boolean;
    data?: any;
    dataLabel?: string;
  }>();
</script>

<div class="rounded-lg border border-warning/20 bg-base-200 p-4 text-center">
  <div class="mb-2 flex items-center justify-center gap-2">
    <History class="h-5 w-5 text-warning" />
    <Lock class="h-4 w-4 text-warning/70" />
    <span class="font-medium text-warning">{title}</span>
  </div>

  <p class="mb-3 text-sm text-base-content/70">
    {message}
  </p>

  {#if showData && data}
    <div class="rounded bg-base-300/50 p-2 text-left">
      {#if dataLabel}
        <div class="mb-1 text-xs font-medium text-base-content/60">
          {dataLabel} :
        </div>
      {/if}
      <div class="text-sm">
        {#if typeof data === "string" || typeof data === "number"}
          {data}
        {:else if Array.isArray(data) && data.length > 0}
          {data.join(", ")}
        {:else if typeof data === "object" && data !== null}
          {#if data.storeName}
            <div class="font-medium">{data.storeName}</div>
            {#if data.storeComment}
              <div class="mt-1 text-xs text-base-content/60">
                {data.storeComment}
              </div>
            {/if}
          {:else}
            <pre class="text-xs">{JSON.stringify(data, null, 2)}</pre>
          {/if}
        {:else}
          <span class="text-base-content/50 italic">Non défini</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Style minimal, le reste utilise les classes Tailwind/DaisyUI */
</style>
