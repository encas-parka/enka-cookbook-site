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
    Funnel,
    Printer,
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
  import EventDocumentsBloc from "$lib/components/documents/EventDocumentsBloc.svelte";
  import InfoCollapse from "$lib/components/ui/InfoCollapse.svelte";
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
  import {
    shareOrDownload,
    downloadFile,
    toSlug,
  } from "$lib/utils/share-utils";
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

  const hasActiveFilters = $derived.by(() => {
    return (
      filters.statuses.length > 0 ||
      filters.who.length > 0 ||
      filters.where.length > 0 ||
      filters.search.length > 0
    );
  });

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

  const groupedByType = $derived.by(() => {
    const map = new Map<string, MaterielGroup[]>();
    for (const group of groupedItems) {
      const typeLabel = getMaterielTypeConfig(group.header.type).label;
      if (!map.has(typeLabel)) map.set(typeLabel, []);
      map.get(typeLabel)!.push(group);
    }
    return Array.from(map.entries());
  });

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

  // =========================================================================
  // EXPORT MARKDOWN, CSV & PRINT
  // =========================================================================

  let printModalOpen = $state(false);

  function getExportSlug(): string {
    return toSlug(currentEvent?.name ?? "") || "materiel";
  }

  function handleExportMarkdown() {
    const name = currentEvent?.name ?? "materiel";
    const markdown = eventMaterielStore.exportToMarkdown(name, groupedItems);
    if (!markdown) return;
    shareOrDownload(
      markdown,
      `${getExportSlug()}-materiel.md`,
      "Matériel exporté en Markdown",
    );
  }

  function handleExportCsv() {
    const csv = eventMaterielStore.exportToCsv(groupedItems);
    if (!csv) return;
    downloadFile(
      csv,
      `${getExportSlug()}-materiel.csv`,
      "text/csv;charset=utf-8",
      "Matériel exporté en CSV",
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
  <div class="flex items-center gap-2">
    <div class="dropdown dropdown-end">
      <div
        class="btn btn-sm btn-circle btn-primary"
        tabindex="0"
        role="button"
        title="Exporter"
      >
        <Download size={18} />
      </div>
      <ul
        class="dropdown-content menu bg-base-100 rounded-box z-10 w-48 p-2 shadow-lg"
        tabindex="0"
      >
        <li>
          <button onclick={handleExportMarkdown}>
            <Download size={16} />
            Texte
          </button>
        </li>
        <li>
          <button onclick={handleExportCsv}>
            <Download size={16} />
            Excel / Calc
          </button>
        </li>
      </ul>
    </div>
    <button
      class="btn btn-sm btn-circle btn-primary"
      onclick={() => (printModalOpen = true)}
      title="Imprimer la liste"
    >
      <Printer size={18} />
    </button>
  </div>
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

<div
  class="mx-auto mt-4 overflow-x-hidden p-4 pb-20 sm:max-w-11/12 print:hidden"
>
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

      <!-- Bloc Documents attachés -->
      <EventDocumentsBloc
        {eventId}
        tag="materiel"
        tagLabel="Matériel"
        {canEdit}
      />

      <InfoCollapse
        title="Aide"
        contentVisible="Gestion du matériel requis pour l'événement : lister les besoins, suivre ce qui est trouvé, emprunté ou confirmé. Cliquez pour en savoir plus…"
        class="shadow-info my-8 shadow "
      >
        <p>
          Cette page sert à <span class="font-semibold"
            >lister le matériel requis</span
          >
          pour l'événement et à
          <span class="font-semibold"
            >suivre ce qui a été trouvé, emprunté ou confirmé</span
          >. Chaque besoin (ex : 5 tables pliantes) peut recevoir plusieurs
          apports : une personne indique qu'elle en apporte 3, une autre 2, etc.
          Vous pouvez :
        </p>
        <ul>
          <li>
            Ajouter un besoin en matériel via le bouton <kbd class="kbd kbd-sm"
              >+ Ajouter</kbd
            >.
          </li>
          <li>
            Ajouter plusieurs items d'un coup depuis le catalogue via <kbd
              class="kbd kbd-sm">Catalogue</kbd
            >.
          </li>
          <li>
            <span class="font-semibold"
              >Importer le matériel d'une de vos équipes</span
            >
            (réservation/prêt) via les boutons de la liste déroulante
            <kbd class="kbd kbd-sm">Ajouter</kbd>.
          </li>
          <li>
            Pour chaque apport, indiquer le <span class="font-semibold"
              >statut</span
            >
            :
            <ul>
              <li>
                <strong>À trouver</strong> — le matériel est encore recherché
              </li>
              <li>
                <strong>À vérifier</strong> — une piste existe, à confirmer
              </li>
              <li><strong>Confirmé</strong> — le matériel est acquis</li>
            </ul>
          </li>
          <li>
            Préciser <strong>qui</strong> apporte le matériel et
            <strong>d'où</strong> il vient (lieu de stockage).
          </li>
          <li>
            Filtrer par type, statut, responsable, lieu ou recherche textuelle
            {#if globalState.isMobile}
              grâce au bouton en bas à gauche <Funnel size={14} />
            {:else}
              grâce au panneau de filtres
            {/if}.
          </li>
          <li>Trier les items par type, nom ou lieu.</li>
          <li>Éditer ou supprimer un item en cliquant dessus.</li>
          <li>
            <span class="font-semibold">Exporter la liste</span> en Markdown via
            le bouton <Download size={14} class="inline" /> de la barre de navigation.
            L'export tient compte des filtres actifs.
          </li>
          <li>
            Les badges au-dessus de la liste indiquent les filtres actifs ;
            cliquez sur un badge pour le retirer.
          </li>
        </ul>
        <p>
          Tous les membres des équipes ou individus invités à participer à
          l'événement peuvent modifier le matériel.
        </p>
      </InfoCollapse>

      <!-- Contrôles -->
      <EventMaterielControls
        sort={currentSort}
        onSortChange={(s) => (currentSort = s)}
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
      {:else if groupedItems.length === 0}
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
      {:else}
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
      {/if}

      {#if eventMaterielStore.error}
        <div class="alert alert-error mt-4">
          {eventMaterielStore.error}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Vue TABLEAU pour l'impression (print-only) -->
<div class="print-only w-full">
  <h2 class="text-lg font-bold">
    Matériel pour {currentEvent?.name ?? ""}
  </h2>

  {#each groupedByType as [typeLabel, typeGroups] (typeLabel)}
    <div class="break-inside-avoid">
      <div class="mt-6 mb-2">
        <div class="border-b-2 border-gray-800 pb-1 font-bold uppercase">
          {typeLabel}
          <span class="ml-2 text-sm font-normal normal-case opacity-70"
            >({typeGroups.length} items)</span
          >
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table-compact table w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-400 bg-gray-100 text-left">
              <th class="w-1/12 border px-2 py-1">Check</th>
              <th class="w-3/12 border px-2 py-1">Nom</th>
              <th class="w-1/12 border px-2 py-1 text-center">Besoin</th>
              <th class="w-3/12 border px-2 py-1">Trouvé</th>
              <th class="w-3/12 border px-2 py-1">À vérifier</th>
              <th class="w-1/12 border px-2 py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {#each typeGroups as group (group.header.$id)}
              {@const confirmedAllocs = group.allocations.filter(
                (a) => eventMaterielStore.resolveStatus(a) === "confirmed",
              )}
              {@const toCheckAllocs = group.allocations.filter(
                (a) => eventMaterielStore.resolveStatus(a) === "to_check",
              )}
              <tr class="break-inside-avoid border-b border-gray-300">
                <td class="border px-2 py-1 text-center">
                  <div class="mx-auto h-4 w-4 border border-gray-400"></div>
                </td>
                <td class="border px-2 py-1 font-medium">
                  {group.header.name || "Sans nom"}
                </td>
                <td class="border px-2 py-1 text-center font-bold">
                  {group.header.quantity ?? 0}
                </td>
                <td class="border px-2 py-1 text-sm">
                  {#if confirmedAllocs.length > 0}
                    {confirmedAllocs
                      .map((a) => {
                        const parts: string[] = [];
                        if (a.who) parts.push(a.who);
                        if (a.where) parts.push(a.where);
                        return parts.length > 0
                          ? `${a.quantity ?? 0} (${parts.join(" - ")})`
                          : `${a.quantity ?? 0}`;
                      })
                      .join(", ")}
                  {:else}
                    <span class="opacity-30">-</span>
                  {/if}
                </td>
                <td class="border px-2 py-1 text-sm">
                  {#if toCheckAllocs.length > 0}
                    {toCheckAllocs
                      .map((a) => {
                        const parts: string[] = [];
                        if (a.who) parts.push(a.who);
                        if (a.where) parts.push(a.where);
                        return parts.length > 0
                          ? `${a.quantity ?? 0} (${parts.join(" - ")})`
                          : `${a.quantity ?? 0}`;
                      })
                      .join(", ")}
                  {:else}
                    <span class="opacity-30">-</span>
                  {/if}
                </td>
                <td class="border px-2 py-1 text-sm text-nowrap">
                  {group.header.notes
                    ? group.header.notes.length > 30
                      ? group.header.notes.slice(0, 30) + "…"
                      : group.header.notes
                    : ""}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/each}
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

<!-- Modal de confirmation impression -->
<ConfirmModal
  isOpen={printModalOpen}
  title="Imprimer la liste de matériel"
  message="Vous pouvez affiner le matériel à imprimer en utilisant les filtres (type, statut, responsable, lieu…). Lors de l'impression, ajustez les options « Marges » et « Échelle » du navigateur pour un rendu optimal."
  variant="info"
  confirmLabel="Imprimer"
  cancelLabel="Annuler"
  onConfirm={() => {
    printModalOpen = false;
    setTimeout(() => {
      window.print();
    }, 300);
  }}
  onCancel={() => (printModalOpen = false)}
/>

<style>
  ul {
    list-style-type: disc;
    margin: 1rem;
  }

  li {
    margin-bottom: 0.5rem;
  }
</style>
