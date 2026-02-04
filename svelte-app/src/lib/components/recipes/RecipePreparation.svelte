<script lang="ts">
  import { CircleAlert, CookingPot, Lightbulb } from "@lucide/svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import Fieldset from "../ui/Fieldset.svelte";
  import type { Astuce } from "$lib/utils/recipeUtils";

  interface Props {
    preparation: string;
    preparation24h?: string;
    preparationHtml?: string;
    preparation24hHtml?: string;
    astuces?: Astuce[];
  }

  let {
    preparation,
    preparation24h,
    preparationHtml,
    preparation24hHtml,
    astuces = [],
  }: Props = $props();
</script>

<div class="space-y-4">
  <!-- Alerte préparation 24h -->
  {#if preparation24h}
    <Fieldset
      legend="Préparation à l'avance"
      iconComponent={CircleAlert}
      legendSize="text-lg"
      iconSize={18}
    >
      <div class="prose max-w-none">
        {#if preparation24hHtml}
          <div>{@html preparation24hHtml}</div>
        {:else}
          <SvelteMarkdown source={preparation24h} />
        {/if}
      </div>
    </Fieldset>
  {/if}

  <!-- Instructions de préparation -->
  <Fieldset
    legend="Préparation"
    iconComponent={CookingPot}
    legendSize="text-lg"
  >
    <div class="prose max-w-none">
      {#if preparationHtml}
        <div>{@html preparationHtml}</div>
      {:else}
        <SvelteMarkdown source={preparation} />
      {/if}
    </div>
  </Fieldset>

  <!-- Astuces -->
  {#if astuces.length > 0}
    <div class="space-y-2 print:space-y-1">
      {#each astuces as astuce}
        <Fieldset
          legend="Astuces"
          iconComponent={Lightbulb}
          legendSize="text-sm"
        >
          <div class="flex items-start gap-2">
            <div class="text-sm">{astuce.astuce}</div>
          </div>
        </Fieldset>
      {/each}
    </div>
  {/if}
</div>
