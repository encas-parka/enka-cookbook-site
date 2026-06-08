/**
 * UpdateStore — gère la détection et l'application des mises à jour SW.
 *
 * Flux :
 * 1. main.ts appelle signalUpdateAvailable() quand un SW passe en "waiting"
 * 2. fetchChangelog() récupère le changelog depuis version.json
 * 3. updateAvailable passe à true → le modal s'ouvre
 * 4. Quand le modal est fermé → applyUpdate()
 *    → listener controllerchange branché PUIS SKIP_WAITING envoyé
 *    → controllerchange → window.location.reload()
 */

interface VersionEntry {
  version: string;
  date: string;
  changes: string[];
}

interface VersionFile {
  versions: VersionEntry[];
}

/**
 * Seuil pour le check SW sur visibilitychange. 4h = bon compromis entre
 * réactivité et limitation des requêtes inutiles.
 */
const SW_CHECK_THRESHOLD_MS = 4 * 60 * 60_000;

class UpdateStore {
  updateAvailable = $state(false);
  changelog: VersionEntry[] = $state([]);
  #registration: ServiceWorkerRegistration | null = null;
  #isApplying = false;

  /**
   * Stocke la registration SW pour pouvoir l'utiliser lors de applyUpdate.
   * Appelé par main.ts après l'enregistrement du SW.
   */
  setRegistration(reg: ServiceWorkerRegistration): void {
    this.#registration = reg;
  }

  /**
   * Lance un check SW si la durée cachée dépasse le seuil.
   * Appelé par handleVisibilityChange dans main.ts.
   */
  checkForUpdate(hiddenDuration: number): void {
    if (hiddenDuration >= SW_CHECK_THRESHOLD_MS && this.#registration) {
      this.#registration.update().catch(() => {});
    }
  }

  /**
   * Appelé par main.ts quand un SW atteint l'état "installed"/"waiting".
   * Fetch le changelog puis signale la mise à jour disponible.
   * Idempotente : ne fait rien si déjà signalé.
   */
  async signalUpdateAvailable(): Promise<void> {
    if (this.updateAvailable) return;
    await this.fetchChangelog();
    this.updateAvailable = true;
  }

  /**
   * Fetch version.json et compare avec __APP_VERSION__.
   * Stocke le changelog en mémoire si une nouvelle version est détectée.
   * En cas d'échec du fetch, prépare un changelog générique.
   */
  async fetchChangelog(): Promise<void> {
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const response = await fetch(`${baseUrl}version.json`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: VersionFile = await response.json();
      if (!Array.isArray(data?.versions)) {
        throw new Error("Format version.json invalide");
      }

      const currentVersion = __APP_VERSION__;

      // Les versions sont ordonnées décroissant (plus récente en premier).
      // On garde tout ce qui précède la version courante (= versions plus récentes).
      const idx = data.versions.findIndex(
        (v) => v.version === currentVersion,
      );
      this.changelog = idx > 0 ? data.versions.slice(0, idx) : [];

      // Si aucune version plus récente n'est trouvée (idx = 0 ou -1),
      // on affiche un message générique (le SW est en waiting donc il y
      // a bien une mise à jour, version.json n'est juste pas à jour).
      if (this.changelog.length === 0) {
        this.changelog = [
          {
            version: "",
            date: "",
            changes: ["Une nouvelle version est disponible."],
          },
        ];
      }
    } catch {
      // Fetch ou parsing échoué → changelog générique
      this.changelog = [
        {
          version: "",
          date: "",
          changes: ["Une nouvelle version est disponible."],
        },
      ];
    }
  }

  /**
   * Applique la mise à jour : branche le listener controllerchange
   * PUIS envoie SKIP_WAITING au SW en attente.
   * L'ordre est crucial pour éviter que le SW ne s'active avant
   * que le listener ne soit en place.
   *
   * Un timeout de 10s agit comme fallback de sécurité : si
   * controllerchange ne se déclenche pas, on reload quand même.
   */
  applyUpdate(): void {
    if (this.#isApplying) return;
    this.#isApplying = true;

    const reg = this.#registration;
    if (!reg) {
      console.warn("[SW] Pas de registration, rechargement direct");
      window.location.reload();
      return;
    }

    // Timeout de sécurité : si controllerchange ne se déclenche pas
    // dans les 10s, on reload quand même (SW peut être dans un état inattendu).
    const timeoutId = setTimeout(() => {
      console.warn("[SW] controllerchange timeout — rechargement direct");
      window.location.reload();
    }, 10_000);

    // 1. Brancher le listener AVANT d'envoyer SKIP_WAITING
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timeoutId);
        console.log("[SW] Nouvelle version activée — rechargement");
        window.location.reload();
      },
      { once: true },
    );

    // 2. Envoyer SKIP_WAITING au SW en attente
    const waiting = reg.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      clearTimeout(timeoutId);
      console.warn("[SW] Pas de SW en waiting, rechargement direct");
      window.location.reload();
    }
  }
}

export const updateStore = new UpdateStore();
export type { VersionEntry };
