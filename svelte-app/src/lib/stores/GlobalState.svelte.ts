import { MediaQuery } from "svelte/reactivity";

import { toastService } from "../services/toast.service.svelte";
import { getCurrentUser, logout as pbLogout, type PBAuthUser } from "../services/pb-auth";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { materielStore } from "./MaterielStore.svelte";
import { teamdocsStore } from "./TeamdocsStore.svelte";
import { productsStore } from "./ProductsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import { db } from "$lib/db-sync/pb-sync";
import { route } from "$lib/router";

class GlobalState {
  private isMobileQuery = new MediaQuery("max-width: 768px");
  private isDesktopQuery = new MediaQuery("min-width: 1024px");

  // =============================================================================
  // AUTHENTIFICATION
  // =============================================================================

  #user = $state<PBAuthUser | null>(null);
  #userTeams = $derived(nativeTeamsStore.myTeams.map((t) => t.$id));
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
   * Récupère uniquement l'utilisateur connecté (pas les stores)
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
      const user = getCurrentUser();
      if (user) {
        this.#user = user;
        localStorage.setItem("appwrite-user-name", user.name);
        localStorage.setItem("appwrite-user-email", user.email);
        localStorage.setItem("appwrite-user-id", user.$id);
        console.log(`[GlobalState] Authentifié: ${user.name}`);
      } else {
        this.#user = null;
        console.log("[GlobalState] Utilisateur non connecté");
      }
    } catch (error) {
      this.#user = null;
      this.#authError =
        error instanceof Error ? error.message : "Erreur d'authentification";

      console.log("[GlobalState] Utilisateur non connecté");
    } finally {
      this.#authLoading = false;
      this.#authInitialized = true;
    }
  }

  /**
   * Réinitialise l'authentification après un login/inscription réussie
   * Set l'utilisateur + synchronise tous les stores
   * PocketBase : chaque store gère son propre realtime (pas de registry centralisé)
   */
  async refreshAuthAfterLogin(): Promise<void> {
    console.log("[GlobalState] Réinitialisation après login...");
    this.#authLoading = true;
    this.#authError = null;

    try {
      const user = getCurrentUser();
      if (!user) throw new Error("Aucun utilisateur après login");
      this.#user = user;

      localStorage.setItem("appwrite-user-name", user.name);
      localStorage.setItem("appwrite-user-email", user.email);
      localStorage.setItem("appwrite-user-id", user.$id);

      // Phase 0: Initialiser le cache IDB pour les stores qui en dépendent
      await Promise.all([
        eventsStore.loadCache(),
        recipesStore.loadCache(),
        materielStore.loadCache(),
        teamdocsStore.loadCache(),
        nativeTeamsStore.loadCache(),
      ]);

      // Phase 1: Sync de TOUS les stores en parallèle
      await Promise.all([
        nativeTeamsStore.syncFromRemote(),
        eventsStore.syncFromRemote(),
        materielStore.syncFromRemote(),
        teamdocsStore.syncFromRemote(),
        recipesStore.syncFromRemote(),

      ]);

      // Phase 2: Setup realtime pour TOUS les stores
      // (chaque store gère son propre realtime via pb.collection().subscribe())
      await Promise.all([
        nativeTeamsStore.setupRealtime(),
        eventsStore.setupRealtime(),
        materielStore.setupRealtime(),
        teamdocsStore.setupRealtime(),
        recipesStore.setupRealtime(),
      ]);

      console.log(
        `[GlobalState] Réinitialisé après login: ${user.name} (${this.userTeams.length} équipes)`,
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
   * Déconnexion : cleanup PB + stores privés
   * PocketBase : pas de cache Appwrite ni de realtime centralisé à détruire
   */
  async logout(): Promise<void> {
    try {
      pbLogout();

      localStorage.removeItem("appwrite-user-name");
      localStorage.removeItem("appwrite-user-email");
      localStorage.removeItem("appwrite-user-id");

      // Cleanup des stores privés (recipesStore préservé pour les visiteurs)
      // Les destroy() sont async car ils nettoient IndexedDB (sécurité multi-user)
      await nativeTeamsStore.destroy();
      await eventsStore.destroy();
      await materielStore.destroy();
      await teamdocsStore.destroy();
      await productsStore.destroy();

      // Nettoyer le cache des liens d'invitation
      await db.joinLinks.clear();

      this.#user = null;
      this.#authInitialized = false;

      console.log("[GlobalState] Déconnexion réussie");
    } catch (error) {
      console.error("[GlobalState] Erreur lors de la déconnexion:", error);
      throw error;
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

  #lastScrollY = 0;
  #headerVisible = $state(true);
  #scrollDirection = $state<"up" | "down">("down");
  #scrollHandler: (() => void) | null = null;

  get headerVisible() {
    return this.#headerVisible;
  }

  get scrollDirection() {
    return this.#scrollDirection;
  }

  /**
   * Initialise la détection de scroll pour le smart header
   * Utilise un event listener natif car scrollY de svelte/reactivity/window
   * ne se met pas à jour après les navigations côté client (bug Svelte 5 #17412)
   */
  initializeScrollDirection() {
    // Éviter les doublons
    if (this.#scrollHandler) return;

    this.#scrollHandler = () => {
      const currentScroll = window.scrollY ?? 0;

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
    };

    window.addEventListener("scroll", this.#scrollHandler, { passive: true });
  }

  /**
   * Nettoie l'event listener de détection de scroll
   */
  destroyScrollDirection() {
    if (this.#scrollHandler) {
      window.removeEventListener("scroll", this.#scrollHandler);
      this.#scrollHandler = null;
    }
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
