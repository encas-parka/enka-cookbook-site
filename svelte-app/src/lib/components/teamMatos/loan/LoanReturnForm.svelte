<script lang="ts">
  /**
   * Fiche de retour d'un emprunt : déclaration de l'état de chaque matériel
   * (ok / à réparer / perdu), notes de retour et validation.
   *
   * Cœur sans chrome : la page dossier (onglet Retour) est son enveloppe et
   * déclenche `submit()` / `exportSheet()` depuis la navbar. Le parent
   * fournit l'emprunt, reçoit `onCompleted` et lit `valid` / `saving` /
   * `dirty`.
   */
  import { untrack } from "svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import type {
    EnrichedMaterielLoan,
    MaterielLoanItem,
  } from "$lib/types/materiel.types";
  import {
    buildLoanReturnMarkdown,
    type LoanReturnItem,
  } from "$lib/utils/loan-return-markdown";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";
  import { formatDateDayMonthShort } from "$lib/utils/date-helpers";
  import {
    getMaterielTypeBgClass,
    getMaterielTypeColorClass,
  } from "$lib/utils/materiel.utils";
  import {
    AlertTriangle,
    Box,
    Check,
    ChefHat,
    Flame,
    Package,
    SoapDispenserDroplet,
    Utensils,
    Wrench,
    X,
    Zap,
  } from "@lucide/svelte";

  interface ReturnRow {
    materielId: string;
    materielName: string;
    materielType: string | null; // Type du matériel
    quantity: number;
    lostQuantity: number;
    brokenQuantity: number;
    okQuantity: number;
    state: "pending" | "ok" | "issues"; // État déclaratif de l'utilisateur
  }

  interface Props {
    /** Emprunt à retourner. */
    loan: EnrichedMaterielLoan;
    /** Appelé après un retour enregistré. */
    onCompleted?: () => void;
    /** Le prêt est déjà clôturé : la fiche est en lecture seule. */
    isReadOnly?: boolean;
    /** La saisie est-elle complète et cohérente ? */
    valid?: boolean;
    /** Enregistrement en cours (état du bouton de l'enveloppe). */
    saving?: boolean;
    /** L'utilisateur a-t-il modifié la déclaration ? (garde de navigation) */
    dirty?: boolean;
  }

  let {
    loan,
    onCompleted,
    isReadOnly = $bindable(false),
    valid = $bindable(false),
    saving = $bindable(false),
    dirty = $bindable(false),
  }: Props = $props();

  let showEarlyReturnModal = $state(false); // Confirmation de retour anticipé
  let returnNotes = $state("");
  let returnedAt = $state<string | null>(null);
  let materielsReturns = $state<ReturnRow[]>([]);
  let error = $state("");

  // Init : une fois par (emprunt, statut). Rejouer l'init à chaque mise à jour
  // du store effacerait les déclarations en cours de saisie.
  let initializedKey = $state<string | null>(null);

  $effect(() => {
    const key = `${loan.id}:${loan.status}`;
    if (initializedKey === key) return;
    initializedKey = key;

    isReadOnly = loan.status === "completed";
    returnedAt = loan.returnedAt
      ? new Date(loan.returnedAt).toLocaleDateString("fr-FR")
      : null;
    returnNotes = loan.returnNotes || "";

    materielsReturns = loan.materielItems.map((item) => {
      const materiel = materielStore.getMaterielById(item.materielId);

      if (isReadOnly) {
        const lost = item.lostQuantity || 0;
        const broken = item.brokenQuantity || 0;
        return {
          materielId: item.materielId,
          materielName: item.materielName,
          materielType: materiel?.type || null,
          quantity: item.quantity,
          lostQuantity: lost,
          brokenQuantity: broken,
          okQuantity: item.quantity - lost - broken,
          state: lost > 0 || broken > 0 ? "issues" : "ok",
        };
      }

      return {
        materielId: item.materielId,
        materielName: item.materielName,
        materielType: materiel?.type || null,
        quantity: item.quantity,
        lostQuantity: 0,
        brokenQuantity: 0,
        okQuantity: item.quantity,
        state: "pending" as const,
      };
    });

    // La baseline « dirty » se capture une fois le remplissage terminé.
    baseline = untrack(currentSignature);
  });

  // --- Garde de navigation : signature de la déclaration courante ---

  let baseline = $state("");

  function currentSignature(): string {
    return JSON.stringify({
      notes: returnNotes,
      items: materielsReturns.map((item) => [
        item.state,
        item.lostQuantity,
        item.brokenQuantity,
        item.okQuantity,
      ]),
    });
  }

  const isDirty = $derived(baseline !== "" && currentSignature() !== baseline);

  $effect(() => {
    dirty = isDirty;
  });

  // Icône du type de matériel
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

  // Recalcule les quantités OK
  function updateQuantities(index: number) {
    const item = materielsReturns[index];
    const totalLost = item.lostQuantity;
    const totalBroken = item.brokenQuantity;
    item.okQuantity = item.quantity - totalLost - totalBroken;
    (item.lostQuantity > 0 || item.brokenQuantity > 0) &&
      (item.state = "issues");
  }

  // Sommes cohérentes : perdu + cassé + ok = quantité empruntée
  const quantitiesConsistent = $derived(
    materielsReturns.every(
      (item) =>
        item.lostQuantity + item.brokenQuantity + item.okQuantity ===
        item.quantity,
    ),
  );

  // Chaque matériel doit avoir été déclaré
  const allDeclared = $derived(
    materielsReturns.every((item) => item.state !== "pending"),
  );

  const isValid = $derived(quantitiesConsistent && allDeclared);

  $effect(() => {
    valid = isValid;
    error = quantitiesConsistent
      ? ""
      : "erreur, veuillez vérifez le formulaire ";
  });

  // --- Validation du retour ---

  function handleSubmit() {
    if (!isValid || saving) return;

    // Vérifier si le retour est effectué avant la endDate
    const now = new Date();
    const endDate = new Date(loan.endDate || "");

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

      await materielStore.completeLoanWithReturn(loan.id, {
        materiels,
        returnNotes: returnNotes.trim() || undefined,
      });

      toastService.success("Retour enregistré avec succès");
      onCompleted?.();
    } catch (error) {
      console.error("[LoanReturnForm] Erreur enregistrement retour:", error);
      toastService.error("Erreur lors de l'enregistrement du retour");
    } finally {
      saving = false;
    }
  }

  // --- Export Markdown de la fiche ---

  function handleExport() {
    const markdown = buildLoanReturnMarkdown({
      responsibleName: loan.responsibleName,
      startDate: loan.startDate,
      endDate: loan.endDate,
      eventName: loan.eventName,
      notes: returnNotes,
      returnedAt: isReadOnly ? loan.returnedAt : null,
      items: materielsReturns.map((item): LoanReturnItem => ({
        materielName: item.materielName,
        quantity: item.quantity,
        lostQuantity: item.lostQuantity,
        brokenQuantity: item.brokenQuantity,
      })),
    });

    const slug =
      toSlug(loan.eventName || loan.responsibleName || "") || "reservation";
    shareOrDownload(markdown, `${slug}-retour.md`, "Fiche de retour exportée");
  }

  // --- API impérative (l'enveloppe porte les boutons : navbar de la page) ---

  /** Déclenche la validation, avec son éventuelle confirmation de retour anticipé. */
  export function submit() {
    handleSubmit();
  }

  /** Exporte la fiche de retour (état déclaré courant) en Markdown. */
  export function exportSheet() {
    handleExport();
  }
</script>

<div class="card mb-6 bg-base-100 shadow-sm max-sm:card-xs">
  <div class="card-body">
    {#if isReadOnly && returnedAt}
      <div class="mb-4 alert alert-info max-md:alert-vertical">
        <Package class="h-5 w-5" />
        <div>
          <div class="font-bold">Retour enregistré</div>
          <div class="text-sm">Le {returnedAt}</div>
        </div>
      </div>
    {/if}

    <h2 class="mb-4 card-title">
      <Package class="h-5 w-5" />
      Matériels empruntés
    </h2>

    <!-- Liste des matériels -->
    <div class="space-y-4">
      {#each materielsReturns as item, index (index)}
        {#snippet typeIcon(type)}
          {@const Icon = getTypeIcon(type)}
          <div class="{getMaterielTypeBgClass(type)} rounded-lg p-2">
            <Icon class="{getMaterielTypeColorClass(type)} size-4 sm:size-5" />
          </div>
        {/snippet}

        <div
          class="flex flex-wrap items-center justify-between rounded-box bg-base-200 px-2 py-1 sm:px-4"
        >
          <!-- Nom du matériel -->
          <div class="mb-2 flex items-center gap-4">
            {@render typeIcon(item.materielType)}
            <div class="font-medium sm:text-base">{item.materielName}</div>
            <div class="font-semibold opacity-70">({item.quantity})</div>
          </div>

          {#if item.quantity === 1}
            {#if isReadOnly}
              <!-- Mode lecture seule : afficher l'état -->
              <div class="ms-auto flex items-center justify-end gap-6 p-2">
                {#if item.brokenQuantity > 0}
                  <div class="badge gap-2 badge-warning">
                    <AlertTriangle class="h-4 w-4" />
                    À réparer : {item.brokenQuantity}
                  </div>
                {/if}
                {#if item.lostQuantity > 0}
                  <div class="badge gap-2 badge-error">
                    <X class="h-4 w-4" />
                    Perdu : {item.lostQuantity}
                  </div>
                {/if}
                {#if item.okQuantity > 0}
                  <div class="badge gap-2 badge-success">
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
                  class="btn btn-sm btn-warning {item.brokenQuantity === 0 &&
                    'btn-outline'}"
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
            {#if isReadOnly}
              <!-- Mode lecture seule : afficher les quantités -->
              <div class="ms-auto flex flex-wrap justify-end gap-4">
                {#if item.brokenQuantity > 0}
                  <div class="badge gap-2 badge-warning">
                    <AlertTriangle class="h-4 w-4" />
                    À réparer : {item.brokenQuantity}
                  </div>
                {/if}
                {#if item.lostQuantity > 0}
                  <div class="badge gap-2 badge-error">
                    <X class="h-4 w-4" />
                    Perdus : {item.lostQuantity}
                  </div>
                {/if}
                {#if item.okQuantity > 0}
                  <div class="badge gap-2 badge-success">
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
                      class=" w-full input-sm"
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
    <fieldset class="mt-6 fieldset bg-base-100">
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
          class="textarea-bordered textarea w-full"
          rows="2"
          bind:value={returnNotes}
          placeholder="Remarques sur l'état du matériel, problèmes constatés..."
          maxlength="500"
          disabled={saving}></textarea>
      {/if}
    </fieldset>
  </div>
  {#if error}
    <div class="label text-error">
      <span>{error}</span>
    </div>
  {/if}
</div>

<!-- Modal de confirmation pour retour anticipé -->
{#if showEarlyReturnModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <p class="py-4">
        Bizarre ! La date de fin de l'emprunt est prévue pour le{" "}
        <strong>{formatDateDayMonthShort(loan.endDate)}</strong>. Vous êtes en
        train d'effectuer le retour avant cette date.
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
            <span class="loading loading-sm loading-spinner"></span>
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
