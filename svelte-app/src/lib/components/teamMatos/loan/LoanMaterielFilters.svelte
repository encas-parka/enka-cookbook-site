<script lang="ts">
  /**
   * Facettes de la sidebar du dossier emprunt : types de l'inventaire et
   * segments d'affichage, tous deux multi-sélection (union). Le filtre ne
   * porte que la liste de matériel — la recherche reste en tête de liste.
   */
  import { ListFilter, Package, FunnelX, Funnel } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import CheckboxBadge from "$lib/components/ui/CheckboxBadge.svelte";
  import {
    loanTypeLabel,
    type LoanSegment,
  } from "$lib/utils/materiel-list.utils";

  export interface LoanListFilters {
    types: string[];
    segments: LoanSegment[];
  }

  interface Props {
    filters: LoanListFilters;
    /** Types présents dans l'inventaire de l'équipe, ordre canonique. */
    availableTypes: string[];
    disabled?: boolean;
    onReset: () => void;
  }

  let {
    filters = $bindable(),
    availableTypes,
    disabled = false,
    onReset,
  }: Props = $props();

  const segmentOptions: { value: LoanSegment; label: string }[] = [
    { value: "selected", label: "Sélectionnés" },
    { value: "unselected", label: "Non sélectionnés" },
    { value: "available", label: "Disponible" },
  ];

  function toggleArrayItem<T>(array: T[], item: T) {
    const index = array.indexOf(item);
    if (index === -1) {
      array.push(item);
    } else {
      array.splice(index, 1);
    }
    // Trigger reactivity
    filters = { ...filters };
  }
</script>

<div class="space-y-4" class:opacity-30={disabled}>
  <div class="mb-4 flex items-center justify-between">
    <h4 class="text-lg font-bold">
      <Funnel class="inline size-4 align-baseline" /> Filtres
    </h4>
    <button class="btn btn-sm btn-warning" onclick={onReset} {disabled}>
      <FunnelX class="h-4 w-4" />
      Effacer
    </button>
  </div>

  <!-- Types -->
  <Fieldset legend="Type" iconComponent={Package}>
    <div class="flex flex-wrap gap-3">
      {#each availableTypes as type (type)}
        <CheckboxBadge
          checked={filters.types.includes(type)}
          label={loanTypeLabel(type)}
          onchange={() => toggleArrayItem(filters.types, type)}
          {disabled}
          color="secondary"
          size="md"
        />
      {/each}
    </div>
  </Fieldset>

  <!-- Segments (union) -->
  <Fieldset legend="Affichage" iconComponent={ListFilter}>
    <div class="flex flex-wrap gap-3">
      {#each segmentOptions as opt (opt.value)}
        <CheckboxBadge
          checked={filters.segments.includes(opt.value)}
          label={opt.label}
          onchange={() => toggleArrayItem(filters.segments, opt.value)}
          {disabled}
          color="secondary"
          size="md"
        />
      {/each}
    </div>
    <p class="mt-2 px-1 text-xs opacity-60">
      Rien de coché : tout l'inventaire est affiché.
    </p>
  </Fieldset>
</div>
