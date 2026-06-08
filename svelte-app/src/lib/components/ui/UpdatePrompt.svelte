<script lang="ts">
  import { RefreshCw } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import type { VersionEntry } from "$lib/stores/UpdateStore.svelte";

  interface Props {
    isOpen: boolean;
    changelog: VersionEntry[];
    onAccept: () => void;
  }

  let { isOpen, changelog, onAccept }: Props = $props();
</script>

<ModalContainer {isOpen} onClose={onAccept} fullscreenOnMobile={false}>
  <ModalHeader
    title="Mise à jour disponible"
    onClose={onAccept}
    showBackButton={false}
  >
    <RefreshCw
      class="text-primary h-5 w-5 animate-spin"
      style="animation-duration: 2s;"
    />
  </ModalHeader>

  <ModalContent>
    {#if changelog.length > 0}
      <div class="space-y-4">
        {#each changelog as entry}
          <div>
            {#if entry.version}
              <div class="flex items-baseline gap-2">
                <span class="badge badge-primary badge-sm"
                  >v{entry.version}</span
                >
                {#if entry.date}
                  <span class="text-base-content/50 text-xs">{entry.date}</span>
                {/if}
              </div>
            {/if}
            {#if entry.changes.length > 0}
              <ul class="mt-1 list-inside list-disc space-y-1 text-sm">
                {#each entry.changes as change}
                  <li>{change}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-base-content/70 text-sm">
        Une nouvelle version est disponible. La page sera rechargée pour
        appliquer la mise à jour.
      </p>
    {/if}
  </ModalContent>

  <ModalFooter>
    <button class="btn btn-primary" onclick={onAccept}>
      <RefreshCw class="h-4 w-4" />
      Ok !
    </button>
  </ModalFooter>
</ModalContainer>
