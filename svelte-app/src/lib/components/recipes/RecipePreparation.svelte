<script lang="ts">
  import { CircleAlert, CookingPot, Lightbulb } from "@lucide/svelte";
  import SvelteMarkdown from "@humanspeak/svelte-markdown";
  import Fieldset from "../ui/Fieldset.svelte";
  import type { Astuce } from "$lib/utils/recipeUtils";

  interface Props {
    preparation: string;
    preparation24h?: string;
    astuces?: Astuce[];
  }

  let { preparation, preparation24h, astuces = [] }: Props = $props();
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
        <SvelteMarkdown source={preparation24h} />
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
      <SvelteMarkdown source={preparation} />
    </div>
  </Fieldset>

  <!-- Astuces -->
  {#if astuces.length > 0}
    <Fieldset legend="Astuces" iconComponent={Lightbulb} legendSize="text-lg">
      <ul class="list-disc space-y-1 ps-5 text-sm">
        {#each astuces as astuce}
          <li>{astuce.astuce}</li>
        {/each}
      </ul>
    </Fieldset>
  {/if}
</div>
