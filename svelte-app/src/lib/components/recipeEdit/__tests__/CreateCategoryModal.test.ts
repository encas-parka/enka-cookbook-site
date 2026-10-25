/**
 * @vitest-environment jsdom
 */

/**
 * CreateCategoryModal — la création de catégorie de recette (ADR 0004, W).
 *
 * Seam : vraie modale + vrai recipeDataStore + stub-pb + fake-indexeddb
 * (patron AddProductModal.test). `addCategory` n'exige pas d'initialisation
 * du store (pas de garde isInitialized) : le catalogue est un enregistrement
 * PB `categories` (type "category") répliqué par le bridge.
 *
 * Contrats épinglés :
 *  - le submit crée la catégorie au serveur, toaste le succès, remonte le
 *    nom au parent et ferme la modale
 *  - le nom est trimmé avant l'appel store
 *  - le submit à vide (ou trop court) affiche la validation et n'écrit rien
 *  - « Annuler » ferme sans créer
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
import { currentFakePb } from "$lib/stores/__tests__/harness/stub-pb";
import { pb } from "$lib/db-sync/pb-sync";
import { clearDexie } from "$lib/stores/__tests__/harness/seed-dexie";
import { waitForCondition } from "$lib/stores/__tests__/harness/wait-for-condition";
import CreateCategoryModal from "../CreateCategoryModal.svelte";
import { modalDialog } from "$lib/test/__tests__/modal-harness";
import { bindableProps } from "$lib/test/bindable-props.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  setInputValue,
  getByText,
} from "$lib/test/mount-svelte";

async function resetState() {
  currentFakePb().reset();
  vi.restoreAllMocks();
  toastStub.reset();
  await clearDexie();
}

/**
 * Modale avec `open` réactif (prop `$bindable`) : la fermeture interne fait
 * disparaître le dialogue comme depuis la page.
 */
function mountModal(onCategoryCreated?: (name: string) => void) {
  const holder = bindableProps({
    open: true,
    onCategoryCreated: onCategoryCreated ?? ((_name: string) => {}),
  }) as Record<string, unknown>;
  const target = mountSvelte(CreateCategoryModal, holder as never);
  if (!modalDialog(target)) throw new Error("La modale ne s'est pas rendue");
  return { target, holder };
}

function nameInput(target: HTMLElement): HTMLInputElement {
  const input = target.querySelector<HTMLInputElement>("#category-name-input");
  if (!input) throw new Error("Champ nom introuvable");
  return input;
}

function submit(target: HTMLElement): void {
  getByText(target, "button", "Créer").click();
  flushSync();
}

async function serverCategories(): Promise<Record<string, unknown>[]> {
  return (await pb.collection("categories").getFullList({})) as Record<
    string,
    unknown
  >[];
}

describe("CreateCategoryModal — création", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("le submit crée la catégorie (type category), toaste, remonte le nom et ferme", async () => {
    const created: string[] = [];
    const { target, holder } = mountModal((name) => created.push(name));

    setInputValue(nameInput(target), "Bouchées salées");
    submit(target);

    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après la création",
      100,
      flushSync,
    );
    expect(holder.open).toBe(false);
    expect(created).toEqual(["Bouchées salées"]);
    expect(toastStub.success).toHaveBeenCalledWith(
      'Catégorie "Bouchées salées" créée avec succès',
    );

    const [record] = await serverCategories();
    expect(record.name).toBe("Bouchées salées");
    expect(record.type).toBe("category");
  });

  it("le nom est trimmé avant l'appel store", async () => {
    const created: string[] = [];
    const { target } = mountModal((name) => created.push(name));

    setInputValue(nameInput(target), "  Plats en sauce  ");
    submit(target);

    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme après la création",
      100,
      flushSync,
    );
    const [record] = await serverCategories();
    expect(record.name).toBe("Plats en sauce");
    expect(created).toEqual(["Plats en sauce"]);
  });
});

describe("CreateCategoryModal — validation et annulation", () => {
  beforeEach(resetState);
  afterEach(() => cleanupSvelte());

  it("le submit à vide affiche la validation et n'écrit rien", () => {
    const { target } = mountModal();

    submit(target);

    expect(target.textContent).toContain("Le nom est requis");
    expect(modalDialog(target)).not.toBeNull();
    expect(toastStub.success).not.toHaveBeenCalled();
  });

  it("un nom d'un seul caractère est refusé (borne 2 caractères)", () => {
    const { target } = mountModal();

    setInputValue(nameInput(target), "a");
    submit(target);

    expect(target.textContent).toContain(
      "Le nom doit contenir au moins 2 caractères",
    );
    expect(modalDialog(target)).not.toBeNull();
  });

  it("« Annuler » ferme sans créer", async () => {
    const { target } = mountModal();

    getByText(target, "button", "Annuler").click();
    await waitForCondition(
      () => modalDialog(target) === null,
      "la modale se ferme à l'annulation",
      100,
      flushSync,
    );
    expect(await serverCategories()).toHaveLength(0);
  });
});
