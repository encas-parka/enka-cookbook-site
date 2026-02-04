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

<div class="bg-base-200 border-warning/20 rounded-lg border p-4 text-center">
  <div class="mb-2 flex items-center justify-center gap-2">
    <History class="text-warning h-5 w-5" />
    <Lock class="text-warning/70 h-4 w-4" />
    <span class="text-warning font-medium">{title}</span>
  </div>

  <p class="text-base-content/70 mb-3 text-sm">
    {message}
  </p>

  {#if showData && data}
    <div class="bg-base-300/50 rounded p-2 text-left">
      {#if dataLabel}
        <div class="text-base-content/60 mb-1 text-xs font-medium">
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
              <div class="text-base-content/60 mt-1 text-xs">
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
