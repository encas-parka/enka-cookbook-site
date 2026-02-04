<script lang="ts">
  import {
    Package,
    MapPin,
    AlertCircle,
    FunnelX,
    Calendar,
    Funnel,
  } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import CheckboxBadge from "$lib/components/ui/CheckboxBadge.svelte";
  import RadioBadgeGroup from "$lib/components/ui/RadioBadgeGroup.svelte";

  export interface MaterielFiltersType {
    types: string[]; // Sélection multiple
    locations: string[]; // Sélection multiple
    statuses: string[]; // Sélection multiple
  }

  interface Props {
    filters: MaterielFiltersType; // Bindable
    disabled?: boolean;
    availableTypes: string[];
    availableLocations: string[];
    availableStatuses: string[];
    onReset: () => void;
  }

  let {
    filters = $bindable(),
    disabled = false,
    availableTypes,
    availableLocations,
    availableStatuses,
    onReset,
  }: Props = $props();

  // Gestion des checkboxes multiples
  function toggleArrayItem(array: string[], item: string) {
    const index = array.indexOf(item);
    if (index === -1) {
      array.push(item);
    } else {
      array.splice(index, 1);
    }
    // Trigger reactivity
    filters = { ...filters };
  }

  // Labels pour les types
  function getTypeLabel(type): string {
    const labels = {
      electronic: "Électronique",
      manual: "Manuel",
      other: "Autre",
      tools: "Outils",
      dish: "Vaisselle",
      cooking: "Cuisine",
      gaz: "Gaz",
      hygiene: "Hygiène",
    };
    return labels[type] || type;
  }

  // Labels pour les statuts
  function getStatusLabel(status): string {
    const labels = {
      ok: "OK",
      lost: "Perdu",
      loan: "Utilisé",
      reserved: "Réservé",
      torepair: "À réparer",
    };
    return labels[status] || status;
  }
</script>

<div class="mt-16 space-y-4" class:opacity-30={disabled}>
  <div class="mb-4 flex items-center justify-between">
    <h4 class="text-lg font-bold">
      <Funnel class="inline size-4 align-baseline" /> Filtres
    </h4>
    <button class="btn btn-warning btn-sm" onclick={onReset} {disabled}>
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
          label={getTypeLabel(type)}
          onchange={() => toggleArrayItem(filters.types, type)}
          {disabled}
          color="secondary"
          size="md"
        />
      {/each}
    </div>
  </Fieldset>

  <!-- Lieux -->
  <Fieldset legend="Lieu" iconComponent={MapPin}>
    <div class="flex flex-wrap gap-3">
      {#each availableLocations as location (location)}
        <CheckboxBadge
          checked={filters.locations.includes(location)}
          label={location}
          onchange={() => toggleArrayItem(filters.locations, location)}
          {disabled}
          color="secondary"
          size="md"
        />
      {/each}
    </div>
  </Fieldset>

  <!-- Statuts -->
  <Fieldset legend="Statut" iconComponent={AlertCircle}>
    <div class="flex flex-wrap gap-3">
      {#each availableStatuses as status (status)}
        <CheckboxBadge
          checked={filters.statuses.includes(status)}
          label={getStatusLabel(status)}
          onchange={() => toggleArrayItem(filters.statuses, status)}
          {disabled}
          color="secondary"
          size="md"
        />
      {/each}
    </div>
  </Fieldset>
</div>
