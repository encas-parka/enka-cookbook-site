/**
 * @vitest-environment jsdom
 */

/**
 * CreateMaterielModal — l'ajout de matériel au catalogue recette (ADR 0004, W).
 *
 * Seam : vraie modale + vrai recipeDataStore + fake-indexeddb. Contrairement
 * aux catégories, le matériel N'EST PAS un enregistrement PocketBase :
 * `addMateriel` est censé persister un ajout utilisateur dans `db.catalog`
 * (Dexie, clé "custom-materiel") par-dessus les constantes DEFAULT_MATERIEL.
 *
 * BUG ÉPINGLÉ (découvert en testant, lot 5) : la persistance échoue TOUJOURS —
 * `RecipeDataStore.addMateriel` passe le tableau `$state` (#customMateriel,
 * un Proxy) directement à `db.catalog.put` et le clonage structuré d'IndexedDB
 * refuse les proxy (spéc. StructuredSerialize, mesuré aussi en Node : même
 * DataCloneError). Le submit valide affiche donc l'erreur serveur, la modale
 * reste ouverte et RIEN n'est persisté. Comportement actuel épinglé : le fix
 * store (copier le tableau avant put — `$state.snapshot` ou spread) fera
 * repasser ces tests au contrat nominal (patron GroupPurchaseModal, lot 4a).
 * `addRegime` porte la même forme (aucun composant ne l'appelle aujourd'hui).
 */

vi.mock("$lib/services/toast.service.svelte", async () => {
  const { mockToastService } = await import("$lib/test/toast-stub");
  return mockToastService();
});

// ModalContainer (via ModalHeader/Content/Footer) lit GlobalState
vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("$lib/stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";
import { toastStub } from "$lib/test/toast-stub";
import { db } from "$lib/db-sync/pb-sync";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import CreateMaterielModal from "../CreateMaterielModal.svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";

/** Purge les ajouts utilisateur persistés (clearDexie ne couvre pas db.catalog). */
async function clearCustomCatalog(): Promise<void> {
  await db.catalog.where("key").startsWith("custom-").delete();
}

async function customMaterielRow(): Promise<string[] | undefined> {
  const row = await db.catalog.get("custom-materiel");
  return row?.data as string[] | undefined;
}

function mountModal(onMaterielCreated?: (name: string) => void) {
  const holder = bindableProps({
    open: true,
    onMaterielCreated: onMaterielCreated ?? ((_name: string) => {}),
  }) as Record<string, unknown>;
  const target = mountSvelte(CreateMaterielModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, holder };
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>("#materiel-name-input");
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function submit(target: HTMLElement): void {
  getByText(target, "button", "Créer").click();
  flushSync();
}

describe("CreateMaterielModal — persistance (bug épinglé)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    toastStub.reset();
    await clearDexie();
    await clearCustomCatalog();
  });
  afterEach(async () => {
    // Le focus différé de la modale (setTimeout 50 ms, effet d'ouverture) doit
    // s'exécuter tant que l'environnement jsdom vit : sinon il tombe après le
    // démontage (« document is not defined ») en erreur non gérée.
    await new Promise((resolve) => setTimeout(resolve, 60));
    cleanupSvelte();
  });

  it("BUG épinglé : le submit valide échoue en DataCloneError, rien n'est persisté", async () => {
    const created: string[] = [];
    const { target, holder } = mountModal((name) => created.push(name));

    setInputValue(nameInput(target), "Déhydrateur Test");
    submit(target);

    await waitForCondition(
      () => toastStub.error.mock.calls.length > 0,
      "l'échec de persistance est toasté",
      100,
      flushSync,
    );
    // La modale reste ouverte pour correction (chemin catch de handleSubmit)
    expect(modalDialog(target)).not.toBeNull();
    expect(holder.open).toBe(true);
    expect(created).toEqual([]);
    expect(await customMaterielRow()).toBeUndefined();
    // Ni succès ni confirmation parent
    expect(toastStub.success).not.toHaveBeenCalled();
  });

  it("le submit à vide affiche la validation et n'appelle jamais le store", () => {
    const created: string[] = [];
    const { target } = mountModal((name) => created.push(name));

    submit(target);

    expect(target.textContent).toContain("Le nom est requis");
    expect(modalDialog(target)).not.toBeNull();
    expect(toastStub.error).not.toHaveBeenCalled();
    expect(toastStub.success).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it("« Annuler » ferme sans persister", async () => {
    const { target, holder } = mountModal();

    getByText(target, "button", "Annuler").click();
    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme à l'annulation",
      100,
      flushSync,
    );
    expect(holder.open).toBe(false);
    expect(await customMaterielRow()).toBeUndefined();
  });
});
