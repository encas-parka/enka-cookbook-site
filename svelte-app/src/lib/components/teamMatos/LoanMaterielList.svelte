<script lang="ts">
  import {
    AlertTriangle,
    ChevronDown,
    ChefHat,
    Flame,
    Hammer,
    Package,
    Plus,
    Search,
    SoapDispenserDroplet,
    Utensils,
    Wrench,
    X,
    Zap,
  } from "@lucide/svelte";
  import type { Component } from "svelte";
  import CatalogItemRow from "./CatalogItemRow.svelte";
  import type {
    GhostLoanItem,
    LoanListSegment,
    MaterielGroup,
    MaterielWithAvailability,
  } from "$lib/utils/materiel-list.utils";
  import {
    clampQuantity,
    countAvailable,
    filterLoanMateriels,
    groupMaterielsByType,
    summarizeSelection,
  } from "$lib/utils/materiel-list.utils";

  interface Props {
    /** Matériels vivants de l'équipe, dispo calculée sur la période. */
    materiels: MaterielWithAvailability[];
    /** Items de l'emprunt dont le matériel a disparu de l'inventaire (édition). */
    ghostItems?: GhostLoanItem[];
    loading?: boolean;
    /** Projection réactive de la sélection (lecture côté parent, mutation ici). */
    quantities?: Record<string, number>;
  }

  let {
    materiels,
    ghostItems = [],
    loading = false,
    quantities = $bindable({}),
  }: Props = $props();

  let search = $state("");
  let segment = $state<LoanListSegment>("all");
  /** Types repliés ; le premier groupe est ouvert, la recherche force l'ouverture. */
  let collapsed = $state<Set<string>>(new Set());

  const searchActive = $derived(search.trim().length > 0);

  const groups = $derived(groupMaterielsByType(materiels));

  const filteredGroups = $derived(
    groups
      .map((g) => ({
        ...g,
        items: filterLoanMateriels(g.items, {
          segment,
          quantities,
          search,
        }),
      }))
      .filter((g) => g.items.length > 0),
  );

  const allUnavailable = $derived(
    materiels.length > 0 && countAvailable(materiels) === 0,
  );

  const summary = $derived(summarizeSelection(quantities));

  const segmentOptions: { value: LoanListSegment; label: string }[] = [
    { value: "all", label: "Tout" },
    { value: "selected", label: "Sélectionnés" },
    { value: "unselected", label: "Non sélectionnés" },
    { value: "available", label: "Disponible" },
  ];

  const typeLabels: Record<string, string> = {
    cooking: "Matériel de cuisine",
    dish: "Vaisselle",
    gaz: "Gaz",
    hygiene: "Hygiène",
    electronic: "Électronique",
    manual: "Ustensiles",
    tools: "Outils",
    other: "Autre",
  };

  const typeIcons: Record<string, Component<any>> = {
    cooking: ChefHat,
    dish: Utensils,
    gaz: Flame,
    hygiene: SoapDispenserDroplet,
    electronic: Zap,
    manual: Wrench,
    tools: Hammer,
    other: Package,
  };

  function isOpen(type: string): boolean {
    // La recherche et le filtre « Sélectionnés » forcent l'ouverture : les
    // groupes visibles portent alors toujours du contenu à montrer.
    return searchActive || segment === "selected" || !collapsed.has(type);
  }

  function toggleGroup(type: string) {
    const next = new Set(collapsed);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    collapsed = next;
  }

  function setQuantity(item: MaterielWithAvailability, qty: number) {
    const max = item.availableForPeriod ?? 0;
    quantities = { ...quantities, [item.id]: clampQuantity(qty, max) };
  }

  function takeAllVisible() {
    const next = { ...quantities };
    for (const g of filteredGroups) {
      for (const item of g.items) {
        const max = item.availableForPeriod ?? 0;
        if (max > 0) next[item.id] = max;
      }
    }
    quantities = next;
  }

  const canTakeAll = $derived(
    filteredGroups.some((g) =>
      g.items.some(
        (m) => (m.availableForPeriod ?? 0) > (quantities[m.id] ?? 0),
      ),
    ),
  );

  // --- API impérative (bind:this côté parent) ---

  /** Réinitialise la sélection et les filtres ; le premier groupe reste ouvert. */
  export function reset(initial: Record<string, number>) {
    quantities = { ...initial };
    search = "";
    segment = "all";
    collapsed = new Set(groups.slice(1).map((g) => g.type));
  }

  /** Items sélectionnés (quantité >= 1) avec le nom figé au moment du submit. */
  export function getSelectedItems(): {
    materielId: string;
    materielName: string;
    quantity: number;
  }[] {
    const nameById = new Map(materiels.map((m) => [m.id, m.name]));
    return Object.entries(quantities)
      .filter(([, qty]) => qty >= 1)
      .map(([materielId, quantity]) => ({
        materielId,
        materielName: nameById.get(materielId) ?? "",
        quantity,
      }));
  }

  /**
   * Écriture parent (résolution des conflits après confirmation) : applique
   * les quantités en les replafonnant à la disponibilité réelle.
   */
  export function applyQuantities(next: Record<string, number>) {
    const byId = new Map(materiels.map((m) => [m.id, m]));
    const applied: Record<string, number> = {};
    for (const [id, qty] of Object.entries(next)) {
      const item = byId.get(id);
      applied[id] = item ? clampQuantity(qty, item.availableForPeriod ?? 0) : 0;
    }
    quantities = applied;
  }
</script>

<div class="space-y-3">
  {#if materiels.length === 0 && ghostItems.length === 0}
    <div class="py-8 text-center opacity-50">
      <Package class="mx-auto mb-2 h-12 w-12" />
      <p class="text-sm">Aucun matériel dans l'inventaire de l'équipe</p>
    </div>
  {:else}
    <div class="sticky top-0 z-10 space-y-2 bg-base-100 py-2">
      <label class="input w-full input-md">
        <Search class="size-4 opacity-50" />
        <input
          type="text"
          bind:value={search}
          placeholder="Rechercher du matériel…"
          autocomplete="off"
          disabled={loading}
        />
        {#if searchActive}
          <button
            class="btn btn-circle btn-ghost btn-xs"
            onclick={() => (search = "")}
            aria-label="Effacer la recherche"
          >
            <X class="size-3" />
          </button>
        {/if}
      </label>

      <div class="join w-full">
        {#each segmentOptions as opt (opt.value)}
          <button
            class="btn join-item flex-1 btn-sm {segment === opt.value
              ? 'btn-primary'
              : 'btn-outline'}"
            onclick={() => (segment = opt.value)}
            disabled={loading}
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <div class="flex items-center justify-between px-1">
        <span class="text-xs opacity-70">
          {summary.itemCount}
          matériel{summary.itemCount > 1 ? "s" : ""}&nbsp;—
          {summary.totalUnits}&nbsp;unité{summary.totalUnits > 1 ? "s" : ""}
        </span>
        <button
          class="link text-xs font-medium link-primary {canTakeAll
            ? ''
            : 'link-disabled'}"
          onclick={takeAllVisible}
          disabled={loading || !canTakeAll}
        >
          <Plus class="inline size-3" />
          Tout prendre
        </button>
      </div>
    </div>

    {#if allUnavailable}
      <div class="alert alert-soft alert-warning">
        <AlertTriangle class="h-5 w-5" />
        <span>
          Aucun matériel disponible pour la période sélectionnée. Vous pouvez
          modifier les dates ou contacter l'équipe prêteuse.
        </span>
      </div>
    {/if}

    {#if ghostItems.length > 0}
      <div class="rounded-lg border border-base-300 bg-base-200/50 p-2">
        <p class="mb-2 px-1 text-xs font-semibold uppercase opacity-60">
          Hors inventaire ({ghostItems.length})
        </p>
        <div class="space-y-1">
          {#each ghostItems as ghost (ghost.materielId)}
            <CatalogItemRow
              name={ghost.materielName}
              quantity={ghost.quantity}
              size="md"
              disabled
              unavailableLabel="Supprimé"
              onchange={() => {}}
            />
          {/each}
        </div>
      </div>
    {/if}

    {#each filteredGroups as group (group.type)}
      {@const TypeIcon = typeIcons[group.type] ?? Package}
      {@const selectedCount = group.items.filter(
        (m) => (quantities[m.id] ?? 0) >= 1,
      ).length}
      <div class="rounded-lg border border-base-300 bg-base-200">
        <button
          class="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold"
          onclick={() => toggleGroup(group.type)}
          aria-expanded={isOpen(group.type)}
        >
          <TypeIcon class="size-4 opacity-70" />
          {typeLabels[group.type] ?? group.type}
          {#if selectedCount > 0}
            <span class="badge badge-sm tabular-nums badge-primary"
              >{selectedCount}</span
            >
          {/if}
          <ChevronDown
            class="ml-auto size-4 opacity-50 transition-transform {isOpen(
              group.type,
            )
              ? ''
              : '-rotate-90'}"
          />
        </button>
        {#if isOpen(group.type)}
          <div class="space-y-1 px-3 pb-3">
            {#each group.items as item (item.id)}
              {@const max = item.availableForPeriod ?? 0}
              <div class="materiel-row">
                <CatalogItemRow
                  name={item.name}
                  quantity={quantities[item.id] ?? 0}
                  maxQuantity={max}
                  showTakeAll
                  showClear
                  size="md"
                  badge={`${max}/${item.quantity}`}
                  disabled={loading || max === 0}
                  unavailableLabel="Indisponible"
                  onchange={(qty) => setQuantity(item, qty)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="py-8 text-center opacity-60">
        <Package class="mx-auto mb-2 h-10 w-10" />
        <p class="text-sm">Aucun résultat pour « {search} »</p>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* Inventaire ~110 items : skip layout/paint des rows hors viewport
     (guideline >50 items) ; auto mémorise la dernière taille rendue. */
  .materiel-row {
    content-visibility: auto;
    contain-intrinsic-size: auto 60px;
  }
</style>
