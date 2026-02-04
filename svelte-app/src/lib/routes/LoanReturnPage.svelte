<script lang="ts">
  import {
    ArrowLeft,
    Check,
    X,
    AlertTriangle,
    Package,
    RotateCcw,
    Loader,
    Zap,
    Wrench,
    ChefHat,
    Box,
    Utensils,
    Flame,
    SoapDispenserDroplet,
  } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { route, navigate } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type { MaterielLoanItem } from "$lib/types/materiel.types";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import {
    getMaterielTypeBgClass,
    getMaterielTypeColorClass,
    getMaterielTypeConfig,
  } from "$lib/utils/materiel.utils";

  // État
  const loanId = $derived(route.params.loanId);
  let loading = $state(false);
  let saving = $state(false);
  let isReadOnly = $state(false); // Mode lecture seule pour les prêts complétés
  let showEarlyReturnModal = $state(false); // Modal de confirmation pour retour anticipé
  let returnNotes = $state("");
  let returnedAt = $state<string | null>(null);
  let materielsReturns = $state<
    Array<{
      materielId: string;
      materielName: string;
      materielType: string | null; // Type du matériel
      quantity: number;
      lostQuantity: number;
      brokenQuantity: number;
      okQuantity: number;
      state: "pending" | "ok" | "issues"; // État déclaratif de l'utilisateur
    }>
  >([]);
  let error = $state("");

  // Dérivés
  const loan = $derived.by(() => {
    if (!loanId) return null;
    return materielStore.getLoanById(loanId);
  });

  // Fonction pour obtenir l'icône selon le type de matériel
  function getTypeIcon(type: string | null | undefined) {
    switch (type) {
      case "electronic":
        return Zap;
      case "manual":
        return Wrench;
      case "cooking":
        return ChefHat;
      case "dish":
        return Utensils;
      case "gaz":
        return Flame;
      case "hygiene":
        return SoapDispenserDroplet;
      case "other":
      default:
        return Box;
    }
  }

  // Initialisation réactive aux changements de route
  $effect(() => {
    if (!loanId) {
      toastService.error("Emprunt non trouvé");
      navigate("/dashboard/loans");
      return;
    }

    // Charger l'emprunt
    const loanData = materielStore.getLoanById(loanId);
    if (
      !loanData ||
      (loanData.status !== "accepted" && loanData.status !== "completed")
    ) {
      toastService.error("Emprunt non valide");
      navigate("/dashboard/loans");
      return;
    }

    // Mode preview si le prêt est déjà complété
    if (loanData.status === "completed") {
      isReadOnly = true;
      returnedAt = loanData.returnedAt
        ? new Date(loanData.returnedAt).toLocaleDateString("fr-FR")
        : null;
      returnNotes = loanData.returnNotes || "";

      // Initialiser avec les données existantes
      materielsReturns = loanData.materielItems.map((item) => {
        const lost = item.lostQuantity || 0;
        const broken = item.brokenQuantity || 0;
        const ok = item.quantity - lost - broken;

        // Récupérer le type depuis le store
        const materiel = materielStore.getMaterielById(item.materielId);

        return {
          materielId: item.materielId,
          materielName: item.materielName,
          materielType: materiel?.type || null,
          quantity: item.quantity,
          lostQuantity: lost,
          brokenQuantity: broken,
          okQuantity: ok,
          state: lost > 0 || broken > 0 ? "issues" : "ok",
        };
      });
    } else {
      // Initialiser les matériels pour le retour (mode édition)
      materielsReturns = loanData.materielItems.map((item) => {
        // Récupérer le type depuis le store
        const materiel = materielStore.getMaterielById(item.materielId);

        return {
          materielId: item.materielId,
          materielName: item.materielName,
          materielType: materiel?.type || null,
          quantity: item.quantity,
          lostQuantity: 0,
          brokenQuantity: 0,
          okQuantity: item.quantity,
          state: "pending", // État initial : pas encore déclaré
        };
      });
    }
  });

  // Calculer les quantités OK
  function updateQuantities(index: number) {
    const item = materielsReturns[index];
    const totalLost = item.lostQuantity;
    const totalBroken = item.brokenQuantity;
    item.okQuantity = item.quantity - totalLost - totalBroken;
    (item.lostQuantity > 0 || item.brokenQuantity > 0) &&
      (item.state = "issues");
  }

  // Vérifier si le formulaire est valide
  const isValid = $derived.by(() => {
    for (const item of materielsReturns) {
      if (
        item.lostQuantity + item.brokenQuantity + item.okQuantity !==
        item.quantity
      ) {
        error = "erreur, veuillez vérifez le formulaire ";
        return false;
      }
      if (item.state === "pending") return false;
    }
    return true;
  });

  // Retourner à la liste
  function goBack() {
    navigate("/dashboard/loans");
  }

  // Enregistrer le retour
  function handleSubmit() {
    if (!loanId || !isValid || saving) return;

    // Vérifier si le retour est effectué avant la endDate
    const now = new Date();
    const endDate = new Date(loan?.endDate || "");

    if (now < endDate) {
      // Retour anticipé : ouvrir le modal de confirmation
      showEarlyReturnModal = true;
    } else {
      // Retour normal : procéder directement
      confirmSubmit();
    }
  }

  // Confirmer et envoyer le retour
  async function confirmSubmit() {
    if (!loanId) return;

    showEarlyReturnModal = false;
    saving = true;

    try {
      // Préparer les items avec les quantités mises à jour
      const materiels: MaterielLoanItem[] = materielsReturns.map((item) => ({
        materielId: item.materielId,
        materielName: item.materielName,
        quantity: item.quantity,
        lostQuantity: item.lostQuantity,
        brokenQuantity: item.brokenQuantity,
      }));

      await materielStore.completeLoanWithReturn(String(loanId), {
        materiels,
        returnNotes: returnNotes.trim() || undefined,
      });

      toastService.success("Retour enregistré avec succès");
      goBack();
    } catch (error) {
      console.error("[LoanReturnPage] Erreur enregistrement retour:", error);
      toastService.error("Erreur lors de l'enregistrement du retour");
    } finally {
      saving = false;
    }
  }
</script>

<div class="container mx-auto p-4" transition:fade>
  <div class="mx-auto max-w-4xl">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-4">
      <button
        class="btn btn-circle btn-ghost"
        onclick={goBack}
        aria-label="Retour"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="flex-1">
        <h1 class="text-2xl font-bold">Fiche de retour</h1>
        {#if loan}
          <p class="text-sm opacity-70">
            Emprunt du {formatDateDayMonthShort(loan.startDate)} au{" "}
            {formatDateDayMonthShort(loan.endDate)}
          </p>
        {/if}
      </div>
      {#if isReadOnly}
        <div class="badge badge-info">Mode lecture seule</div>
      {/if}
    </div>

    {#if loan}
      <!-- Info emprunt -->
      <div class="card bg-base-100 mb-6 shadow-sm">
        <div class="card-body">
          {#if isReadOnly && returnedAt}
            <div class="alert alert-info max-md:alert-vertical mb-4">
              <Package class="h-5 w-5" />
              <div>
                <div class="font-bold">Retour enregistré</div>
                <div class="text-sm">Le {returnedAt}</div>
              </div>
            </div>
          {/if}

          <h2 class="card-title mb-4">
            <Package class="h-5 w-5" />
            Matériels empruntés
          </h2>

          <!-- Liste des matériels -->
          <div class="space-y-4">
            {#each materielsReturns as item, index (index)}
              {@const hasIssues =
                item.lostQuantity > 0 || item.brokenQuantity > 0}
              {@const isAllOk =
                item.lostQuantity === 0 && item.brokenQuantity === 0}

              <div
                class="bg-base-200 rounded-box flex flex-wrap items-center justify-between px-4 py-1"
              >
                <!-- Nom du matériel -->
                <div class="flex items-center gap-4">
                  {#snippet typeIcon(type)}
                    {@const Icon = getTypeIcon(type)}
                    <div class="{getMaterielTypeBgClass(type)} rounded-lg p-2">
                      <Icon class="{getMaterielTypeColorClass(type)} size-5" />
                    </div>
                  {/snippet}

                  {@render typeIcon(item.materielType)}
                  <div class="text-base font-medium">{item.materielName}</div>
                  <div class="font-semibold opacity-70">
                    ({item.quantity})
                  </div>
                </div>

                <!-- {item.quantity === 1 ? Style RecipeFilters pour 1 élément} -->
                {#if item.quantity === 1}
                  {#if isReadOnly}
                    <!-- Mode lecture seule : afficher l'état -->
                    <div class="flex items-center gap-6 p-2">
                      {#if item.brokenQuantity > 0}
                        <div class="badge badge-warning gap-2">
                          <AlertTriangle class="h-4 w-4" />
                          À réparer : {item.brokenQuantity}
                        </div>
                      {/if}
                      {#if item.lostQuantity > 0}
                        <div class="badge badge-error gap-2">
                          <X class="h-4 w-4" />
                          Perdu : {item.lostQuantity}
                        </div>
                      {/if}
                      {#if item.okQuantity > 0}
                        <div class="badge badge-success gap-2">
                          <Check class="h-4 w-4" />
                          OK : {item.okQuantity}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <!-- Mode édition : boutons interactifs -->
                    <div
                      class="ms-auto flex flex-wrap items-center justify-end gap-6 p-2"
                    >
                      <button
                        class="btn btn-sm btn-warning {item.brokenQuantity ===
                          0 && 'btn-outline'}"
                        class:ring-2={item.brokenQuantity > 0}
                        class:ring-warning={item.brokenQuantity > 0}
                        type="button"
                        aria-label="À réparer"
                        onclick={() => {
                          item.state = "issues";
                          item.lostQuantity = 0;
                          item.brokenQuantity = 1;
                          updateQuantities(index);
                        }}
                      >
                        <AlertTriangle class="h-4 w-4" /> à réparer
                      </button>
                      <button
                        class="btn btn-error btn-sm {item.lostQuantity === 0 &&
                          'btn-outline'}"
                        class:ring-2={item.lostQuantity > 0}
                        class:ring-error={item.lostQuantity > 0}
                        type="button"
                        aria-label="Perdu"
                        onclick={() => {
                          item.state = "issues";
                          item.lostQuantity = 1;
                          item.brokenQuantity = 0;
                          updateQuantities(index);
                        }}
                      >
                        <X class="h-4 w-4" />
                        perdu
                      </button>
                      <button
                        class="btn btn-circle btn-sm btn-success {item.state !==
                          'ok' && 'btn-outline'}"
                        type="button"
                        aria-label="Tout OK"
                        onclick={() => {
                          item.state = "ok";
                          item.lostQuantity = 0;
                          item.brokenQuantity = 0;
                          updateQuantities(index);
                        }}
                      >
                        <Check class="" />
                      </button>
                    </div>
                  {/if}
                {:else}
                  <!-- {item.quantity > 1 ? Inputs pour les quantités} -->
                  {#if isReadOnly}
                    <!-- Mode lecture seule : afficher les quantités -->
                    <div class="ms-auto flex flex-wrap justify-end gap-4">
                      {#if item.brokenQuantity > 0}
                        <div class="badge badge-warning gap-2">
                          <AlertTriangle class="h-4 w-4" />
                          À réparer : {item.brokenQuantity}
                        </div>
                      {/if}
                      {#if item.lostQuantity > 0}
                        <div class="badge badge-error gap-2">
                          <X class="h-4 w-4" />
                          Perdus : {item.lostQuantity}
                        </div>
                      {/if}
                      {#if item.okQuantity > 0}
                        <div class="badge badge-success gap-2">
                          <Check class="h-4 w-4" />
                          OK : {item.okQuantity}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <!-- Mode édition : inputs interactifs -->
                    <div class="flex flex-wrap gap-4">
                      <div class="min-w-[140px]">
                        <label class="input">
                          <span class="label-text">À réparer</span>
                          <input
                            type="number"
                            class="  input-sm w-full"
                            aria-label="Marquer comme à réparer"
                            min={0}
                            max={item.quantity}
                            bind:value={item.brokenQuantity}
                            onchange={() => updateQuantities(index)}
                          />
                        </label>
                      </div>
                      <div class="min-w-[140px]">
                        <label class="input w-full">
                          <span class="label-text">Perdus</span>
                          <input
                            type="number"
                            class=""
                            min={0}
                            max={item.quantity}
                            bind:value={item.lostQuantity}
                            onchange={() => updateQuantities(index)}
                          />
                        </label>
                      </div>

                      {#if item.lostQuantity > 0 || item.brokenQuantity > 0}
                        <div class="min-w-[100px]">
                          <label class="input w-full">
                            <span class="label-text">ok</span>
                            <input
                              type="number"
                              class=""
                              min={0}
                              max={item.quantity}
                              bind:value={item.okQuantity}
                              onchange={() => {
                                // Recalculer en fonction de lost/broken
                                const totalLost = item.lostQuantity;
                                const totalBroken = item.brokenQuantity;
                                item.state = "issues";
                                item.okQuantity = Math.min(
                                  item.quantity - totalLost - totalBroken,
                                  item.okQuantity,
                                );
                              }}
                            />
                          </label>
                        </div>
                      {:else}
                        <button
                          class="btn btn-success {item.state !== 'ok' &&
                            'btn-outline'}"
                          aria-label="Marquer comme ok"
                          onclick={() => {
                            item.state = "ok"; // ← Déclarer comme OK
                            item.lostQuantity = 0;
                            item.brokenQuantity = 0;
                            updateQuantities(index);
                          }}>tout est ok</button
                        >
                      {/if}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>

          <!-- Notes de retour -->
          <fieldset class="fieldset bg-base-100 mt-6">
            <legend class="fieldset-legend">Notes de retour (optionnel)</legend>
            {#if isReadOnly}
              <!-- Mode lecture seule -->
              {#if returnNotes}
                <div class="alert">
                  <p class="whitespace-pre-wrap">{returnNotes}</p>
                </div>
              {:else}
                <p class="text-sm italic opacity-50">Aucune note</p>
              {/if}
            {:else}
              <!-- Mode édition -->
              <textarea
                class="textarea textarea-bordered w-full"
                rows="2"
                bind:value={returnNotes}
                placeholder="Remarques sur l'état du matériel, problèmes constatés..."
                maxlength="500"
                disabled={saving}
              ></textarea>
            {/if}
          </fieldset>
        </div>
        {#if error}
          <div class="text-error label">
            <span>{error}</span>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        {#if !isReadOnly}
          <button class="btn btn-ghost" onclick={goBack} disabled={saving}>
            "Annuler"
          </button>
          <button
            class="btn btn-primary gap-2"
            onclick={handleSubmit}
            disabled={!isValid || saving}
          >
            {#if saving}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <RotateCcw class="h-4 w-4" />
            {/if}
            Valider le retour
          </button>
        {/if}
      </div>
    {:else}
      <div class="alert alert-warning">
        <span>Chargement de l'emprunt...</span>
      </div>
    {/if}
  </div>
</div>

<!-- Modal de confirmation pour retour anticipé -->
{#if showEarlyReturnModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <p class="py-4">
        Bizarre ! La date de fin de l'emprunt est prévue pour le{" "}
        <strong>{loan ? formatDateDayMonthShort(loan.endDate) : ""}</strong>.
        Vous êtes en train d'effectuer le retour avant cette date.
      </p>
      <p class="pb-4">Vous confirmez ce retour anticipé ?</p>
      <div class="modal-action">
        <button
          class="btn btn-ghost"
          onclick={() => (showEarlyReturnModal = false)}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          class="btn btn-warning"
          onclick={confirmSubmit}
          disabled={saving}
        >
          {#if saving}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            Confirmer le retour
          {/if}
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      onclick={() => (showEarlyReturnModal = false)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          showEarlyReturnModal = false;
        }
      }}
      aria-label="Fermer le modal"
    ></div>
  </div>
{/if}
