<script lang="ts">
  /**
   * Fiche de retour d'un emprunt : déclaration de l'état de chaque
   * matériel (ok / à réparer / perdu), notes de retour et validation.
   *
   * Cœur sans chrome : la page dossier (onglet Retour) est son enveloppe
   * et déclenche `submit()` / `exportSheet()` depuis la navbar. Le parent
   * fournit l'emprunt, reçoit `onCompleted` et lit `valid` / `saving` /
   * `dirty`.
   *
   * Grammaire de déclaration :
   * - rangées groupées par type, tout déplié ; en-tête de groupe avec
   *   badge d'avancement et raccourci « tout est ok » (ne touche que les
   *   rangées non déclarées) ;
   * - quantité 1 : trio de boutons À réparer / Perdu / Ok (actif plein) ;
   * - quantité > 1 : saisies Perdus / À réparer (sélection au focus,
   *   steppers masqués), le restant OK est calculé — jamais saisissable,
   *   donc la somme est cohérente par construction ;
   * - validation : chaque matériel est déclaré (plus de contrôle de
   *   cohérence, garanti par le calcul) ;
   * - bouton global « Tout est conforme » pour le cas nominal.
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
    /** Déclaration de l'utilisateur : pending = pas encore exprimée. */
    state: "pending" | "ok" | "issues";
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
          state: lost > 0 || broken > 0 ? ("issues" as const) : ("ok" as const),
        };
      }

      return {
        materielId: item.materielId,
        materielName: item.materielName,
        materielType: materiel?.type || null,
        quantity: item.quantity,
        lostQuantity: 0,
        brokenQuantity: 0,
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

  const pendingCount = $derived(
    materielsReturns.filter((item) => item.state === "pending").length,
  );

  const isValid = $derived(pendingCount === 0);

  $effect(() => {
    valid = isValid;
  });

  // --- Déclarations ---

  /** Trio quantité 1 : un seul état actif à la fois. */
  function setTri(item: ReturnRow, kind: "ok" | "lost" | "broken") {
    if (kind === "ok") {
      item.state = "ok";
      item.lostQuantity = 0;
      item.brokenQuantity = 0;
      return;
    }
    item.state = "issues";
    item.lostQuantity = kind === "lost" ? 1 : 0;
    item.brokenQuantity = kind === "broken" ? 1 : 0;
  }

  /**
   * Saisie quantité > 1 : borne la valeur pour que perdu + à réparer ne
   * dépasse pas la quantité empruntée ; à zéro la rangée redevient à
   * déclarer. Le restant OK est calculé à l'affichage.
   */
  function onQty(item: ReturnRow, which: "lost" | "broken", value: number) {
    const parsed = Number.isNaN(value) ? 0 : Math.max(0, value);
    const other = which === "lost" ? item.brokenQuantity : item.lostQuantity;
    const capped = Math.min(parsed, item.quantity - other);
    if (which === "lost") item.lostQuantity = capped;
    else item.brokenQuantity = capped;
    item.state =
      item.lostQuantity + item.brokenQuantity > 0 ? "issues" : "pending";
  }

  /** Raccourci groupe/global : ne touche que les rangées non déclarées. */
  function markRowsOk(rows: ReturnRow[]) {
    for (const row of rows) {
      if (row.state === "pending") row.state = "ok";
    }
  }

  /** Reprendre la saisie sur une rangée déclarée ok. */
  function reopen(item: ReturnRow) {
    item.state = "pending";
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

<div class="card mx-auto max-w-3xl bg-base-100 shadow-sm max-sm:card-xs">
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
      {#if !isReadOnly}
        {#if pendingCount > 0}
          <button
            class="btn btn-outline btn-sm btn-success"
            onclick={() => markRowsOk(materielsReturns)}
            title="Déclarer conformes toutes les rangées non déclarées"
          >
            <Check class="h-4 w-4" />
            Tout est conforme
          </button>
        {:else}
          <span class="badge gap-1 badge-sm badge-success">
            <Check class="h-3 w-3" />
            Conforme
          </span>
        {/if}
      {/if}
    </div>

    <!-- Groupes par type, tout déplié (lecture comme déclaration) -->
    <div class="space-y-3">
      {#each groupedReturns as group (group.type)}
        <MaterielTypeGroup type={group.type} count={group.items.length}>
          {#snippet headerRight()}
            {#if !isReadOnly}
              {@const pending = group.items.filter(
                (item) => item.state === "pending",
              ).length}
              {#if pending === 0}
                <span class="badge gap-1 badge-sm badge-success">
                  <Check class="h-3 w-3" />
                  Conforme
                </span>
              {:else}
                <span class="badge badge-sm badge-warning"
                  >{pending} à déclarer</span
                >
                <button
                  class="btn btn-ghost text-success btn-xs"
                  onclick={() => markRowsOk(group.items)}
                  title="Déclarer conformes les rangées non déclarées du groupe"
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
              {#if isReadOnly}
                <!-- Lecture seule : l'état enregistré en badges -->
                {#if item.brokenQuantity > 0}
                  <div class="badge gap-1 badge-sm badge-warning">
                    <AlertTriangle class="h-3 w-3" />
                    À réparer : {item.brokenQuantity}
                  </div>
                {/if}
                {#if item.lostQuantity > 0}
                  <div class="badge gap-1 badge-sm badge-error">
                    <X class="h-3 w-3" />
                    Perdu : {item.lostQuantity}
                  </div>
                {/if}
                {#if item.quantity - item.lostQuantity - item.brokenQuantity > 0}
                  <div class="badge gap-1 badge-sm badge-success">
                    <Check class="h-3 w-3" />
                    OK : {item.quantity -
                      item.lostQuantity -
                      item.brokenQuantity}
                  </div>
                {/if}
              {:else if item.quantity === 1}
                <!-- Trio exclusif : actif plein, inactif outline -->
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
                    aria-label="Perdu"
                    onclick={() => setTri(item, "lost")}
                  >
                    <X class="h-4 w-4" />
                    Perdu
                  </button>
                  <button
                    class="btn btn-sm {item.state === 'ok'
                      ? 'btn-success'
                      : 'btn-outline btn-success'}"
                    type="button"
                    aria-label="Ok"
                    onclick={() => setTri(item, "ok")}
                  >
                    <Check class="h-4 w-4" />
                    Ok
                  </button>
                </div>
              {:else if item.state === "ok"}
                <div class="flex items-center gap-1">
                  <span class="badge badge-sm tabular-nums badge-success"
                    >×{item.quantity} OK</span
                  >
                  <button
                    class="btn btn-ghost btn-xs"
                    type="button"
                    onclick={() => reopen(item)}
                  >
                    modifier
                  </button>
                </div>
              {:else}
                <!-- Saisie : sélection au focus (frappe = remplacement),
                     steppers masqués (.qty-input), restant OK calculé -->
                <div class="flex flex-wrap items-center gap-2">
                  <label class="input input-sm">
                    <span class="label border-r border-base-300 pr-2"
                      >Perdus</span
                    >
                    <input
                      type="number"
                      class="qty-input w-12 text-center font-semibold tabular-nums"
                      inputmode="numeric"
                      autocomplete="off"
                      min="0"
                      max={item.quantity}
                      value={item.lostQuantity}
                      aria-label="Quantité perdue"
                      onfocus={(e) => e.currentTarget.select()}
                      oninput={(e) =>
                        onQty(item, "lost", parseInt(e.currentTarget.value))}
                    />
                  </label>
                  <label class="input input-sm">
                    <span class="label border-r border-base-300 pr-2"
                      >À réparer</span
                    >
                    <input
                      type="number"
                      class="qty-input w-12 text-center font-semibold tabular-nums"
                      inputmode="numeric"
                      autocomplete="off"
                      min="0"
                      max={item.quantity}
                      value={item.brokenQuantity}
                      aria-label="Quantité à réparer"
                      onfocus={(e) => e.currentTarget.select()}
                      oninput={(e) =>
                        onQty(item, "broken", parseInt(e.currentTarget.value))}
                    />
                  </label>
                  {#if item.quantity - item.lostQuantity - item.brokenQuantity > 0}
                    <span class="badge badge-sm tabular-nums badge-success"
                      >×{item.quantity -
                        item.lostQuantity -
                        item.brokenQuantity}
                      OK</span
                    >
                  {/if}
                </div>
              {/if}
            </LoanItemReadRow>
          {/each}
        </MaterielTypeGroup>
      {/each}
    </div>

    {#if !isReadOnly && pendingCount > 0}
      <p class="mt-3 text-sm text-base-content/70">
        {pendingCount}
        matériel{pendingCount > 1 ? "s" : ""} à déclarer : indiquez l'état de chaque
        matériel (OK, à réparer ou perdu).
      </p>
    {/if}

    <!-- Notes de retour -->
    <fieldset class="mt-4 fieldset bg-base-100">
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
