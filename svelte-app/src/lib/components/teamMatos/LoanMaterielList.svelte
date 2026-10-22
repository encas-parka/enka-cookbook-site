<script lang="ts">
  /**
   * Liste plate de sélection du matériel d'un emprunt : recherche locale,
   * groupes par type, quantités par item.
   *
   * Les facettes (types + segments) viennent de la sidebar de la page
   * dossier et restent vides dans le modal (tout afficher) ; la recherche,
   * elle, reste propre à la liste.
   *
   * Regroupement : en desktop les groupes sont toujours ouverts et leur
   * en-tête n'est pas interactif ; en mobile ils sont repliés au départ et
   * se comportent en accordéon — sauf quand la recherche est active ou que
   * le segment « Sélectionnés » est coché : tous les groupes non vides
   * s'ouvrent.
   */
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
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type {
    GhostLoanItem,
    LoanSegment,
    MaterielGroup,
    MaterielWithAvailability,
  } from "$lib/utils/materiel-list.utils";
  import {
    clampQuantity,
    countAvailable,
    filterLoanMateriels,
    groupMaterielsByType,
    loanTypeLabel,
  } from "$lib/utils/materiel-list.utils";

  interface Props {
    /** Matériels vivants de l'équipe, dispo calculée sur la période. */
    materiels: MaterielWithAvailability[];
    /** Items de l'emprunt dont le matériel a disparu de l'inventaire (édition). */
    ghostItems?: GhostLoanItem[];
    loading?: boolean;
    /** Projection réactive de la sélection (lecture côté parent, mutation ici). */
    quantities?: Record<string, number>;
    /** Types affichés (facette sidebar) ; vide = tous. */
    typeFilter?: string[];
    /** Segments actifs (facette sidebar, union) ; vide = tous. */
    segments?: LoanSegment[];
    /**
     * Point d'ancrage de la barre sticky, selon l'enveloppe : la modale
     * compense le padding du scroll container, la page se cale sous la
     * navbar (top-12).
     */
    stickyClass?: string;
  }

  let {
    materiels,
    ghostItems = [],
    loading = false,
    quantities = $bindable({}),
    typeFilter = [],
    segments = [],
    stickyClass = "-top-4 sm:-top-2",
  }: Props = $props();

  let search = $state("");
  /** Groupe déplié en mobile (accordéon) ; ignoré en desktop / recherche. */
  let openType = $state<string | null>(null);

  const searchActive = $derived(search.trim().length > 0);
  /** Contextes où l'accordéon cède : tous les groupes non vides sont ouverts. */
  const forcedOpen = $derived(searchActive || segments.includes("selected"));

  const groups = $derived(groupMaterielsByType(materiels));

  const filteredGroups = $derived(
    groups
      .filter((g) => typeFilter.length === 0 || typeFilter.includes(g.type))
      .map((g) => ({
        ...g,
        items: filterLoanMateriels(g.items, {
          segments,
          quantities,
          search,
        }),
      }))
      .filter((g) => g.items.length > 0),
  );

  const allUnavailable = $derived(
    materiels.length > 0 && countAvailable(materiels) === 0,
  );

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
    return globalState.isDesktop || forcedOpen || openType === type;
  }

  /** Accordéon mobile : déplier un groupe replie l'éventuel autre. */
  function toggleGroup(type: string) {
    openType = openType === type ? null : type;
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

  function clearAllVisible() {
    const next = { ...quantities };
    for (const g of filteredGroups) {
      for (const item of g.items) {
        if ((next[item.id] ?? 0) >= 1) next[item.id] = 0;
      }
    }
    quantities = next;
  }

  const canClearVisible = $derived(
    filteredGroups.some((g) =>
      g.items.some((m) => (quantities[m.id] ?? 0) >= 1),
    ),
  );

  const canTakeAll = $derived(
    filteredGroups.some((g) =>
      g.items.some(
        (m) => (m.availableForPeriod ?? 0) > (quantities[m.id] ?? 0),
      ),
    ),
  );

  // --- API impérative (bind:this côté parent) ---

  /** Réinitialise la sélection et la recherche ; groupes repliés (mobile). */
  export function reset(initial: Record<string, number>) {
    quantities = { ...initial };
    search = "";
    openType = null;
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
    <!-- Ancrage sticky défini par l'enveloppe (modal : compense le padding
         du scroll container ; page : se cale sous la navbar) -->
    <div class="sticky z-10 space-y-2 bg-base-100 py-2 {stickyClass}">
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
    </div>

    <div class="flex items-center justify-end gap-3 px-1">
      <button
        class="link text-xs font-medium link-error {canClearVisible
          ? ''
          : 'link-disabled'}"
        onclick={clearAllVisible}
        disabled={loading || !canClearVisible}
      >
        Tout retirer
      </button>
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
        {#if globalState.isDesktop}
          <!-- Desktop : structure de lecture, jamais repliable. -->
          <div
            class="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold"
          >
            <TypeIcon class="size-4 opacity-70" />
            {loanTypeLabel(group.type)}
            {#if selectedCount > 0}
              <span class="badge badge-sm tabular-nums badge-primary"
                >{selectedCount}</span
              >
            {/if}
          </div>
        {:else}
          <button
            class="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold"
            onclick={() => toggleGroup(group.type)}
            aria-expanded={isOpen(group.type)}
          >
            <TypeIcon class="size-4 opacity-70" />
            {loanTypeLabel(group.type)}
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
        {/if}
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
