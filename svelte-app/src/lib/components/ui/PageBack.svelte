<script lang="ts">
  /**
   * Geste retour des pages drill-in : bouton libellé posé au-dessus du titre
   * de la page, tous breakpoints — jamais dans la navbar (densité de barre).
   * C'est un up vers le parent canonique (navigate, jamais history.back),
   * pas un back temporel : le libellé nomme la destination, le geste reste
   * prévisible quel que soit le point d'entrée. Convention complète :
   * docs/ui-conventions.md.
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

<button class="btn btn-ghost btn-sm -ms-2 mb-3 gap-1" onclick={go} {disabled}>
  <ArrowLeft class="size-4" aria-hidden="true" />
  {label}
</button>
