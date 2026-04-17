<script lang="ts">
  import { route } from "$lib/router";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    allEventTabs,
    getEventActiveIndex,
    getEventTabPath,
  } from "./event-tabs-config";

  let {
    eventId,
    basePath = "/event",
  }: {
    eventId: string;
    basePath?: string;
  } = $props();

  const activeIndex = $derived(getEventActiveIndex(route.pathname));
</script>

<div class="rounded-box bg-accent/10 px-2 py-1">
  <div class="tabs flex-wrap justify-center">
    {#each allEventTabs as tab, i (tab.relativePath)}
      {@const Icon = tab.icon}
      <a
        class="tab rounded-box font-medium {i === activeIndex
          ? 'text-base-content/80 bg-accent/30 font-bold'
          : 'text-accent'}"
        href={getEventTabPath(tab, eventId, basePath)}
      >
        <Icon class="me-1 size-4" />
        {tab.label}
      </a>
    {/each}
  </div>
</div>
