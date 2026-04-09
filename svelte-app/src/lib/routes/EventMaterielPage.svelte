<script lang="ts">
  import { onMount } from "svelte";
  import {
    Plus,
    LoaderCircle,
    Package,
    X,
    ListPlus,
    ArrowDownToLine,
    Download,
    ClipboardCopy,
  } from "@lucide/svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { route } from "$lib/router";
  import EventMaterielCard from "$lib/components/eventMateriel/EventMaterielCard.svelte";
  import EventMaterielForm from "$lib/components/eventMateriel/EventMaterielForm.svelte";
  import EventMaterielFilters, {
    type EventMaterielFiltersState,
  } from "$lib/components/eventMateriel/EventMaterielFilters.svelte";
  import EditEventMaterielModal from "$lib/components/eventMateriel/EditEventMaterielModal.svelte";
  import QuickAddEventCatalogModal from "$lib/components/eventMateriel/QuickAddEventCatalogModal.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import type { EventMateriel } from "$lib/types/appwrite";
  import type {
    CreateEventMaterielData,
    UpdateEventMaterielData,
    EventMaterielFilters as EventMaterielFilterOptions,
  } from "$lib/types/event-materiel.types";
  import { online } from "svelte/reactivity/window";
  import { isDemoEvent } from "$lib/data/demo-event-config";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  // Labels pour les types
  const typeLabels: Record<string, string> = {
    electronic: "Électronique",
    manual: "Manuel",
    other: "Autre",
    tools: "Outils",
    dish: "Vaisselle",
    cooking: "Cuisine",
    gaz: "Gaz",
    hygiene: "Hygiène",
  };

  // Route params
  let eventId = $derived(route.params.id ?? "");
  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  // Permissions
  const canEdit = $derived(
    (currentEvent && isDemoEvent(currentEvent.$id)) ||
      (online.current &&
        eventsStore.canUserEditEvent(eventId || "", globalState.userId || "") &&
        currentEvent?.status !== "canceled"),
  );

  // UI State
  let showForm = $state(false);
  let catalogModalOpen = $state(false);
  let editingItemId = $state<string | null>(null);
  let deleteTarget = $state<EventMateriel | null>(null);
  let editLoanId = $state<string | null>(null);
  let importLoanModalOpen = $state(false);
  let importTeamId = $state<string | null>(null);

  // Lazy-loaded CreateLoanModal component
  let CreateLoanModal:
    | typeof import("$lib/components/teamMatos/CreateLoanModal.svelte").default
    | null = $state(null);

  const myTeams = $derived(nativeTeamsStore.myTeams);

  // Set of loanIds the current user can manage (is member of the owning team)
  const userAccessibleLoanIds = $derived.by(() => {
    const myTeamIds = new Set(myTeams.map((t) => t.$id));
    const loanIds = new Set<string>();
    for (const item of eventMaterielStore.items) {
      if (item.loanId) {
        const loan = materielStore.getLoanById(item.loanId);
        if (loan && myTeamIds.has(loan.ownerId)) {
          loanIds.add(item.loanId);
        }
      }
    }
    return loanIds;
  });

  function canEditWhereForItem(item: EventMateriel): boolean {
    if (!item.loanId) return true;
    return userAccessibleLoanIds.has(item.loanId);
  }

  async function loadCreateLoanModal() {
    if (!CreateLoanModal) {
      const mod =
        await import("$lib/components/teamMatos/CreateLoanModal.svelte");
      CreateLoanModal = mod.default;
    }
  }

  // Filtres
  let filters = $state<EventMaterielFiltersState>({
    types: [],
    // statuses: [], // TODO: status derive de where
    who: [],
    where: [],
    search: "",
  });

  // Types disponibles
  const availableTypes = [
    "electronic",
    "manual",
    "other",
    "tools",
    "dish",
    "cooking",
    "gaz",
    "hygiene",
  ];

  // Valeurs disponibles pour les filtres (depuis le store)
  const availableWho = $derived(eventMaterielStore.getUniqueWhoValues());
  const availableWhere = $derived(eventMaterielStore.getUniqueWhereValues());

  // Items filtrés (via store)
  const filteredItems = $derived(
    eventMaterielStore.getFilteredItems(
      {
        types: filters.types as EventMaterielFilterOptions["types"],
        // statuses: filters.statuses, // TODO: status derive de where
        who: filters.who,
        where: filters.where,
        search: filters.search,
      },
      { field: "name", direction: "asc" },
    ),
  );

  // Badges pour les filtres actifs
  interface ActiveBadge {
    id: string;
    label: string;
    color: string;
  }

  const activeBadges = $derived.by<ActiveBadge[]>(() => {
    const badges: ActiveBadge[] = [];

    // Types
    filters.types.forEach((type) => {
      badges.push({
        id: `type:${type}`,
        label: typeLabels[type] || type,
        color: "badge-secondary",
      });
    });

    // Who
    filters.who.forEach((who) => {
      badges.push({
        id: `who:${who}`,
        label: who === "__none__" ? "Personne" : who,
        color: "badge-info",
      });
    });

    // Where
    filters.where.forEach((where) => {
      badges.push({
        id: `where:${where}`,
        label: where === "__none__" ? "À trouver" : where,
        color: "badge-warning",
      });
    });

    return badges;
  });

  function removeBadge(id: string) {
    const [prefix, value] = id.split(":");
    switch (prefix) {
      case "type":
        filters.types = filters.types.filter((t) => t !== value);
        break;
      case "who":
        filters.who = filters.who.filter((w) => w !== value);
        break;
      case "where":
        filters.where = filters.where.filter((w) => w !== value);
        break;
    }
  }

  // Navbar
  $effect(() => {
    if (currentEvent) {
      navBarStore.setConfig({
        title: `Matériel : ${currentEvent.name}`,
        actions: navActions,
      });
    }
  });

  // Reset filtres
  function resetFilters() {
    filters = { types: [], who: [], where: [], search: "" };
  }

  function handleExport() {
    const name = currentEvent?.name ?? "materiel";
    const markdown = eventMaterielStore.exportToMarkdown(name, filteredItems);
    if (!markdown) return;
    shareOrDownload(
      markdown,
      `${toSlug(name)}-materiel.md`,
      "Matériel exporté",
    );
  }

  // Form handlers
  function openAddForm() {
    showForm = true;
  }

  function closeForm() {
    showForm = false;
  }

  async function handleSubmit(data: CreateEventMaterielData) {
    try {
      await eventMaterielStore.addItem(data, globalState.userId || "");
      toastService.success("Item ajouté");
      closeForm();
    } catch (err) {
      console.error("[EventMaterielPage] Submit error:", err);
      toastService.error("Erreur lors de la sauvegarde");
    }
  }

  function confirmDelete(item: EventMateriel) {
    deleteTarget = item;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await eventMaterielStore.deleteItem(deleteTarget.$id);
      toastService.success("Item supprimé");
    } catch (err) {
      console.error("[EventMaterielPage] Delete error:", err);
      toastService.error("Erreur lors de la suppression");
    }
    deleteTarget = null;
  }

  async function handleEditLoan(loanId: string) {
    await loadCreateLoanModal();
    editLoanId = loanId;
  }

  function handleCloseLoanModal() {
    editLoanId = null;
    importLoanModalOpen = false;
    importTeamId = null;
  }

  async function openImportModal(teamId?: string) {
    if (myTeams.length === 1 || teamId) {
      importTeamId = teamId || myTeams[0]?.$id || null;
      if (!importTeamId) return;
      await loadCreateLoanModal();
      importLoanModalOpen = true;
    }
  }

  function getImportTeamName(): string {
    const team = myTeams.find((t) => t.$id === importTeamId);
    return team?.name || "";
  }

  // Init
  onMount(async () => {
    if (eventId) {
      await eventMaterielStore.initializeForEvent(eventId);
    }
  });
</script>

{#snippet navActions()}
  <button
    class="btn btn-sm btn-circle btn-primary"
    onclick={handleExport}
    title="Exporter en Markdown"
  >
    <Download size={18} />
  </button>
{/snippet}

<div class="mx-auto mt-4 max-w-6xl px-2">
  <div class="flex gap-4">
    <!-- Filtres (desktop: sidebar fixe) -->
    <LeftPanel>
      <EventMaterielFilters
        bind:filters
        {availableTypes}
        {availableWho}
        {availableWhere}
        onReset={resetFilters}
        disabled={eventMaterielStore.loading}
      />
    </LeftPanel>

    <!-- Contenu principal -->
    <div class="mt-4 flex-1 sm:ml-80">
      <!-- Header -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <Package class="text-primary size-5" />
          <h2 class="text-xl font-bold">
            Matériel ({eventMaterielStore?.count})- {currentEvent?.name}
          </h2>
        </div>
        {#if canEdit}
          <div class="flex gap-2">
            {#if myTeams.length > 0}
              {#if myTeams.length === 1}
                <button
                  class="btn btn-secondary btn-outline btn-sm"
                  onclick={() => openImportModal()}
                >
                  <ClipboardCopy class="mr-1 size-4" />
                  {myTeams[0].name}
                </button>
              {:else}
                <details class="dropdown dropdown-end">
                  <summary class="btn btn-secondary btn-outline btn-sm">
                    <ClipboardCopy class="mr-1 size-4" />
                    {myTeams[0].name}
                  </summary>
                  <ul
                    class="dropdown-content menu bg-base-100 rounded-box z-10 mt-1 w-52 p-2 shadow"
                  >
                    {#each myTeams as team (team.$id)}
                      <li>
                        <button onclick={() => openImportModal(team.$id)}>
                          {team.name}
                        </button>
                      </li>
                    {/each}
                  </ul>
                </details>
              {/if}
            {/if}
            <button
              class="btn btn-primary btn-outline btn-sm"
              onclick={() => (catalogModalOpen = true)}
            >
              <ListPlus class="mr-1 size-4" />
              Catalogue
            </button>
            <button class="btn btn-primary btn-sm" onclick={openAddForm}>
              <Plus class="mr-1 size-4" />
              Ajouter
            </button>
          </div>
        {/if}
      </div>

      <!-- Formulaire dépliable -->
      {#if showForm && canEdit && eventId}
        <div class="rounded-box bg-base-200 mb-4 p-4">
          <EventMaterielForm
            {eventId}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </div>
      {/if}

      <!-- Filtres actifs -->
      {#if activeBadges.length > 0}
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="text-base-content/50 text-sm">Filtres :</span>
          {#each activeBadges as badge (badge.id)}
            <button
              type="button"
              class="badge {badge.color} cursor-pointer gap-1 hover:opacity-80"
              onclick={() => removeBadge(badge.id)}
              title="Retirer ce filtre"
            >
              {badge.label}
              <X class="h-3 w-3" />
            </button>
          {/each}
          {#if activeBadges.length > 1}
            <button
              class="btn btn-ghost btn-xs text-error"
              onclick={resetFilters}
            >
              Réinitialiser
            </button>
          {/if}
        </div>
      {/if}

      <!-- Loading -->
      {#if eventMaterielStore.loading && eventMaterielStore.count === 0}
        <div class="flex justify-center py-12">
          <LoaderCircle class="text-base-content/30 h-8 w-8 animate-spin" />
        </div>
      {:else if filteredItems.length === 0}
        <div class="text-base-content/50 py-12 text-center">
          <Package class="mx-auto mb-2 h-12 w-12 opacity-30" />
          <p>
            {#if eventMaterielStore.count === 0}Aucun matériel ajouté{:else}Aucun
              résultat pour ces filtres{/if}
          </p>
          {#if eventMaterielStore.count === 0 && canEdit}
            <button class="btn btn-primary btn-sm mt-4" onclick={openAddForm}>
              <Plus class="h-4 w-4" />
              Ajouter du matériel
            </button>
          {/if}
        </div>
      {:else}
        <div class="mt-8 grid grid-cols-1 gap-1">
          {#each filteredItems as item (item.$id)}
            {@const canUserEditLoan =
              !!item.loanId && userAccessibleLoanIds.has(item.loanId)}
            <EventMaterielCard
              {item}
              onEdit={(item) => (editingItemId = item.$id)}
              onEditLoan={handleEditLoan}
              {canEdit}
              {canUserEditLoan}
            />
          {/each}
        </div>
      {/if}

      <!-- Error -->
      {#if eventMaterielStore.error}
        <div class="alert alert-error mt-4">
          {eventMaterielStore.error}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Modal de confirmation suppression -->
<ConfirmModal
  isOpen={!!deleteTarget}
  title="Supprimer cet item ?"
  message={deleteTarget
    ? `Supprimer « ${deleteTarget.name} » de la liste de matériel ?`
    : ""}
  onConfirm={handleDelete}
  onCancel={() => (deleteTarget = null)}
/>

<!-- Modal d'édition -->
<EditEventMaterielModal
  isOpen={editingItemId !== null}
  itemId={editingItemId}
  {eventId}
  onClose={() => (editingItemId = null)}
  onSuccess={() => (editingItemId = null)}
  canEditWhere={editingItemId
    ? canEditWhereForItem(
        eventMaterielStore.items.find((i) => i.$id === editingItemId)!,
      )
    : true}
/>

<!-- Modal catalogue rapide -->
<QuickAddEventCatalogModal
  isOpen={catalogModalOpen}
  onClose={() => (catalogModalOpen = false)}
  {eventId}
/>

<!-- Modal de réservation (édition ou import) -->
{#if CreateLoanModal}
  {#if editLoanId}
    {@const loan = materielStore.getLoanById(editLoanId)}
    <CreateLoanModal
      isOpen={true}
      onClose={handleCloseLoanModal}
      onSuccess={handleCloseLoanModal}
      ownerId={loan?.ownerId || ""}
      ownerName={loan?.ownerName || ""}
      loanId={editLoanId}
    />
  {/if}
  {#if importLoanModalOpen && importTeamId}
    <CreateLoanModal
      isOpen={true}
      onClose={handleCloseLoanModal}
      onSuccess={handleCloseLoanModal}
      ownerId={importTeamId}
      ownerName={getImportTeamName()}
      preselectedEventId={eventId}
    />
  {/if}
{/if}
