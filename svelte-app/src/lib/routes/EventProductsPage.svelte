<script lang="ts">
  import {
    BadgeEuro,
    Calendar,
    CircleAlert,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    Clock,
    Download,
    Funnel,
    Search,
    Info,
    MessageCircleQuestionMark,
    Package,
    PackageCheck,
    Plus,
    Printer,
    ShoppingCart,
    Store,
    Users,
    X,
  } from "@lucide/svelte";
  // Store and global state
  import { productsStore } from "$lib/stores/ProductsStore.svelte";

  // Components
  import EventInvitationAlert from "$lib/components/EventInvitationAlert.svelte";
  import ActiveFiltersIndicator from "$lib/components/eventProducts/ActiveFiltersIndicator.svelte";
  import AddProductModal from "$lib/components/eventProducts/AddProductModal.svelte";
  import GlobalPurchasesModal from "$lib/components/eventProducts/GlobalPurchasesModal.svelte";
  import GroupPurchaseModal from "$lib/components/eventProducts/GroupPurchaseModal.svelte";
  import ProductModal from "$lib/components/eventProducts/ProductModal.svelte";
  import ProductsCards from "$lib/components/eventProducts/ProductsCards.svelte";
  import ProductsFilters from "$lib/components/eventProducts/ProductsFilters.svelte";
  import StoreBatchEditModal from "$lib/components/eventProducts/StoreBatchEditModal.svelte";
  import WhoBatchEditModal from "$lib/components/eventProducts/WhoBatchEditModal.svelte";
  import EventStats from "$lib/components/EventStats.svelte";
  import EventDocumentsBloc from "$lib/components/documents/EventDocumentsBloc.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import { globalState, hoverHelp } from "$lib/stores/GlobalState.svelte";
  // Services
  import { toastService } from "$lib/services/toast.service.svelte";
  import { UnitConverter } from "$lib/utils/UnitConverter";

  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";

  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  import { route } from "$lib/router";

  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { formatDateShort } from "../utils/products-display";

  import BadgeEventStatus from "../components/ui/BadgeEventStatus.svelte";
  import InfoCollapse from "../components/ui/InfoCollapse.svelte";
  import { online } from "svelte/reactivity/window";
  import {
    shareOrDownload,
    downloadFile,
    toSlug,
  } from "$lib/utils/share-utils";

  // Mapping des icônes pour les statuts d'achat
  const statusIcons = {
    Package,
    MessageCircleQuestionMark,
    ShoppingCart,
    Clock,
    CircleCheck,
    CircleX,
    ClipboardCheck,
    PackageCheck,
  };

  // Accès réactif aux valeurs dérivées du store
  const stats = $derived(productsStore.stats);

  // État local : quel produit a son modal ouvert, et sur quel onglet
  let openModalProductId = $state<string | null>(null);
  let openModalTab = $state<string>("recettes");

  // État local pour les modaux groupés
  let whoEditModalOpen = $state(false);
  let storeEditModalOpen = $state(false);
  let groupEditProductIds = $state<string[]>([]);
  let groupEditProducts = $state<any[]>([]);

  // État local pour le modal d'achat groupé
  let groupPurchaseModalOpen = $state(false);

  // État pour le modal d'impression
  let printModalOpen = $state(false);
  let groupPurchaseProducts = $state<any[]>([]);

  // =========================================================================
  // EXPORT MARKDOWN & CSV
  // =========================================================================

  function getSlug(): string {
    return toSlug(eventName) || "produits";
  }

  function getExportDateSuffix(): string {
    const { start, end } = productsStore.dateStore.current ?? {};
    const fmt = (d: string) =>
      new Date(d)
        .toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
        .replace(/\//g, "-");
    if (start && end) {
      return `_${fmt(start)}--${fmt(end)}`;
    }
    if (start) {
      return `_${fmt(start)}`;
    }
    return "";
  }

  function handleExportMarkdown() {
    const markdown = productsStore.exportToMarkdown(eventName);
    shareOrDownload(
      markdown,
      `${getSlug()}-courses${getExportDateSuffix()}.md`,
      "Liste de courses exportée en Markdown",
    );
  }

  function handleExportCsv() {
    const csv = productsStore.exportToCsv();
    downloadFile(
      csv,
      `${getSlug()}-courses${getExportDateSuffix()}.csv`,
      "text/csv;charset=utf-8",
      "Liste de courses exportée en CSV",
    );
  }

  // État local pour le modal d'ajout de produit
  let isAddProductModalOpen = $state(false);

  // État de chargement
  let isLoading = $state(true);

  // =========================================================================
  // INITIALISATION
  // =========================================================================

  // Récupérer l'eventId depuis les paramètres de route
  let eventId = $derived(route.params.id);

  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  // Calculer les informations de l'événement
  const eventName = $derived(currentEvent?.name ?? "");
  const startDate = $derived(currentEvent?.dateStart ?? null);
  const endDate = $derived(currentEvent?.dateEnd ?? null);

  const eventIsPassed = $derived(endDate && new Date() > new Date(endDate));

  const hasUndatedRecipes = $derived(
    currentEvent?.meals?.some(
      (meal) => meal.date === "" && meal.recipes?.length > 0,
    ) ?? false,
  );

  onMount(async () => {
    try {
      if (!eventId) {
        console.error("[EventProductsPage] eventId est requis");
        isLoading = false;
        return;
      }

      // Initialiser ProductsStore (le guard a déjà vérifié l'event)
      const event = eventsStore.getEventById(eventId);
      console.log(
        `[EventProductsPage] Initialisation de ProductsStore pour événement ${event?.name}`,
      );
      await productsStore.initialize(eventId);
    } catch (error) {
      console.error(
        "[EventProductsPage] Erreur lors de l'initialisation:",
        error,
      );
    } finally {
      isLoading = false;
    }
  });

  // Fonctions pour contrôler l'ouverture/fermeture
  function openModal(productId: string, tab: string = "recettes") {
    openModalTab = tab;
    openModalProductId = productId;
  }

  function closeModal() {
    openModalProductId = null;
  }

  // Fonctions pour les modaux groupés
  function openGroupEditModal(
    type: "store" | "who",
    productIds: string[],
    products: any[],
  ) {
    groupEditProductIds = productIds;
    groupEditProducts = products;

    if (type === "who") {
      whoEditModalOpen = true;
    } else {
      storeEditModalOpen = true;
    }
  }

  function closeGroupEditModal(type?: "store" | "who") {
    if (!type || type === "who") {
      whoEditModalOpen = false;
    }
    if (!type || type === "store") {
      storeEditModalOpen = false;
    }
    groupEditProductIds = [];
    groupEditProducts = [];
  }

  function handleGroupEditSuccess(result: any) {
    // Le ProductsStore va automatiquement se mettre à jour via le realtime
    console.log(
      `[ProductsTable] Modification groupée réussie: ${result.updatedCount} produits`,
    );
  }

  // Fonctions pour le modal d'achat groupé
  function openGroupPurchaseModal(products: any[]) {
    // 🚨 FILTRER SEULEMENT LES PRODUITS AVEC QUANTITÉS MANQUANTES
    const productsWithMissingQuantities = products.filter((product) => {
      const productModel = productsStore.getProductModelById(product.$id);
      return productModel?.stats.hasMissing;
    });

    console.log(
      `[ProductsTable] openGroupPurchaseModal: ${products.length} produits reçus → ${productsWithMissingQuantities.length} produits avec quantités manquantes`,
    );

    groupPurchaseProducts = productsWithMissingQuantities;
    groupPurchaseModalOpen = true;
  }

  function closeGroupPurchaseModal() {
    groupPurchaseModalOpen = false;
    groupPurchaseProducts = [];
  }

  function handleGroupPurchaseSuccess() {
    // Le ProductsStore va automatiquement se mettre à jour via le realtime
    console.log("[ProductsTable] Achat groupé créé avec succès");
    closeGroupPurchaseModal();
  }

  function handleOpenAddProductModal() {
    isAddProductModalOpen = true;
  }

  // Validation rapide individuelle
  async function handleQuickValidation(product: any, productInDateRange: any) {
    try {
      const missingQuantities = productInDateRange.missingQuantities || [];
      if (missingQuantities.length === 0) {
        console.log(
          "Aucune quantité manquante à valider pour ce produit dans cette période",
        );
        return;
      }

      // CONVERSIONS : Les missingQuantities sont négatives, les convertir en positif pour les achats
      // et normaliser les unités (kg→gr., l.→ml) pour le stockage
      const normalizedQuantities = missingQuantities
        .filter((qty) => qty.q < 0)
        .map((qty) => ({ ...qty, q: Math.abs(qty.q) }))
        .map((qty) => {
          const normalized = UnitConverter.normalize(qty.q, qty.u);
          return { q: normalized.quantity, u: normalized.unit };
        });

      // Utiliser ProductsStore qui a déjà le guard intégré
      await productsStore.createPurchase(product.$id, normalizedQuantities, {
        store: product.storeInfo?.storeName ?? null,
        notes: "",
        invoiceId: `VALID_${Date.now()}`,
      });

      console.log(
        `[ProductsTable] Validation rapide créée pour ${product.productName}`,
      );
    } catch (error) {
      console.error("[ProductsTable] Erreur validation rapide:", error);
      alert("Erreur lors de la validation rapide: " + (error as Error).message);
    }
  }

  let GlobalPurchasesModalisOpen = $state(false);

  // =========================================================================
  // PERMISSIONS & INVITATION
  // =========================================================================

  /**
   * Vérifie si l'utilisateur peut éditer les produits de l'événement
   * Même logique que EventEditPage
   */
  const canEdit = $derived(
    online.current &&
      eventsStore.canUserEditEvent(eventId || "", globalState.userId || "") &&
      currentEvent?.status !== "canceled",
  );

  /**
   * Gère la réponse à l'invitation (accepter/refuser)
   */
  async function handleInvitationResponse(accept: boolean) {
    if (!eventId || !globalState.userId) return;

    try {
      isLoading = true;

      const newStatus = accept ? "accepted" : "declined";

      await eventsStore.updateContributorStatus(
        eventId,
        globalState.userId,
        newStatus,
      );

      toastService.success(
        accept ? "Invitation acceptée" : "Invitation déclinée",
      );
    } catch (error) {
      console.error("Erreur réponse invitation:", error);
      toastService.error("Erreur lors de la réponse");
    } finally {
      isLoading = false;
    }
  }

  // =========================================================================
  // NAVBAR CONFIGURATION
  // =========================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
    });
  });

  //
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
<LeftPanel>
  <ProductsFilters />
</LeftPanel>
<ActiveFiltersIndicator />

<div
  class="space-y-6 overflow-x-clip pt-6 pb-28 md:px-16 {globalState.isDesktop &&
    'ml-96 print:ml-0'} "
  transition:fade
>
  {#if isLoading}
    <!-- Skeletons pendant le chargement -->
    <div class="space-y-6">
      <!-- Skeleton header -->
      <div class="rounded-box border-base-300 bg-base-100 border-2 p-4">
        <div class="flex w-full flex-wrap justify-between gap-6">
          <div class="skeleton h-8 w-48 shrink-0"></div>
          <div class="skeleton h-6 w-40 shrink-0"></div>
        </div>
        <div class="skeleton mt-4 h-20 w-full"></div>
      </div>

      <!-- Skeleton stats cards -->
      <div class="flex w-full flex-wrap justify-center gap-10 md:justify-end">
        <div class="card card-xs sm:card-sm border-base-300 w-40 border-2">
          <div class="card-body">
            <div class="card-title">
              <div class="skeleton h-6 w-6 rounded"></div>
              <span class="skeleton inline-block h-6 w-24"></span>
            </div>
            <div class="flex items-center justify-center px-2">
              <div class="text-center">
                <div class="skeleton mx-auto h-8 w-12"></div>
                <div class="skeleton mx-auto mt-1 h-4 w-16"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card card-xs sm:card-sm border-base-300 w-40 border-2">
          <div class="card-body">
            <div class="card-title">
              <div class="skeleton h-6 w-6 rounded"></div>
              <span class="skeleton inline-block h-6 w-24"></span>
            </div>
            <div class="skeleton mx-auto mt-2 h-8 w-16"></div>
          </div>
        </div>
      </div>

      <!-- Skeleton aide collapse -->
      <div class="border-base-300 bg-base-100 rounded-box border-2 p-4">
        <div class="skeleton mb-2 h-6 w-32"></div>
        <div class="space-y-2">
          <div class="skeleton h-4 w-full"></div>
          <div class="skeleton h-4 w-5/6"></div>
          <div class="skeleton h-4 w-4/6"></div>
        </div>
      </div>

      <!-- Skeleton produits list -->
      <div class="space-y-4">
        {#each Array(3) as _}
          <div class="border-base-300 bg-base-100 rounded-box border-2 p-4">
            <div class="mb-3 flex items-center justify-between">
              <div class="skeleton h-6 w-48"></div>
              <div class="flex gap-2">
                <div class="skeleton h-8 w-8 rounded-full"></div>
                <div class="skeleton h-8 w-8 rounded-full"></div>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each Array(3) as __}
                <div class="card card-compact bg-base-200">
                  <div class="card-body">
                    <div class="skeleton mb-2 h-5 w-32"></div>
                    <div class="skeleton h-4 w-full"></div>
                    <div class="skeleton mt-1 h-4 w-3/4"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Alerte d'invitation pour les utilisateurs invités -->
    <EventInvitationAlert
      {currentEvent}
      isBusy={isLoading}
      onRespond={handleInvitationResponse}
    />

    <!-- Contenu une fois chargé -->
    <div
      class="rounded-box border-base-300 bg-base-100 flex flex-wrap items-baseline justify-between gap-4 border-2 p-4 print:hidden"
    >
      <div class="flex w-full flex-wrap justify-between gap-6">
        <div class="flex flex-wrap items-center gap-8">
          <h1>
            {eventName}
          </h1>
          {#if currentEvent}
            <BadgeEventStatus status={currentEvent.status} />
          {/if}
        </div>
        <div class="text-base-content/70 text-base">
          {#if startDate && endDate}
            <Calendar class="inline h-4 w-4" />
            {formatDateShort(startDate)} au {formatDateShort(endDate)}
          {:else if startDate}
            <Calendar class="inline h-4 w-4" />
            {formatDateShort(startDate)}
          {/if}
        </div>
      </div>
      <!-- Stats -->
      {#if currentEvent}
        <div class="grow py-4 print:hidden">
          <EventStats {currentEvent} />
        </div>
      {/if}

      {#if hasUndatedRecipes}
        <div
          class="alert alert-warning alert-soft max-sm:alert-vertical mb-4 w-full"
        >
          <CircleAlert size={20} class="shrink-0" />
          <div>
            <span class="font-bold">Recettes non planifiées</span>
            <p class="text-sm">
              Cet événement contient des recettes « mise de côté » sans date
              attribuée. Leurs ingrédients ne sont pas comptabilisés dans les
              besoins affichés ci-dessous.
            </p>
          </div>
        </div>
      {/if}

      <!-- card deense et produits ok/manquant -->
      <div class="flex w-full flex-wrap justify-center gap-10 md:justify-end">
        {#if eventIsPassed}
          <div
            class="alert alert-warning alert-soft max-sm:alert-vertical self-center"
            id="info-past-event"
          >
            <CircleAlert size={20} class="shrink-0" />
            Toutes les dates de cet événement sont passées. Il n'est plus possible
            de modifier les produits.
          </div>
        {/if}
        {#if !eventIsPassed}
          <!-- Carte des produits complétés/manquants -->
          <div
            class="card card-xs max-sm:card-side sm:card-sm border-2 border-orange-700"
          >
            <div class="card-body">
              <div class="card-title text-orange-800">
                <PackageCheck class="text-orange-800 opacity-60" />
                Produits
              </div>

              <!-- <div class="text-center">
                <div class="text-success text-lg font-bold md:text-2xl">
                  {productsStore.completionStats.completed}
                </div>
                <div class="text-base-content/60 text-xs">Ok</div>
              </div>
              <div class="divider divider-horizontal mx-1"></div> -->
              <div class="text-center">
                <div class="text-error text-lg font-bold md:text-2xl">
                  {productsStore.completionStats.missing}
                </div>
                <div class="text-base-content/60 text-xs">Manquants</div>
              </div>
              <div class="card-action mt-auto">
                <button
                  class="btn btn-accent w-full"
                  onclick={handleOpenAddProductModal}
                  onmouseenter={() =>
                    (hoverHelp.msg = "Ajouter un produit manuellement")}
                  onmouseleave={() => hoverHelp.reset()}
                  title="Ajouter un produit manuellement"
                  disabled={!canEdit}
                >
                  <Plus class="mr-1 h-4 w-4" />
                  <span class="hidden sm:inline">Ajouter un</span>Produit
                </button>
              </div>
            </div>
          </div>
        {/if}
        <!-- Carte des dépenses -->
        <div class="card card-xs sm:card-sm border-2 border-orange-700 shadow">
          <div class="card-body">
            <div class="card-title text-orange-800">
              <BadgeEuro class="text-orange-800 opacity-60" />
              Dépenses
            </div>
            <div class="text-base-content/70 text-center text-lg font-medium">
              {productsStore.financialStats.totalGlobal} €
            </div>
            <div class="card-action mt-auto">
              <button
                class="btn btn-soft btn-primary"
                onclick={() => (GlobalPurchasesModalisOpen = true)}
                title="Ajouter une dépense générale"
                onmouseenter={() =>
                  (hoverHelp.msg =
                    "Consulter ou modifie le détail des dépenses")}
                onmouseleave={() => hoverHelp.reset()}
                disabled={!canEdit}
              >
                <Plus class="size-4" />
                Voir, ajouter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bloc Documents attachés -->
    <EventDocumentsBloc {eventId} tag="produit" tagLabel="Produits" {canEdit} />

    <InfoCollapse
      title="Aide"
      contentVisible="Page de gestion des produits nécéssaire pour l'événement. Cliquer pour découvrir ce que vous pouvez y faire..."
      class="shadow-info shadow print:hidden"
    >
      <p class="">
        Cette page liste l'ensemble des produits présents dans les recettes de
        l'événement. La liste est <span class="font-semibold"
          >mise à jour dès que les menus sont modifiés</span
        >
        (recettes ajoutées, supprimées, nombre de couverts modifié, etc.). Vous pouvez
        :
      </p>
      <ul>
        <li>
          Ajouter des produits non présents dans les recettes grâce au bouton <kbd
            class="kbd kbd-sm">+ Produit</kbd
          > dans l'encart "Produits".
        </li>
        <li>
          Filtrer les produits par type, température, date, manquant, etc.
          {#if globalState.isMobile}
            grâce au bouton en bas à gauche <Funnel size={14} />
          {:else}
            grâce au menu de droite.
          {/if}
        </li>
        <li>
          Déclarer des achats soit en cliquant dans la zone d'achat d'un
          produit, soit via le bouton <kbd class="kbd kbd-sm">manque ...</kbd> dans
          la colonne des besoins (déclare acheté la quantité manquante). Les achats
          peuvent être déclarés comme des 'commandes', et vous pouvez préciser la
          date de réception.
        </li>
        <li>
          Déclarer tout un groupe de produits achetés via le bouton <kbd
            class="kbd kbd-sm">Achat groupé</kbd
          > dans l'entête de chaque groupe.
        </li>
        <li>
          Définir des magasins où vous mandater pour l'achat de produits
          (individuel ou par groupe) → <Store
            size={14}
            class="text-primary inline"
          />
          <Users size={14} class="text-primary inline" />
        </li>
        <li>
          Modifier la quantité réclamée pour un produit. Si les recettes et
          menus sont modifiés entre temps, la carte des besoins du produit
          indiquera que les quantités calculées ont changé depuis la
          modification manuelle des besoins déclarés pour ce produit.
          <p>
            Cela peut aussi servir à <span class="font-semibold"
              >remplacer un produit par un autre</span
            > sans modifier les recettes.
          </p>
        </li>
        <li>
          Déclarer des dépenses indépendamment des achats (possible y compris
          après que l'événement soit fini).
        </li>
        <li>
          Visualiser l'ensemble des dépenses effectuées, et par qui, en cliquant
          sur <kbd class="kbd">Dépenses</kbd> dans l'entête.
        </li>
        <li>
          <span class="font-semibold">Exporter la liste</span> via les boutons
          en haut à droite de la barre de navigation :
          <ul>
            <li>
              <Download size={14} class="inline" />
              <span class="font-medium">Texte</span>
              ou <span class="font-medium">Excel / Calc</span> — télécharge un fichier
              avec la liste des produits.
            </li>
            <li>
              <Printer size={14} class="inline" />
              <span class="font-medium">Imprimer / PDF</span>
              — ouvre la boîte d'impression du navigateur. Pour obtenir un PDF, sélectionnez
              « Enregistrer au format PDF » comme imprimante.
            </li>
          </ul>
          Les exports correspondent à la liste telle qu'affichée à l'écran, filtres
          inclus (dates, type, magasin, responsable…).
        </li>
      </ul>
      <p>
        Tous les membres des équipes ou individus invités à participer à
        l'événement peuvent modifier les produits, ajouter des achats, dépenses,
        etc.
      </p>
    </InfoCollapse>

    <!-- header print -->
    <div class="print-only">
      <h2 class="text-lg font-bold">
        Produits pour {eventName}, du {formatDateShort(
          productsStore.dateStore.start ?? startDate ?? "",
        )} au {formatDateShort(productsStore.dateStore.end ?? endDate ?? "")}
      </h2>
    </div>

    {#if !globalState.isDesktop}
      <div class="flex items-center gap-2 px-4">
        <div class="input input-lg flex flex-1 items-center gap-2">
          <Search class="size-4 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un produit, une recette..."
            class="grow"
            value={productsStore.filters.searchQuery}
            oninput={(e) => productsStore.setSearchQuery(e.currentTarget.value)}
          />
          {#if productsStore.filters.searchQuery}
            <button
              class="btn btn-xs btn-circle btn-error btn-outline opacity-60"
              onclick={() => productsStore.setSearchQuery("")}
            >
              <X class="size-4" />
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <ProductsCards
      {currentEvent}
      onOpenModal={openModal}
      onOpenGroupEditModal={openGroupEditModal}
      onOpenGroupPurchaseModal={openGroupPurchaseModal}
      onQuickValidation={handleQuickValidation}
      disabled={!canEdit}
    />
  {/if}

  <!-- Vue Mobile Cards -->

  <ProductModal
    productId={openModalProductId || ""}
    initialTab={openModalTab}
    onClose={closeModal}
  />

  {#if whoEditModalOpen}
    <WhoBatchEditModal
      productIds={groupEditProductIds}
      products={groupEditProducts}
      onClose={() => closeGroupEditModal("who")}
      onSuccess={handleGroupEditSuccess}
    />
  {/if}

  {#if storeEditModalOpen}
    <StoreBatchEditModal
      productIds={groupEditProductIds}
      products={groupEditProducts}
      onClose={() => closeGroupEditModal("store")}
      onSuccess={handleGroupEditSuccess}
    />
  {/if}

  {#if groupPurchaseModalOpen}
    <GroupPurchaseModal
      products={groupPurchaseProducts}
      onClose={closeGroupPurchaseModal}
      onSuccess={handleGroupPurchaseSuccess}
    />
  {/if}

  <AddProductModal bind:open={isAddProductModalOpen} />

  <GlobalPurchasesModal bind:isOpen={GlobalPurchasesModalisOpen} />

  {#if globalState.isDesktop}
    <div class="fixed bottom-0 left-0 z-50 transition-all print:hidden">
      <div
        class="rounded-tr-box bg-blue-100 text-blue-800 {hoverHelp.isExpanded
          ? ' w-fit px-4 py-2'
          : '  cursor-pointer px-3 py-2'}"
      >
        {#if hoverHelp.isExpanded}
          <div class="flex items-center justify-center">
            <Info class="me-2 size-5" />
            {hoverHelp.msg}

            <button
              class="btn btn-xs btn-circle btn-ghost ms-3"
              onclick={() => hoverHelp.collapse()}
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        {:else}
          <div
            class="flex items-center justify-center"
            role="button"
            tabindex="0"
            onclick={() => hoverHelp.expand()}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                hoverHelp.expand();
              }
            }}
            aria-label="Aide"
          >
            <Info class="size-6" />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<ConfirmModal
  isOpen={printModalOpen}
  title="Imprimer la liste de courses"
  message="Vous pouvez affiner les produits à imprimer en utilisant les filtres (dates, type, magasin, responsable…). Lors de l'impression, ajustez les options « Marges » et « Échelle » du navigateur pour un rendu optimal."
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
