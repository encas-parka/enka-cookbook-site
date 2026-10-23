<script lang="ts">
  /**
   * Liste plate de sélection du matériel d'un emprunt : recherche locale,
   * groupes par type, quantités par item.
   *
   * Les filtres (type exclusif, segment exclusif, disponible) vivent dans un
   * objet bindable partagé avec la sidebar de la page dossier. Sous la
   * recherche, un sélecteur de segment compact complete la sidebar là où
   * elle n'est pas visible : mobile (page) et modal.
   *
   * Regroupement : en desktop les groupes sont toujours ouverts et leur
   * en-tête n'est pas interactif ; en mobile ils sont repliés au départ et
   * se comportent en accordéon — sauf quand la recherche est active ou que
   * le segment « Sélectionnés » est affiché : tous les groupes non vides
   * s'ouvrent.
   */
  import {
    AlertTriangle,
    ChevronDown,
    Info,
    Package,
    Plus,
    Search,
    X,
  } from "@lucide/svelte";
  import CatalogItemRow from "./CatalogItemRow.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type {
    GhostLoanItem,
    LoanListFilters,
    MaterielGroup,
    MaterielWithAvailability,
  } from "$lib/utils/materiel-list.utils";
  import {
    clampQuantity,
    countAvailable,
    EMPTY_LOAN_FILTERS,
    filterLoanMateriels,
    groupMaterielsByType,
    loanTypeLabel,
  } from "$lib/utils/materiel-list.utils";
  import MaterielTypeGroup from "./MaterielTypeGroup.svelte";

  interface Props {
    /** Matériels vivants de l'équipe, dispo calculée sur la période. */
    materiels: MaterielWithAvailability[];
    /** Items de l'emprunt dont le matériel a disparu de l'inventaire (édition). */
    ghostItems?: GhostLoanItem[];
    loading?: boolean;
    /** Projection réactive de la sélection (lecture côté parent, mutation ici). */
    quantities?: Record<string, number>;
    /**
     * Filtres partagés avec la sidebar (type, segment, disponible) ; les
     * mutations du sélecteur compact sous la recherche remontent au parent.
     */
    filter?: LoanListFilters;
    /**
     * Affiche le sélecteur de segment sous la recherche même en desktop :
     * pour le modal, qui n'a pas de sidebar.
     */
    showSegmentInline?: boolean;
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
    filter = $bindable({ ...EMPTY_LOAN_FILTERS }),
    showSegmentInline = false,
    stickyClass = "-top-4 sm:-top-2",
  }: Props = $props();

  let search = $state("");
  /** Groupe déplié en mobile (accordéon) ; ignoré en desktop / recherche. */
  let openType = $state<string | null>(null);
  /** Bandeaux de sélection dépliés (voir tous) ou limités à deux lignes. */
  let badgesOpen = $state(false);

  const searchActive = $derived(search.trim().length > 0);
  /** Contextes où l'accordéon cède : tous les groupes non vides sont ouverts. */
  const forcedOpen = $derived(searchActive || filter.segment === "selected");

  const showInlineSegment = $derived(
    showSegmentInline || !globalState.isDesktop,
  );

  const groups = $derived(groupMaterielsByType(materiels));

  const filteredGroups = $derived(
    groups
      .filter((g) => !filter.type || g.type === filter.type)
      .map((g) => ({
        ...g,
        items: filterLoanMateriels(g.items, {
          segment: filter.segment,
          availableOnly: filter.availableOnly,
          quantities,
          search,
        }),
      }))
      .filter((g) => g.items.length > 0),
  );

  const allUnavailable = $derived(
    materiels.length > 0 && countAvailable(materiels) === 0,
  );

  /** Sélection courante, pour les badges récapitulatifs cliquables. */
  const selectedItems = $derived.by(() => {
    const nameById = new Map(materiels.map((m) => [m.id, m.name]));
    return Object.entries(quantities)
      .filter(([, qty]) => qty >= 1)
      .map(([id, qty]) => ({ id, name: nameById.get(id) ?? "", qty }));
  });

  const segmentInlineOptions: {
    value: LoanListFilters["segment"];
    label: string;
  }[] = [
    { value: "", label: "Tous" },
    { value: "selected", label: "Sélectionnés" },
    { value: "unselected", label: "Non sélectionnés" },
  ];

  function isOpen(type: string): boolean {
    return globalState.isDesktop || forcedOpen || openType === type;
  }

  function setFilter(patch: Partial<LoanListFilters>) {
    filter = { ...filter, ...patch };
  }

  /**
   * Ouvre le groupe du matériel puis fait défiler jusqu'à sa rangée —
   * utile depuis un badge de sélection, surtout en mobile où les groupes
   * sont repliés.
   */
  function scrollToMateriel(id: string) {
    const group = groups.find((g) => g.items.some((m) => m.id === id));
    if (group && !isOpen(group.type)) openType = group.type;
    setTimeout(() => {
      document
        .getElementById(`loan-materiel-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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

  /** Réinitialise la sélection, la recherche et les groupes (mobile). */
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

      {#if showInlineSegment}
        <!-- Sélecteur compact : la sidebar n'est pas visible ici (mobile,
             modal) — même état que les facettes, mutations partagées -->
        <div
          class="flex flex-wrap gap-1 rounded-xl bg-base-200 p-1 font-semibold"
        >
          {#each segmentInlineOptions as opt (opt.value)}
            <button
              class="btn flex-1 btn-sm {filter.segment === opt.value &&
                'btn-secondary'}"
              type="button"
              aria-pressed={filter.segment === opt.value}
              onclick={() => setFilter({ segment: opt.value })}
              disabled={loading}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="alert alert-soft alert-info">
      <Info class="size-5" />
      Sélectionner le matériel que vous souhaitez emprunter en indiquant les quantités
      voulues
    </div>
    {#if selectedItems.length > 0}
      <!-- Récapitulatif de la sélection : plié à deux lignes, badges
           cliquables (défile vers la rangée du matériel) -->
      <div class="rounded-2xl border border-base-200 bg-base-200/60 p-2">
        <div class=" text-base-content/70">Votre réservation :</div>
        <div
          class="flex flex-wrap gap-1 overflow-hidden py-2 {badgesOpen
            ? 'max-h-none'
            : 'max-h-18'}"
        >
          {#each selectedItems as sel (sel.id)}
            <button
              class="btn gap-1 btn-soft btn-sm"
              type="button"
              title="Aller au matériel dans la liste"
              onclick={() => scrollToMateriel(sel.id)}
            >
              {sel.name}
              <span class="font-bold tabular-nums">×{sel.qty}</span>
            </button>
          {/each}
        </div>
        <button
          class="flex w-full items-center justify-center gap-1 pb-1 text-xs text-base-content/60 italic"
          type="button"
          aria-expanded={badgesOpen}
          onclick={() => (badgesOpen = !badgesOpen)}
        >
          {badgesOpen ? "masquer" : `tout voir (${selectedItems.length})`}
          <ChevronDown
            class="h-3.5 w-3.5 transition-transform {badgesOpen
              ? 'rotate-180'
              : ''}"
          />
        </button>
      </div>
    {/if}

    <div
      class="mx-auto mt-4 flex max-w-3xl items-center justify-end gap-3 px-1"
    >
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
      {@const selectedCount = group.items.filter(
        (m) => (quantities[m.id] ?? 0) >= 1,
      ).length}
      <div class="mx-auto max-w-3xl">
        <MaterielTypeGroup
          type={group.type}
          label={loanTypeLabel(group.type)}
          count={selectedCount > 0 ? selectedCount : undefined}
          countBadgeClass="badge-primary"
          collapsible
          {forcedOpen}
          bind:openType
        >
          {#each group.items as item (item.id)}
            {@const max = item.availableForPeriod ?? 0}
            <div class="materiel-row scroll-mt-24" id="loan-materiel-{item.id}">
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
        </MaterielTypeGroup>
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
