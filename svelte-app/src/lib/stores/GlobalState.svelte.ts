import { MediaQuery } from "svelte/reactivity";

import { toastService } from "../services/toast.service.svelte";
import {
  getCurrentUser,
  logout as pbLogout,
  onAuthChange,
  type PBAuthUser,
} from "../services/pb-auth";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { materielStore } from "./MaterielStore.svelte";
import { teamdocsStore } from "./TeamdocsStore.svelte";
import { productsStore } from "./ProductsStore.svelte";
import { eventMaterielStore } from "./EventMaterielStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import {
  db,
  pb,
  initRealtimeSignals,
  teardownRealtimeSignals,
} from "$lib/db-sync/pb-sync";
import { route } from "$lib/router";

/**
 * Marqueur localStorage de l'identité qui a produit le cache Dexie courant.
 * Sans lui, un résidu de session précédente (onglet fermé sans logout, token
 * expiré) survit aux transitions : le curseur syncMeta de l'ancienne identité
 * rend la delta sync muette au login et le fallback full-fetch est bloqué par
 * les lignes résiduelles (localCount > 0).
 */
const CACHE_OWNER_KEY = "enka-cache-owner";

class GlobalState {
  private isMobileQuery = new MediaQuery("max-width: 768px");
  private isDesktopQuery = new MediaQuery("min-width: 1024px");

  // =============================================================================
  // AUTHENTIFICATION
  // =============================================================================

  #user = $state<PBAuthUser | null>(null);
  #userTeams = $derived(nativeTeamsStore.myTeams.map((t) => t.id));
  #authLoading = $state(false);
  #authError = $state<string | null>(null);
  #authInitialized = $state(false);
  #userRealtimeUnsub: (() => void) | null = null;
  // Purge d'identité en vol — sérialise le watcher onAuthChange et les
  // appels explicites (boot, login) vers une seule purge.
  #identityPurge: Promise<void> | null = null;

  constructor() {
    // Consomme onAuthChange : toute transition d'identité (login modal,
    // inscription, magic link) re-scope le cache local. Idempotent — un
    // refresh de token (même identité) ne purge pas.
    onAuthChange((user) => {
      void this.#ensureCacheForIdentity(user?.id ?? null);
    });
  }

  get user() {
    return this.#user;
  }

  get userId() {
    return this.#user?.id ?? null;
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
        localStorage.setItem("enka-user-name", user.name);
        localStorage.setItem("enka-user-email", user.email);
        localStorage.setItem("enka-user-id", user.id);
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
      // Boot : purge des résidus d'une session précédente (visiteur ou autre
      // identité) — sans elle, le curseur d'un tiers rend la delta sync muette
      // au prochain login. Ne bloque pas le boot en cas d'échec IDB.
      await this.#ensureCacheForIdentity(this.#user?.id ?? null).catch((err) =>
        console.error("[GlobalState] Purge du cache au boot échouée:", err),
      );
      // Session existante au boot : signaux SSE vivants — c'est le chemin
      // dominant (reload avec session valide), sans eux « Connexion perdue »
      // n'apparaît jamais. Miroir du login : branchés ici, donc AVANT les
      // phases d'initializeApp (la première connexion SSE est consommée par
      // hasConnectedOnce) ; idempotent, le re-init du login est un no-op.
      if (this.#user) {
        await initRealtimeSignals();
      }
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

      localStorage.setItem("enka-user-name", user.name);
      localStorage.setItem("enka-user-email", user.email);
      localStorage.setItem("enka-user-id", user.id);

      // Ferme la course auth/stores : si le cache porte encore l'identité
      // précédente (résidu de session crashée), la purge AVANT les 3 phases
      // évite une delta sync muette (curseur étranger + fallback bloqué).
      await this.#ensureCacheForIdentity(user.id).catch((err) =>
        console.error("[GlobalState] Purge du cache au login échouée:", err),
      );

      // Signaux SSE (StatusBar + resync orchestrateur). Branchés AVANT la
      // souscription des stores : la première connexion SSE est consommée
      // ici (hasConnectedOnce) — tout PB_CONNECT ultérieur est une
      // reconnexion et déclenche le resync delta. (Au boot avec session
      // existante, initializeAuth les branche de la même façon.)
      await initRealtimeSignals();

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
        nativeTeamsStore.syncInitial(),
        eventsStore.syncInitial(),
        materielStore.syncInitial(),
        teamdocsStore.syncInitial(),
        recipesStore.syncInitial(),
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

      // Phase 3: Abonnement realtime custom (messages ciblés du backend)
      await this.#setupUserRealtime(user.id);

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
   * Abonne l'utilisateur aux messages SSE custom (topic "user_${userId}").
   * Permet au backend d'envoyer des notifications cibles :
   *   - team_joined : nouveau membre d'une team → refresh EventsStore
   *   - team_left   : membre retire d'une team → refresh EventsStore
   *   - team_updated : team renommee → refresh EventsStore
   */
  async #setupUserRealtime(userId: string): Promise<void> {
    // Nettoyer l'abonnement precedent si necessaire
    if (this.#userRealtimeUnsub) {
      this.#userRealtimeUnsub();
      this.#userRealtimeUnsub = null;
    }

    const topic = `user_${userId}`;

    try {
      this.#userRealtimeUnsub = await pb.realtime.subscribe(
        topic,
        async (e) => {
          const data = typeof e === "string" ? JSON.parse(e) : e;
          const action = data?.action || data?.record?.action;

          if (
            action === "team_joined" ||
            action === "team_left" ||
            action === "team_updated"
          ) {
            console.log(
              `[GlobalState] Realtime custom: ${action} — team ${data.teamName || data.teamId}`,
            );
            if (action === "team_joined") {
              // Élargissement de périmètre (audit delta-sync, classe A) :
              // le join d'équipe modifie `teams` seulement — les records
              // nouvellement autorisés (events, teamdocs, materiel, loans)
              // gardent leur `updated` antérieur au curseur : invisibles au
              // delta comme au SSE. Reset des curseurs AVANT resync — un
              // simple forceRefresh reproduit le trou P12.
              try {
                await eventsStore.resetCursorAndSync();
                await teamdocsStore.resetCursorAndSync();
                await materielStore.resetCursorAndSync();
              } catch (err) {
                console.error(
                  "[GlobalState] team_joined — resync post-join échoué:",
                  err,
                );
              }
            } else {
              // team_left (rétrécissement) / team_updated (pas d'impact
              // visibilité) : le delta suffit
              await eventsStore.forceRefresh();
            }
          }
        },
      );

      console.log(`[GlobalState] Abonne au topic custom: ${topic}`);
    } catch (err) {
      console.error("[GlobalState] Erreur abonnement realtime custom:", err);
    }
  }

  // =============================================================================
  // CACHE IDENTITY — re-scope du cache local aux transitions d'identité
  // =============================================================================

  #cacheOwner(): string | null {
    return localStorage.getItem(CACHE_OWNER_KEY);
  }

  /**
   * Re-scope le cache local (tables privées + curseurs delta) à l'identité
   * donnée ; no-op si le cache lui appartient déjà. Sérialisé : le watcher
   * onAuthChange et les appels explicites (boot, login, logout) convergent
   * vers une seule purge.
   */
  async #ensureCacheForIdentity(identity: string | null): Promise<void> {
    if (this.#cacheOwner() === identity) return;
    while (this.#identityPurge) {
      await this.#identityPurge;
      if (this.#cacheOwner() === identity) return;
    }
    const purge = this.#purgePrivateCaches(identity);
    this.#identityPurge = purge;
    try {
      await purge;
    } finally {
      if (this.#identityPurge === purge) this.#identityPurge = null;
    }
  }

  /**
   * Purge unique des caches liés à l'identité — logout délègue ici aussi
   * (exemplaire unique du destroy list). recipesStore est préservé : données
   * publiques, non scopées par identité. Le marqueur n'est écrit qu'après
   * succès : un échec IDB laisse le cache « sans propriétaire », la transition
   * suivante re-purge.
   */
  async #purgePrivateCaches(identity: string | null): Promise<void> {
    await nativeTeamsStore.destroy();
    await eventsStore.purgeLocal();
    await materielStore.purgeLocal();
    await eventMaterielStore.purgeLocal();
    await teamdocsStore.purgeLocal();
    await productsStore.softReset();
    await db.joinLinks.clear();
    if (identity === null) {
      localStorage.removeItem(CACHE_OWNER_KEY);
    } else {
      localStorage.setItem(CACHE_OWNER_KEY, identity);
    }
    console.log(
      `[GlobalState] Cache local re-scopé : ${identity ?? "visiteur"}`,
    );
  }

  /**
   * Déconnexion : cleanup PB + stores privés
   * PocketBase : pas de cache Appwrite ni de realtime centralisé à détruire
   */
  async logout(): Promise<void> {
    try {
      // Cleanup abonnement realtime custom
      if (this.#userRealtimeUnsub) {
        this.#userRealtimeUnsub();
        this.#userRealtimeUnsub = null;
      }

      // Cleanup signaux SSE — AVANT la destruction des stores : la
      // souscription PB_CONNECT est retirée en premier, l'autoclose final
      // du SDK (dernier unsubscribe des stores) se produit sans abonné
      // résiduel (pas d'EventSource zombie).
      await teardownRealtimeSignals();

      pbLogout();

      localStorage.removeItem("enka-user-name");
      localStorage.removeItem("enka-user-email");
      localStorage.removeItem("enka-user-id");

      // Même chemin que les autres transitions : purge des caches privés +
      // reset du marqueur d'identité (recipesStore préservé pour les
      // visiteurs — données publiques).
      await this.#ensureCacheForIdentity(null);

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

    const team = nativeTeamsStore.myTeams.find((t) => t.id === teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.id === this.#user!.id);
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

    const team = nativeTeamsStore.myTeams.find((t) => t.id === teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.id === this.#user!.id);
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
    return this.#user?.name || localStorage.getItem("enka-user-name") || "";
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
