import { MediaQuery } from "svelte/reactivity";
import { scrollY } from "svelte/reactivity/window";

import { toastService } from "../services/toast.service.svelte";
import { getAppwriteInstances, clearAppwriteCache } from "../services/appwrite";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { materielStore } from "./MaterielStore.svelte";
import { teamdocsStore } from "./TeamdocsStore.svelte";
import { notificationStore } from "./NotificationStore.svelte";
import { realtimeManager } from "./RealtimeManager.svelte";
import type { Models } from "appwrite";
import { route } from "$lib/router";

class GlobalState {
  private isMobileQuery = new MediaQuery("max-width: 768px");
  private isDesktopQuery = new MediaQuery("min-width: 1024px");

  // =============================================================================
  // AUTHENTIFICATION
  // =============================================================================

  #user = $state<Models.User<Models.Preferences> | null>(null);
  #userTeams = $state<string[]>([]);
  #authLoading = $state(false);
  #authError = $state<string | null>(null);
  #authInitialized = $state(false);

  get user() {
    return this.#user;
  }

  get userId() {
    return this.#user?.$id ?? null;
  }

  get userEmail() {
    return this.#user?.email ?? null;
  }

  get userTeams() {
    return this.#userTeams;
  }

  get isAuthenticated() {
    return this.#user !== null;
  }

  get authLoading() {
    return this.#authLoading;
  }

  get authError() {
    return this.#authError;
  }

  get authInitialized() {
    return this.#authInitialized;
  }

  /**
   * Initialise l'authentification
   * Récupère l'utilisateur connecté et ses équipes
   */
  async initializeAuth(): Promise<void> {
    if (this.#authInitialized) {
      console.log("[GlobalState] Authentification déjà initialisée");
      return;
    }

    console.log("[GlobalState] Initialisation de l'authentification...");
    this.#authLoading = true;
    this.#authError = null;

    try {
      // Récupérer l'utilisateur connecté
      const { account } = await getAppwriteInstances();
      this.#user = await account.get();

      // LEGACY
      localStorage.setItem("appwrite-user-name", this.#user.name);
      localStorage.setItem("appwrite-user-email", this.#user.email);
      localStorage.setItem("appwrite-user-id", this.#user.$id);

      // Initialiser NativeTeamsStore AVANT de récupérer les équipes
      await nativeTeamsStore.initialize();

      // Récupérer les équipes depuis NativeTeamsStore
      this.#userTeams = nativeTeamsStore.myTeams.map((t) => t.$id);

      console.log(
        `[GlobalState] Authentifié: ${this.#user.name} (${this.#userTeams.length} équipes)`,
      );
    } catch (error) {
      // Pas connecté ou erreur
      this.#user = null;
      this.#userTeams = [];
      this.#authError =
        error instanceof Error ? error.message : "Erreur d'authentification";

      console.log("[GlobalState] Utilisateur non connecté");
    } finally {
      this.#authLoading = false;
      this.#authInitialized = true; // ✅ Toujours marquer comme initialisé
    }
  }

  /**
   * Réinitialise l'authentification après un login/inscription réussie
   * Force la mise à jour de l'état utilisateur et des équipes
   * Réinitialise tous les stores utilisateur avec les credentials authentifiés
   */
  async refreshAuthAfterLogin(): Promise<void> {
    console.log("[GlobalState] Réinitialisation après login...");
    this.#authLoading = true;
    this.#authError = null;

    try {
      // Récupérer le nouvel utilisateur connecté
      const { account } = await getAppwriteInstances();
      this.#user = await account.get();

      // Mettre à jour localStorage
      localStorage.setItem("appwrite-user-name", this.#user.name);
      localStorage.setItem("appwrite-user-email", this.#user.email);
      localStorage.setItem("appwrite-user-id", this.#user.$id);

      // ✅ RÉINITIALISER TOUS LES STORES UTILISATEURS

      // 1. NativeTeamsStore (équipes natives)
      await nativeTeamsStore.initialize();

      // 2. EventsStore (événements utilisateur)
      await eventsStore.syncFromRemote();
      await eventsStore.setupRealtime();

      // 3. MaterielStore (matériel et emprunts)
      await materielStore.syncFromRemote();
      await materielStore.setupRealtime();

      // 4. TeamdocsStore (documents d'équipe)
      await teamdocsStore.syncFromRemote();
      await teamdocsStore.setupRealtime();

      // 5. NotificationStore (lazy init + realtime notifications)
      await notificationStore.initialize();

      // 6. RealtimeManager (WebSocket central pour tous les stores)
      await realtimeManager.initialize();

      // 7. Récupérer les équipes depuis NativeTeamsStore
      this.#userTeams = nativeTeamsStore.myTeams.map((t) => t.$id);

      console.log(
        `[GlobalState] Réinitialisé après login: ${this.#user.name} (${this.#userTeams.length} équipes)`,
      );
    } catch (error) {
      console.error("[GlobalState] Erreur lors de la réinitialisation:", error);
      this.#authError =
        error instanceof Error ? error.message : "Erreur de réinitialisation";
    } finally {
      this.#authLoading = false;
    }
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    try {
      // Déconnexion Appwrite (supprime toutes les sessions)
      const { account } = await getAppwriteInstances();
      await account.deleteSession({ sessionId: "current" });

      // Nettoyer le cache Appwrite
      clearAppwriteCache();

      // @LEGACY : Nettoyer localStorage
      localStorage.removeItem("appwrite-user-name");
      localStorage.removeItem("appwrite-user-email");
      localStorage.removeItem("appwrite-user-id");

      // Réinitialiser l'état
      this.#user = null;
      this.#userTeams = [];
      this.#authInitialized = false;

      console.log("[GlobalState] Déconnexion réussie");
    } catch (error) {
      console.error("[GlobalState] Erreur lors de la déconnexion:", error);
      throw error;
    }
  }

  /**
   * Rafraîchit les équipes de l'utilisateur
   * Utile après l'initialisation complète d'Appwrite
   */
  async refreshTeams(): Promise<void> {
    if (!this.#user) {
      console.warn(
        "[GlobalState] Impossible de rafraîchir les équipes: utilisateur non connecté",
      );
      return;
    }

    try {
      // Forcer la synchronisation depuis Appwrite
      await nativeTeamsStore.syncFromRemote();

      // Récupérer les équipes depuis NativeTeamsStore
      const teams = nativeTeamsStore.myTeams.map((t) => t.$id);

      // Mettre à jour seulement si on a récupéré des équipes
      // ou si c'était vide avant (cas d'initialisation)
      if (teams.length > 0 || this.#userTeams.length === 0) {
        this.#userTeams = teams;
        console.log(
          `[GlobalState] Équipes rafraîchies: ${this.#userTeams.length}`,
        );
      }
    } catch (error) {
      console.error(
        "[GlobalState] Erreur lors du rafraîchissement des équipes:",
        error,
      );
    }
  }

  /**
   * Vérifie si l'utilisateur courant est owner d'une équipe spécifique
   * @param teamId - L'ID de l'équipe à vérifier
   * @returns true si l'utilisateur a le rôle "owner" pour cette équipe
   */
  isTeamOwner(teamId: string): boolean {
    if (!this.#user) return false;

    const team = nativeTeamsStore.myTeams.find((t) => t.$id === teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.id === this.#user!.$id);
    return member?.roles?.includes("owner") ?? false;
  }

  /**
   * Vérifie si l'utilisateur courant a un rôle spécifique pour une équipe
   * @param teamId - L'ID de l'équipe à vérifier
   * @param role - Le rôle à vérifier (ex: "owner", "member")
   * @returns true si l'utilisateur a ce rôle pour cette équipe
   */
  hasTeamRole(teamId: string, role: string): boolean {
    if (!this.#user) return false;

    const team = nativeTeamsStore.myTeams.find((t) => t.$id === teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.id === this.#user!.$id);
    return member?.roles?.includes(role) ?? false;
  }

  // =============================================================================
  // CURRENT EVENT CONTEXT
  // =============================================================================

  #currentMainId = $derived.by(() => {
    const path = route.pathname;
    const mainId = route.params.id;

    // Vérifier si on est sur une route produits
    if (path.includes("/event/") && mainId) {
      console.log(`[GlobalState] ✅ currentMainId dérivé: ${mainId}`);
      return mainId;
    }

    console.log(
      `[GlobalState] ⚠️ Pas de mainId: path=${path}, params.id=${mainId}`,
    );
    return null;
  });

  get currentMainId() {
    return this.#currentMainId;
  }

  // =============================================================================
  // UI STATE
  // =============================================================================

  get isMobile() {
    return this.isMobileQuery.current;
  }

  get isDesktop() {
    return this.isDesktopQuery.current;
  }

  // =============================================================================
  // SMART HEADER STATE (Mobile only)
  // =============================================================================

  #lastScrollY = $state(0);
  #headerVisible = $state(true);
  #scrollDirection = $state<"up" | "down">("down");

  get headerVisible() {
    return this.#headerVisible;
  }

  get scrollDirection() {
    return this.#scrollDirection;
  }

  /**
   * Initialise la détection de scroll pour le smart header
   * Seulement actif sur mobile
   * Expose aussi la direction du scroll pour tous les composants
   */
  initializeScrollDirection() {
    $effect(() => {
      const currentScroll = scrollY.current ?? 0;

      // Calcul de la direction du scroll
      if (currentScroll > this.#lastScrollY) {
        this.#scrollDirection = "down";
      } else if (currentScroll < this.#lastScrollY) {
        this.#scrollDirection = "up";
      }

      // Ne rien faire sur desktop pour le header
      if (this.isDesktop) {
        this.#headerVisible = true;
        this.#lastScrollY = currentScroll;
        return;
      }

      // Scroll down et au-delà de 100px → cacher le header (mobile only)
      if (currentScroll > this.#lastScrollY && currentScroll > 100) {
        this.#headerVisible = false;
      }
      // Scroll up → montrer le header (mobile only)
      else if (currentScroll < this.#lastScrollY) {
        this.#headerVisible = true;
      }

      // Mettre à jour la dernière position
      this.#lastScrollY = currentScroll;
    });
  }

  get userName() {
    // Utiliser le user authentifié si disponible, sinon localStorage
    return this.#user?.name || localStorage.getItem("appwrite-user-name") || "";
  }

  /** Accès aux toasts */
  get toasts() {
    return toastService.toasts;
  }

  /** Accès direct au service de toast */
  get toast() {
    return toastService;
  }

  modalOverride = $state({
    isOpen: false,
    conflicts: [],
  });

  modal = $state({
    isOpen: false,
  });

  backgroundOperation = $state({
    isRunning: false,
    name: "",
    progress: 0,
  });

  authModal = $state({ isOpen: false, showLogin: true });
}

export const globalState = new GlobalState();

// =============================================================================
// HOVER HELP STATE
// =============================================================================

/**
 * État partagé pour les messages d'aide au survol
 * Singleton pour partager le même état entre tous les composants
 */
export class HoverHelp {
  msg = $state("survolez des élément pour obtenir de l'aide");
  isExpanded = $state(true);

  get help() {
    return this.msg;
  }

  set help(val) {
    this.msg = val;
  }

  reset = () => {
    this.msg = "survolez des élément pour obtenir de l'aide";
  };

  toggle = () => {
    this.isExpanded = !this.isExpanded;
  };

  expand = () => {
    this.isExpanded = true;
  };

  collapse = () => {
    this.isExpanded = false;
  };
}

export const hoverHelp = new HoverHelp();
