<script lang="ts">
  /**
   * Facettes de la sidebar du dossier emprunt : type exclusif, segment
   * d'affichage exclusif et restriction « disponible » indépendante (ET).
   * Le filtre ne porte que la liste de matériel — la recherche reste en
   * tête de liste.
   */
  import { ListFilter, Package, FunnelX, Funnel } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import CheckboxBadge from "$lib/components/ui/CheckboxBadge.svelte";
  import {
    loanTypeLabel,
    type LoanListFilters,
  } from "$lib/utils/materiel-list.utils";

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

  function setFilter(patch: Partial<LoanListFilters>) {
    filters = { ...filters, ...patch };
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

  <!-- Type : sélecteur exclusif -->
  <Fieldset legend="Type" iconComponent={Package}>
    <div class="bg-base-100 flex flex-wrap gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm flex-1 {filters.type === '' && 'btn-secondary'}"
        type="button"
        aria-pressed={filters.type === ""}
        onclick={() => setFilter({ type: "" })}
      >
        Tous
      </button>
      {#each availableTypes as type (type)}
        <button
          class="btn btn-sm min-w-fit flex-1 {filters.type === type &&
            'btn-secondary'}"
          type="button"
          aria-pressed={filters.type === type}
          onclick={() => setFilter({ type })}
        >
          {loanTypeLabel(type)}
        </button>
      {/each}
    </div>
  </Fieldset>

  <!-- Affichage : segment exclusif + disponible indépendant -->
  <Fieldset legend="Affichage" iconComponent={ListFilter}>
    <div class="bg-base-100 flex flex-wrap gap-1 rounded-xl p-2 font-semibold">
      <button
        class="btn btn-sm min-w-fit flex-1 {filters.segment === '' &&
          'btn-secondary'}"
        type="button"
        aria-pressed={filters.segment === ""}
        onclick={() => setFilter({ segment: "" })}
      >
        Tous
      </button>
      <button
        class="btn btn-sm min-w-fit flex-1 {filters.segment === 'selected' &&
          'btn-secondary'}"
        type="button"
        aria-pressed={filters.segment === "selected"}
        onclick={() => setFilter({ segment: "selected" })}
      >
        Sélectionnés
      </button>
      <button
        class="btn btn-sm min-w-fit flex-1 {filters.segment === 'unselected' &&
          'btn-secondary'}"
        type="button"
        aria-pressed={filters.segment === "unselected"}
        onclick={() => setFilter({ segment: "unselected" })}
      >
        Non sélectionnés
      </button>
    </div>
    <div class="mt-2">
      <CheckboxBadge
        checked={filters.availableOnly}
        label="Disponible sur la période"
        onchange={() => setFilter({ availableOnly: !filters.availableOnly })}
        {disabled}
        color="secondary"
        size="md"
      />
    </div>
  </Fieldset>
</div>
