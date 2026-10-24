<script lang="ts">
  /**
   * Fiche de retour d'un emprunt : déclaration de l'état de chaque
   * matériel (ok / à réparer / manquant), notes de retour et validation.
   *
   * Cœur sans chrome : la page dossier (onglet Retour) est son enveloppe
   * et déclenche `submit()` / `exportSheet()` depuis la navbar. Le parent
   * fournit l'emprunt, reçoit `onCompleted` et lit `valid` / `saving` /
   * `dirty`.
   *
   * Grammaire de déclaration — l'esprit : la fiche doit inciter à
   * vérifier, pas permettre un « oui oui » expéditif :
   * - rangées groupées par type, tout déplié ; en-tête de groupe avec
   *   badge d'avancement et raccourci « tout est ok » qui passe par une
   *   confirmation (« Vous confirmez avoir vérifié… ») et n'atteste que
   *   les rangées non déclarées ;
   * - au repos, une rangée propose deux gestes : « Un problème » (ouvre
   *   un panneau sous la ligne) et « Ok ×N » — atteste que tout est
   *   revenu intact, posé en bout de lecture (geste affirmatif à
   *   droite) ;
   * - le panneau problème porte les valeurs (manquants / à réparer ;
   *   bascules pour une quantité de 1) : les valeurs font foi, la
   *   rangée est déclarée dès qu'une valeur est saisie — « retirer le
   *   problème » remet à zéro, un lien renvoie aux notes pour détailler ;
   * - validation : chaque matériel est déclaré (attesté, ou problème
   *   déclaré).
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
  import { groupByTypeOrder } from "$lib/utils/materiel-list.utils";
  import { getMaterielTypeConfig } from "$lib/utils/materiel.utils";
  import MaterielTypeGroup from "../MaterielTypeGroup.svelte";
  import LoanItemReadRow from "./LoanItemReadRow.svelte";
  import ConfirmModal from "../../ui/ConfirmModal.svelte";
  import { AlertTriangle, Check, Package, X } from "@lucide/svelte";

  interface ReturnRow {
    materielId: string;
    materielName: string;
    materielType: string | null;
    quantity: number;
    lostQuantity: number;
    brokenQuantity: number;
    /**
     * Attestation « vérifié » de l'utilisateur — le cas nominal « tout
     * est revenu intact », posée d'un geste sur une rangée sans valeur.
     */
    okChecked: boolean;
    /** Panneau problème ouvert sous la ligne. */
    panelOpen: boolean;
  }

  interface Props {
    /** Emprunt à retourner. */
    loan: EnrichedMaterielLoan;
    /** Appelé après un retour enregistré. */
    onCompleted?: () => void;
    /** Le prêt est déjà clôturé : la fiche est en lecture seule. */
    isReadOnly?: boolean;
    /** La déclaration est-elle complète ? */
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

  let showEarlyReturnModal = $state(false);
  let returnNotes = $state("");
  let returnedAt = $state<string | null>(null);
  let materielsReturns = $state<ReturnRow[]>([]);
  /** Groupe en cours d'attestation via le raccourci « tout est ok ». */
  let confirmGroup = $state<{ type: string; rows: ReturnRow[] } | null>(null);
  /** Champ notes, ciblé par le lien « préciser dans les notes ». */
  let notesEl = $state<HTMLTextAreaElement | null>(null);

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
          okChecked: true,
          panelOpen: false,
        };
      }

      return {
        materielId: item.materielId,
        materielName: item.materielName,
        materielType: materiel?.type || null,
        quantity: item.quantity,
        lostQuantity: 0,
        brokenQuantity: 0,
        okChecked: false,
        panelOpen: false,
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
        item.okChecked,
        item.lostQuantity,
        item.brokenQuantity,
      ]),
    });
  }

  const isDirty = $derived(baseline !== "" && currentSignature() !== baseline);

  $effect(() => {
    dirty = isDirty;
  });

  // --- Regroupement et validation ---

  const groupedReturns = $derived(
    groupByTypeOrder(materielsReturns, (r) => r.materielType),
  );

  /** Valeurs de problème déclarées sur la rangée (manquants + à réparer). */
  function problemOf(item: ReturnRow): number {
    return item.lostQuantity + item.brokenQuantity;
  }

  /**
   * Rangée déclarée : attestée par l'utilisateur (« Ok », cas nominal),
   * ou portant un problème déclaré — les valeurs saisies font foi.
   */
  function isRowDeclared(item: ReturnRow): boolean {
    return item.okChecked || problemOf(item) > 0;
  }

  const undeclaredCount = $derived(
    materielsReturns.filter((item) => !isRowDeclared(item)).length,
  );

  const isValid = $derived(undeclaredCount === 0);

  $effect(() => {
    valid = isValid;
  });

  // --- Déclarations ---

  /** Ouvre le panneau problème ; une attestation en cours est retirée. */
  function openProblem(item: ReturnRow) {
    item.okChecked = false;
    item.panelOpen = true;
  }

  /** Ferme le panneau et remet les valeurs à zéro (rangée non déclarée). */
  function closeProblem(item: ReturnRow) {
    item.lostQuantity = 0;
    item.brokenQuantity = 0;
    item.panelOpen = false;
  }

  /**
   * Une unité (quantité 1) : les boutons-valeur du panneau sont des
   * toggles — recliquer la valeur active la démarque.
   */
  function setTri(item: ReturnRow, kind: "lost" | "broken") {
    const active =
      kind === "lost" ? item.lostQuantity > 0 : item.brokenQuantity > 0;
    if (active) {
      if (kind === "lost") item.lostQuantity = 0;
      else item.brokenQuantity = 0;
      return;
    }
    if (kind === "lost") item.lostQuantity = 1;
    else item.brokenQuantity = 1;
    item.okChecked = false;
  }

  /**
   * Saisie quantité > 1 : borne la valeur pour que manquant + à réparer ne
   * dépasse pas la quantité empruntée, et décoche l'attestation — elle
   * porte sur les valeurs courantes, toute édition l'invalide.
   */
  function onQty(item: ReturnRow, which: "lost" | "broken", value: number) {
    const parsed = Number.isNaN(value) ? 0 : Math.max(0, value);
    const other = which === "lost" ? item.brokenQuantity : item.lostQuantity;
    const capped = Math.min(parsed, item.quantity - other);
    if (which === "lost") item.lostQuantity = capped;
    else item.brokenQuantity = capped;
    item.okChecked = false;
  }

  /**
   * Raccourci de groupe : n'atteste que les rangées non déclarées — une
   * rangée avec problème déclaré est épargnée — et referme leur panneau.
   */
  function markRowsOk(rows: ReturnRow[]) {
    for (const row of rows) {
      if (!isRowDeclared(row)) {
        row.okChecked = true;
        row.panelOpen = false;
      }
    }
  }

  /** Fait défiler jusqu'aux notes et y place le curseur. */
  function focusNotes() {
    notesEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    notesEl?.focus();
  }

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

<div class="card bg-base-100 max-sm:card-xs mx-auto max-w-3xl shadow-sm">
  <div class="card-body">
    {#if isReadOnly && returnedAt}
      <div class="alert alert-info max-md:alert-vertical">
        <Package class="h-5 w-5" />
        <div>
          <div class="font-bold">Retour enregistré</div>
          <div class="text-sm">Le {returnedAt}</div>
        </div>
      </div>
    {/if}

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="card-title">
        <Package class="h-5 w-5" />
        Matériels empruntés
      </h2>
    </div>

    <!-- Groupes par type, tout déplié (lecture comme déclaration) -->
    <div class="space-y-3">
      {#each groupedReturns as group (group.type)}
        <MaterielTypeGroup type={group.type} count={group.items.length}>
          {#snippet headerRight()}
            {#if !isReadOnly}
              {@const undeclared = group.items.filter(
                (item) => !isRowDeclared(item),
              ).length}
              {#if undeclared === 0}
                <span class="badge badge-success gap-1">
                  <Check class="h-3 w-3" />
                  Conforme
                </span>
              {:else}
                <span class="badge badge-warning">{undeclared} à déclarer</span>
                <button
                  class="btn btn-ghost text-success btn-sm ms-auto"
                  onclick={() =>
                    (confirmGroup = { type: group.type, rows: group.items })}
                  title="Attester les rangées non déclarées du groupe"
                >
                  <Check class="h-3 w-3" />
                  tout est ok
                </button>
              {/if}
            {/if}
          {/snippet}

          {#each group.items as item (item.materielId)}
            <LoanItemReadRow
              name={item.materielName}
              quantity={item.quantity}
              type={item.materielType}
            >
              {#snippet children()}
                {#if isReadOnly}
                  <!-- Lecture seule : l'état enregistré en badges -->
                  {#if item.brokenQuantity > 0}
                    <div class="badge badge-warning gap-1">
                      <AlertTriangle class="h-3 w-3" />
                      À réparer : {item.brokenQuantity}
                    </div>
                  {/if}
                  {#if item.lostQuantity > 0}
                    <div class="badge badge-error gap-1">
                      <X class="h-3 w-3" />
                      Manquant : {item.lostQuantity}
                    </div>
                  {/if}
                  {#if item.quantity - item.lostQuantity - item.brokenQuantity > 0}
                    <div class="badge badge-success gap-1">
                      <Check class="h-3 w-3" />
                      OK : {item.quantity -
                        item.lostQuantity -
                        item.brokenQuantity}
                    </div>
                  {/if}
                {:else if !item.panelOpen}
                  <!-- Repos : « Un problème » ouvre le panneau sous la
                       ligne ; « Ok ×N » atteste le cas nominal, posé en
                       bout de lecture (geste affirmatif à droite). -->
                  <div class="flex items-center gap-2">
                    <button
                      class="btn btn-outline btn-warning"
                      type="button"
                      onclick={() => openProblem(item)}
                    >
                      <AlertTriangle class="h-4 w-4" />
                      Un problème
                    </button>
                    <button
                      class="btn {item.okChecked
                        ? 'btn-success'
                        : 'btn-outline btn-success'}"
                      type="button"
                      title="Attester que tout est revenu intact"
                      onclick={() => (item.okChecked = true)}
                    >
                      <Check class="h-4 w-4" />
                      Ok{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </button>
                  </div>
                {/if}
              {/snippet}
              {#snippet details()}
                {#if !isReadOnly && item.panelOpen}
                  <!-- Panneau problème : les valeurs font foi — la rangée
                       est déclarée dès qu'une valeur est saisie. -->
                  <div
                    class="border-warning/40 mt-1 border-t border-dashed pt-2"
                  >
                    {#if item.quantity === 1}
                      <!-- Une unité : deux bascules suffisent (recliquer
                           la valeur active la démarque). -->
                      <div class="flex flex-wrap items-center gap-1">
                        <button
                          class="btn btn-sm {item.brokenQuantity > 0
                            ? 'btn-warning'
                            : 'btn-outline btn-warning'}"
                          type="button"
                          aria-label="À réparer"
                          onclick={() => setTri(item, "broken")}
                        >
                          <AlertTriangle class="h-4 w-4" />
                          À réparer
                        </button>
                        <button
                          class="btn btn-sm {item.lostQuantity > 0
                            ? 'btn-error'
                            : 'btn-outline btn-error'}"
                          type="button"
                          aria-label="Manquant"
                          onclick={() => setTri(item, "lost")}
                        >
                          <X class="h-4 w-4" />
                          Manquant
                        </button>
                      </div>
                    {:else}
                      <!-- Sélection au focus (frappe = remplacement),
                           steppers masqués (.qty-input) ; la somme est
                           plafonnée par onQty. -->
                      <div class="grid grid-cols-2 gap-2">
                        <label class="input">
                          <span class="label border-base-300 border-r pr-2"
                            >Manquants</span
                          >
                          <input
                            type="number"
                            class="qty-input w-8 text-center font-semibold tabular-nums"
                            inputmode="numeric"
                            autocomplete="off"
                            min="0"
                            max={item.quantity}
                            value={item.lostQuantity}
                            aria-label="Quantité manquante"
                            onfocus={(e) => e.currentTarget.select()}
                            oninput={(e) =>
                              onQty(
                                item,
                                "lost",
                                parseInt(e.currentTarget.value),
                              )}
                          />
                        </label>
                        <label class="input">
                          <span class="label border-base-300 border-r pr-2"
                            >À réparer</span
                          >
                          <input
                            type="number"
                            class="qty-input w-8 text-center font-semibold tabular-nums"
                            inputmode="numeric"
                            autocomplete="off"
                            min="0"
                            max={item.quantity}
                            value={item.brokenQuantity}
                            aria-label="Quantité à réparer"
                            onfocus={(e) => e.currentTarget.select()}
                            oninput={(e) =>
                              onQty(
                                item,
                                "broken",
                                parseInt(e.currentTarget.value),
                              )}
                          />
                        </label>
                      </div>
                    {/if}
                    <div
                      class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1"
                    >
                      <button
                        class="link link-hover text-base-content/60 text-xs"
                        type="button"
                        onclick={() => closeProblem(item)}
                      >
                        {problemOf(item) > 0
                          ? "retirer le problème"
                          : "annuler"}
                      </button>
                      {#if problemOf(item) > 0}
                        <button
                          class="link text-warning ms-auto text-xs"
                          type="button"
                          onclick={focusNotes}
                        >
                          préciser dans les notes
                        </button>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/snippet}
            </LoanItemReadRow>
          {/each}
        </MaterielTypeGroup>
      {/each}
    </div>

    {#if !isReadOnly && undeclaredCount > 0}
      <p class="text-base-content/70 mt-3 text-sm">
        {undeclaredCount}
        matériel{undeclaredCount > 1 ? "s" : ""} à déclarer : « Ok » si tout est revenu,
        « Un problème » sinon.
      </p>
    {/if}

    <!-- Notes de retour -->
    <fieldset class="fieldset bg-base-100 mt-4">
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
          bind:this={notesEl}
          placeholder="Remarques sur l'état du matériel, problèmes constatés…"
          maxlength="500"
          disabled={saving}></textarea>
      {/if}
    </fieldset>
  </div>
</div>

<!-- Confirmation du retour anticipé -->
{#if showEarlyReturnModal}
  <ConfirmModal
    isOpen={showEarlyReturnModal}
    title="Retour anticipé"
    message={`La date de fin de l'emprunt est prévue pour le ${formatDateDayMonthShort(loan.endDate)}. Vous confirmez ce retour anticipé ?`}
    variant="warning"
    confirmLabel="Confirmer le retour"
    onConfirm={confirmSubmit}
    onCancel={() => (showEarlyReturnModal = false)}
  />
{/if}

<!-- Attestation groupée : un geste conscient par type -->
{#if confirmGroup}
  <ConfirmModal
    isOpen={!!confirmGroup}
    title="Vérification du groupe"
    message={`Vous confirmez avoir vérifié qu'il ne manque rien dans le groupe « ${getMaterielTypeConfig(confirmGroup.type).label} » ?`}
    variant="warning"
    confirmLabel="Oui"
    cancelLabel="Non, pas vraiment"
    onConfirm={() => {
      if (!confirmGroup) return;
      markRowsOk(confirmGroup.rows);
      confirmGroup = null;
    }}
    onCancel={() => (confirmGroup = null)}
  />
{/if}
