<script lang="ts">
  /**
   * Geste retour des pages drill-in : bouton icône seule posé à gauche du
   * titre de la page, tous breakpoints — jamais dans la navbar (densité de
   * barre). `label` nomme la destination : aria-label et infobulle.
   * Convention complète : docs/ui-conventions.md.
   */
  import { ArrowLeft } from "@lucide/svelte";

  interface Props {
    /** Nomme la destination (« Retour aux réservations »). */
    label: string;
    /** Parent canonique via navigate() — jamais history.back() (deep links). */
    go: () => void;
    /** Désactivé pendant une opération (ex. save en cours). */
    disabled?: boolean;
  }

  let { label, go, disabled = false }: Props = $props();
</script>

<button
  class="btn btn-square shrink-0 btn-ghost btn-sm"
  onclick={go}
  {disabled}
  aria-label={label}
  title={label}
>
  <ArrowLeft class="size-5" />
</button>
