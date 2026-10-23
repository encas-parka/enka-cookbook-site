<script lang="ts">
  /**
   * Rangée de lecture d'un item d'emprunt (fiche figée, retour en
   * lecture seule) : icône du type en couleur attenuée, nom, quantité
   * portée en « ×N » — les annexes éventuelles (badges d'état du
   * retour) se passent en contenu.
   *
   * Le vocabulaire visuel est celui des rangées de sélection
   * (`CatalogItemRow`) : conteneur bordé sur fond clair, dans un
   * `MaterielTypeGroup` — seule l'icône distingue la lecture de la
   * saisie.
   */
  import type { Snippet } from "svelte";
  import {
    getMaterielTypeColorClass,
    getMaterielTypeIcon,
  } from "$lib/utils/materiel.utils";

  interface Props {
    name: string;
    /** Quantité empruntée. */
    quantity: number;
    type?: string | null;
    /** Badges ou annexes à droite (état de retour, notes…). */
    children?: Snippet;
  }

  let { name, quantity, type = null, children }: Props = $props();

  const Icon = $derived(getMaterielTypeIcon(type));
</script>

<div
  class="border-base-300 bg-base-100 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
>
  <div class="flex min-w-0 items-center gap-2">
    <Icon
      class="size-5 shrink-0 opacity-70 {getMaterielTypeColorClass(type)}"
    />
    <span class="min-w-0 truncate text-base font-medium">{name}</span>
    <span class="badge badge-ghost tabular-nums">×{quantity}</span>
  </div>
  <div class="ms-auto flex flex-wrap items-center gap-2">
    {@render children?.()}
  </div>
</div>
