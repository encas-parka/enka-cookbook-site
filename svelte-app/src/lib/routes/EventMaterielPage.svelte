<script lang="ts">
  import { onMount } from "svelte";
  import {
    Plus,
    LoaderCircle,
    Package,
    ListPlus,
    Download,
    ClipboardCopy,
    ChevronDown,
    Check,
    X,
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
  import EventMaterielGroupCard from "$lib/components/eventMateriel/EventMaterielGroupCard.svelte";
  import EventMaterielAllocationForm from "$lib/components/eventMateriel/EventMaterielAllocationForm.svelte";
  import EventMaterielFilters, {
    type EventMaterielFiltersState,
  } from "$lib/components/eventMateriel/EventMaterielFilters.svelte";
  import EventMaterielModal from "$lib/components/eventMateriel/EventMaterielModal.svelte";
  import QuickAddEventCatalogModal from "$lib/components/eventMateriel/QuickAddEventCatalogModal.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import EventMaterielControls, {
    type ActiveBadge,
  } from "$lib/components/eventMateriel/EventMaterielControls.svelte";
  import type { EventMateriel } from "$lib/types/appwrite";
  import type {
    CreateEventMaterielData,
    EventMaterielFilters as EventMaterielFilterOptions,
    EventMaterielSort,
    EventMaterielStatus,
    MaterielGroup,
  } from "$lib/types/event-materiel.types";
  import { online } from "svelte/reactivity/window";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";
  import {
    getMaterielTypeConfig,
    getEventMaterielStatusConfig,
  } from "$lib/utils/materiel.utils";

  // Route params
  let eventId = $derived(route.params.id ?? "");
  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  // Permissions
  const canEdit = $derived(
    online.current &&
      eventsStore.canUserEditEvent(eventId || "", globalState.userId || "") &&
      currentEvent?.status !== "canceled",
  );

  // UI State
  let materielModalOpen = $state(false);
  let materielModalId = $state<string | null>(null);
  let catalogModalOpen = $state(false);
  let deleteTarget = $state<EventMateriel | null>(null);
  let editLoanId = $state<string | null>(null);
  let importLoanModalOpen = $state(false);
  let importTeamId = $state<string | null>(null);
  let allocatingForHeaderId = $state<string | null>(null);
  let allocationPresetStatus = $state<EventMaterielStatus | undefined>(
    undefined,
  );

  // Allocation modal form state
  let allocFormRef: any = $state(null);

  // Lazy-loaded CreateLoanModal component
  let CreateLoanModal:
    | typeof import("$lib/components/teamMatos/CreateLoanModal.svelte").default
    | null = $state(null);

  const myTeams = $derived(nativeTeamsStore.myTeams);

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
    statuses: [],
    who: [],
    where: [],
    search: "",
  });

  // Tri (défaut : par type)
  let currentSort = $state<EventMaterielSort>({
    field: "type",
    direction: "asc",
  });

  type DisplayMode = "nested" | "flat";
  let displayMode = $state<DisplayMode>("nested");

  const hasActiveFilters = $derived.by(() => {
    return (
      filters.statuses.length > 0 ||
      filters.who.length > 0 ||
      filters.where.length > 0 ||
      filters.search.length > 0
    );
  });

  const effectiveDisplayMode = $derived<DisplayMode>(
    hasActiveFilters ? "flat" : displayMode,
  );

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

  const availableWho = $derived(eventMaterielStore.getUniqueWhoValues());
  const availableWhere = $derived(eventMaterielStore.getUniqueWhereValues());
  const availableStatuses = $derived(
    eventMaterielStore.getUniqueStatusValues(),
  );

  const filteredItems = $derived(
    eventMaterielStore.getFilteredItems(
      {
        types: filters.types as EventMaterielFilterOptions["types"],
        statuses: filters.statuses as EventMaterielFilterOptions["statuses"],
        who: filters.who,
        where: filters.where,
        search: filters.search,
      },
      currentSort,
    ),
  );

  const groupedItems = $derived(
    eventMaterielStore.getGroupedItems(
      {
        types: filters.types as EventMaterielFilterOptions["types"],
        statuses: filters.statuses as EventMaterielFilterOptions["statuses"],
        who: filters.who,
        where: filters.where,
        search: filters.search,
      },
      currentSort,
    ),
  );

  const activeBadges = $derived.by<ActiveBadge[]>(() => {
    const badges: ActiveBadge[] = [];

    filters.types.forEach((type) => {
      badges.push({
        id: `type:${type}`,
        label: getMaterielTypeConfig(type).label,
        color: "badge-secondary",
      });
    });

    filters.statuses.forEach((status) => {
      badges.push({
        id: `status:${status}`,
        label: getEventMaterielStatusConfig(status).label,
        color: "badge-accent",
      });
    });

    filters.who.forEach((who) => {
      badges.push({
        id: `who:${who}`,
        label: who === "__none__" ? "Personne" : who,
        color: "badge-info",
      });
    });

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
      case "status":
        filters.statuses = filters.statuses.filter((s) => s !== value);
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

  function resetFilters() {
    filters = { types: [], statuses: [], who: [], where: [], search: "" };
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

  function openAddForm() {
    materielModalId = null;
    materielModalOpen = true;
  }

  function openEditForm(itemId: string) {
    materielModalId = itemId;
    materielModalOpen = true;
  }

  function closeMaterielModal() {
    materielModalOpen = false;
    materielModalId = null;
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

  async function handleAllocation(allocationData: {
    quantity: number;
    status: EventMaterielStatus;
    who: string;
    where: string;
    notes?: string;
  }) {
    if (!allocatingForHeaderId) return;
    const header = eventMaterielStore.items.find(
      (i) => i.$id === allocatingForHeaderId,
    );
    if (!header) return;

    try {
      const data: CreateEventMaterielData = {
        eventId,
        name: header.name || "",
        type: header.type as CreateEventMaterielData["type"],
        quantity: allocationData.quantity,
        status: allocationData.status,
        groupId: allocatingForHeaderId,
        who: allocationData.who || null,
        where: allocationData.where || null,
        notes: allocationData.notes || null,
      };
      await eventMaterielStore.addItem(data, globalState.userId || "");
      toastService.success("Allocation ajoutée");
    } catch (err) {
      console.error("[EventMaterielPage] Allocation error:", err);
      toastService.error("Erreur lors de l'ajout de l'allocation");
    }
    allocatingForHeaderId = null;
    allocationPresetStatus = undefined;
  }

  function closeAllocationModal() {
    allocatingForHeaderId = null;
    allocationPresetStatus = undefined;
  }

  function handleAllocFormFooterSubmit() {
    if (allocFormRef) {
      const formEl = allocFormRef.querySelector(
        "form",
      ) as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
    }
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

      const existingLoan = materielStore.loans.find(
        (l) => l.ownerId === importTeamId && l.eventId === eventId,
      );

      if (existingLoan) {
        editLoanId = existingLoan.$id;
      } else {
        importLoanModalOpen = true;
      }
    }
  }

  function getImportTeamName(): string {
    const team = myTeams.find((t) => t.$id === importTeamId);
    return team?.name || "";
  }

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

{#snippet addDropDown()}
  <div class="dropdown dropdown-end ms-auto">
    <div tabindex="0" role="button" class="btn btn-primary btn-sm">
      <Plus class="size-4" />
      Ajouter
      <ChevronDown size={14} class="opacity-50" />
    </div>
    <ul
      class="menu dropdown-content bg-base-100 border-base-200 z-1 mt-3 w-52 rounded-xl border p-2 font-medium shadow-xl"
    >
      <li>
        <button onclick={openAddForm}>
          <Plus size={16} />
          Ajouter
        </button>
      </li>
      <li>
        <button onclick={() => (catalogModalOpen = true)}>
          <ListPlus size={16} />
          Catalogue
        </button>
      </li>
      {#if myTeams.length === 1}
        <li>
          <button onclick={() => openImportModal()}>
            <ClipboardCopy size={16} />
            {myTeams[0].name}
            {#if materielStore.loans.some((l) => l.ownerId === myTeams[0].$id && l.eventId === eventId)}
              <span class="text-base-content/50 text-xs"
                >(réservation existante)</span
              >
            {/if}
          </button>
        </li>
      {:else if myTeams.length > 1}
        <li class="menu-title">Importer depuis</li>
        {#each myTeams as team (team.$id)}
          <li>
            <button onclick={() => openImportModal(team.$id)}>
              <ClipboardCopy size={16} />
              {team.name}
              {#if materielStore.loans.some((l) => l.ownerId === team.$id && l.eventId === eventId)}
                <span class="text-base-content/50 text-xs">(résa.)</span>
              {/if}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>
{/snippet}

<div class="mx-auto mt-4 max-w-7xl overflow-x-hidden p-4 pb-20">
  <div class="flex gap-4">
    <LeftPanel>
      <EventMaterielFilters
        bind:filters
        {availableTypes}
        {availableWho}
        {availableWhere}
        {availableStatuses}
        onReset={resetFilters}
        disabled={eventMaterielStore.loading}
      />
    </LeftPanel>

    <div class="mt-4 flex-1 lg:ml-96">
      <!-- Header -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <Package class="text-primary size-5" />
          <h2 class="text-xl font-bold">
            Matériel ({eventMaterielStore?.count})- {currentEvent?.name}
          </h2>
        </div>
        {#if canEdit}
          {@render addDropDown()}
        {/if}
      </div>

      <!-- Contrôles -->
      <EventMaterielControls
        sort={currentSort}
        onSortChange={(s) => (currentSort = s)}
        displayMode={effectiveDisplayMode}
        onDisplayModeChange={(m) => (displayMode = m)}
        {hasActiveFilters}
        {activeBadges}
        onRemoveBadge={removeBadge}
        onResetFilters={resetFilters}
      />

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
            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <button class="btn btn-primary btn-sm" onclick={openAddForm}>
                <Plus class="h-4 w-4" />
                Ajouter un item
              </button>
              <button
                class="btn btn-outline btn-sm"
                onclick={() => (catalogModalOpen = true)}
              >
                <ListPlus class="h-4 w-4" />
                Ajouts multiples
              </button>
              {#if myTeams.length >= 1}
                <button
                  class="btn btn-outline btn-sm"
                  onclick={() => openImportModal()}
                >
                  <ClipboardCopy class="h-4 w-4" />
                  Importer depuis {myTeams[0].name}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else if effectiveDisplayMode === "nested"}
        <div class="mt-8 grid grid-cols-1 gap-1">
          {#each groupedItems as group (group.header.$id)}
            <EventMaterielGroupCard
              {group}
              {canEdit}
              onEditItem={(item) => openEditForm(item.$id)}
              onEditLoan={handleEditLoan}
              onAddAllocation={(headerId, status) => {
                allocatingForHeaderId = headerId;
                allocationPresetStatus = status;
              }}
            />
          {/each}
        </div>
      {:else}
        <div class="mt-8 grid grid-cols-1 gap-1">
          {#each filteredItems as item (item.$id)}
            {@const canUserEditLoan =
              !!item.loanId && userAccessibleLoanIds.has(item.loanId)}
            <EventMaterielCard
              {item}
              onEdit={(item) => openEditForm(item.$id)}
              onEditLoan={handleEditLoan}
              {canEdit}
              {canUserEditLoan}
            />
          {/each}
        </div>
      {/if}

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

<!-- Modal unifiée ajout/édition de matériel -->
<EventMaterielModal
  isOpen={materielModalOpen}
  onClose={closeMaterielModal}
  {eventId}
  itemId={materielModalId}
/>

<!-- Formulaire d'allocation -->
{#if allocatingForHeaderId}
  {@const allocHeader = eventMaterielStore.items.find(
    (i) => i.$id === allocatingForHeaderId,
  )}
  {@const allocRemaining = eventMaterielStore.getRemainingQuantity(
    allocatingForHeaderId,
  )}
  {#if allocHeader}
    <ModalContainer isOpen={true} maxWidth="sm" onClose={closeAllocationModal}>
      <ModalHeader
        title={allocHeader.name || "Ajouter"}
        onClose={closeAllocationModal}
      />
      <ModalContent>
        <div bind:this={allocFormRef}>
          <EventMaterielAllocationForm
            maxQuantity={allocRemaining}
            headerName={""}
            headerType={allocHeader.type as any}
            presetStatus={allocationPresetStatus}
            onSubmit={handleAllocation}
            onCancel={closeAllocationModal}
          />
        </div>
      </ModalContent>
      <ModalFooter>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onclick={closeAllocationModal}
        >
          <X class="size-4" />
          Annuler
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={handleAllocFormFooterSubmit}
        >
          <Check class="size-4" />
          Enregistrer
        </button>
      </ModalFooter>
    </ModalContainer>
  {/if}
{/if}

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
