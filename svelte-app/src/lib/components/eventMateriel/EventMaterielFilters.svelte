<script lang="ts">
  import {
    Funnel,
    FunnelX,
    Package,
    MapPin,
    User,
    CircleDot,
  } from "@lucide/svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import CheckboxBadge from "$lib/components/ui/CheckboxBadge.svelte";

  export interface EventMaterielFiltersState {
    types: string[];
    statuses: string[];
    who: string[];
    where: string[];
    search: string;
  }

  interface Props {
    filters: EventMaterielFiltersState;
    availableTypes: string[];
    availableWho: string[];
    availableWhere: string[];
    availableStatuses: string[];
    onReset: () => void;
    disabled?: boolean;
  }

  let {
    filters = $bindable(),
    availableTypes,
    availableWho,
    availableWhere,
    availableStatuses,
    onReset,
    disabled = false,
  }: Props = $props();

  function toggleArrayItem(array: string[], item: string) {
    const index = array.indexOf(item);
    if (index === -1) {
      array.push(item);
    } else {
      array.splice(index, 1);
    }
    filters = { ...filters };
  }

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
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

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      to_find: "À trouver",
      to_check: "À vérifier",
      confirmed: "Ok",
    };
    return labels[status] || status;
  }
</script>

<div class="space-y-4" class:opacity-30={disabled}>
  <div class="mb-4 flex items-center justify-between">
    <h4 class="text-lg font-bold">
      <Funnel class="inline size-4 align-baseline" /> Filtres
    </h4>
    <button class="btn btn-warning btn-sm" onclick={onReset} {disabled}>
      <FunnelX class="h-4 w-4" />
      Effacer
    </button>
  </div>

  <!-- Recherche -->
  <div>
    <input
      type="text"
      class="input input-sm input-bordered w-full"
      placeholder="Rechercher..."
      bind:value={filters.search}
      {disabled}
    />
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

  <!-- Statuts -->
  <Fieldset legend="Statut" iconComponent={CircleDot}>
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

  <!-- Who (Personne) -->
  {#if availableWho.length > 0}
    <Fieldset legend="Qui ?" iconComponent={User}>
      <div class="flex flex-wrap gap-3">
        <!-- Option "Personne" (sans who) -->
        <CheckboxBadge
          checked={filters.who.includes("__none__")}
          label="Personne"
          onchange={() => toggleArrayItem(filters.who, "__none__")}
          {disabled}
          color="warning"
          size="md"
        />
        {#each availableWho as who (who)}
          <CheckboxBadge
            checked={filters.who.includes(who)}
            label={who}
            onchange={() => toggleArrayItem(filters.who, who)}
            {disabled}
            color="secondary"
            size="md"
          />
        {/each}
      </div>
    </Fieldset>
  {/if}

  <!-- Where (Lieu) -->
  {#if availableWhere.length > 0}
    <Fieldset legend="Où ?" iconComponent={MapPin}>
      <div class="flex flex-wrap gap-3">
        <!-- Option "À trouver" (sans where) -->
        <CheckboxBadge
          checked={filters.where.includes("__none__")}
          label="À trouver"
          onchange={() => toggleArrayItem(filters.where, "__none__")}
          {disabled}
          color="warning"
          size="md"
        />
        {#each availableWhere as where (where)}
          <CheckboxBadge
            checked={filters.where.includes(where)}
            label={where}
            onchange={() => toggleArrayItem(filters.where, where)}
            {disabled}
            color="secondary"
            size="md"
          />
        {/each}
      </div>
    </Fieldset>
  {/if}
</div>
