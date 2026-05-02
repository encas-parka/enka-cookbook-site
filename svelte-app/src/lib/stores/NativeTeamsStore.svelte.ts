import { SvelteMap } from "svelte/reactivity";
import type {
  EnrichedNativeTeam,
  NativeTeamMember,
} from "$lib/types/aw_native_team.d";
import { toastService } from "$lib/services/toast.service.svelte";
import { globalState } from "./GlobalState.svelte";
import { pb, db } from "$lib/db-sync/pb-sync";

/**
 * Interface pour les préférences d'une équipe.
 * En PB, ces champs sont directement sur la collection `teams`
 * (description, city, isPublic) — on garde l'interface pour
 * compatibilité avec les composants existants.
 */
export interface TeamPrefs {
  description?: string;
  location?: string;
  city?: string;
  isPublic?: boolean;
}

/**
 * Transforme un record PB team (avec expand.members) en EnrichedNativeTeam.
 */
function enrichTeamFromPB(raw: Record<string, any>): EnrichedNativeTeam {
  const expandedMembers = raw.expand?.members;
  const memberArray = expandedMembers
    ? Array.isArray(expandedMembers)
      ? expandedMembers
      : [expandedMembers]
    : [];

  const roles: Record<string, string> = raw.roles || {};
  const createdBy = raw.createdBy || raw.expand?.createdBy?.id || null;

  return {
    $id: raw.id,
    name: raw.name || "",
    total: memberArray.length,
    $createdAt: raw.created || "",
    $updatedAt: raw.updated || "",
    prefs: {
      description: raw.description || "",
      location: raw.location || "",
      city: raw.city || "",
      isPublic: raw.isPublic || false,
    },
    description: raw.description || "",
    members: memberArray.map((user: Record<string, any>) => ({
      $id: user.id, // En PB, pas de membership ID → on utilise le user ID
      id: user.id,
      name: user.name || "",
      userEmail: user.email || "",
      roles: roles[user.id] ? [roles[user.id]] : ["member"],
      joinedAt: user.created || "",
      confirmed: true, // En PB, pas d'invitation pending
    })),
  };
}

export class NativeTeamsStore {
  // État réactif
  #teams = new SvelteMap<string, EnrichedNativeTeam>();
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #realtimeInitialized = false;
  #realtimeUnsubscribe: (() => void) | null = null;

  // Getters simples
  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }
  get isInitialized() {
    return this.#isInitialized;
  }
  get count() {
    return this.#teams.size;
  }

  // Propriétés réactives ($derived)
  #teamsList = $derived(Array.from(this.#teams.values()));
  get teams() {
    return this.#teamsList;
  }

  isUserInAnyTeam(userId: string): boolean {
    return Array.from(this.#teams.values()).some((t) =>
      t.members?.some((m) => m.id === userId),
    );
  }

  // Simplifié : utiliser directement #teamsList
  get myTeams() {
    if (!globalState.userId) return [];
    return this.#teamsList;
  }

  // =============================================================================
  // INITIALISATION
  // =============================================================================

  /**
   * Phase 1 : Charger les équipes depuis le cache IndexedDB
   */
  async loadCache(): Promise<void> {
    if (this.#isInitialized) return;

    if (!globalState.userId) {
      this.#isInitialized = true;
      return;
    }

    // Lire depuis Dexie
    const cached = await db.nativeTeams.toArray();
    for (const team of cached) {
      this.#teams.set(team.$id, team);
    }

    this.#isInitialized = true;
    console.log(`[NativeTeamsStore] Cache chargé : ${cached.length} équipes`);
  }

  /**
   * Phase 2 : Charge les équipes depuis PocketBase
   */
  async syncFromRemote(): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        return;
      }

      await this.#loadTeams();

      console.log(
        `[NativeTeamsStore] Sync terminé : ${this.#teams.size} équipes`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de synchronisation";
      console.error("[NativeTeamsStore] SyncFromRemote error:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 3 : Configure les abonnements realtime via PB SSE
   */
  async setupRealtime(): Promise<void> {
    if (!globalState.isAuthenticated) {
      return;
    }

    if (this.#realtimeInitialized) {
      console.log("[NativeTeamsStore] Realtime déjà configuré");
      return;
    }

    try {
      await this.#setupRealtimeInternal();
      this.#realtimeInitialized = true;
      console.log("[NativeTeamsStore] Realtime configuré");
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de configuration realtime";
      console.error("[NativeTeamsStore] SetupRealtime error:", err);
      throw err;
    }
  }

  /**
   * Initialise les 3 phases séquentiellement
   */
  async initialize(): Promise<void> {
    await this.loadCache();
    await this.syncFromRemote();
    await this.setupRealtime();
  }

  /**
   * Réinitialise complètement le store (vidange + rechargement)
   */
  async hardReset(): Promise<void> {
    console.log("[NativeTeamsStore] Hard reset...");

    this.#teams.clear();
    this.#isInitialized = false;

    await this.initialize();

    console.log("[NativeTeamsStore] Hard reset terminé");
  }

  // =============================================================================
  // CHARGEMENT DES DONNÉES
  // =============================================================================

  async #loadTeams(): Promise<void> {
    const userId = globalState.userId;
    if (!userId) return;

    // Récupérer toutes les teams dont l'utilisateur est membre
    const teams = await pb.collection("teams").getFullList({
      expand: "members,createdBy",
      filter: pb.filter("members ?= {:userId}", { userId }),
    });

    // Vider les teams obsolètes
    const currentIds = new Set(teams.map((t) => t.id));
    for (const id of this.#teams.keys()) {
      if (!currentIds.has(id)) {
        this.#teams.delete(id);
      }
    }

    // Enrichir et stocker
    for (const rawTeam of teams) {
      const enriched = enrichTeamFromPB(rawTeam);
      this.#teams.set(rawTeam.id, enriched);
      await db.nativeTeams.put(enriched);
    }
  }

  async #setupRealtimeInternal(): Promise<void> {
    // Nettoyer l'abonnement précédent si nécessaire
    if (this.#realtimeUnsubscribe) {
      this.#realtimeUnsubscribe();
      this.#realtimeUnsubscribe = null;
    }

    // S'abonner aux changements sur la collection teams
    // PB SSE : les API rules filtrent déjà les teams visibles
    this.#realtimeUnsubscribe = await pb
      .collection("teams")
      .subscribe("*", async (e) => {
        console.log(
          "[NativeTeamsStore] ⚡️ Realtime event:",
          e.action,
          e.record?.id,
        );

        // Refresh complet pour simplifier (les relations members rendent
        // la mise à jour incrémentale risquée)
        await this.#loadTeams();
      });
  }

  // =============================================================================
  // API PUBLIQUE
  // =============================================================================

  getTeamById(teamId: string): EnrichedNativeTeam | undefined {
    return this.#teams.get(teamId);
  }

  /**
   * Retourne la liste des usernames des membres d'une team
   */
  getTeamMemberNames(teamId: string): string[] {
    const team = this.#teams.get(teamId);
    if (!team || !team.members) return [];
    return team.members
      .map((m) => {
        if (m.name) return m.name;
        if (m.userEmail) return m.userEmail.split("@")[0];
        return "Inconnu";
      })
      .filter(Boolean);
  }

  async fetchTeam(teamId: string): Promise<EnrichedNativeTeam | null> {
    try {
      const rawTeam = await pb.collection("teams").getOne(teamId, {
        expand: "members,createdBy",
      });

      const enriched = enrichTeamFromPB(rawTeam);
      this.#teams.set(teamId, enriched);
      await db.nativeTeams.put(enriched);
      return enriched;
    } catch (err) {
      console.error(`[NativeTeamsStore] Error fetching team ${teamId}:`, err);
      return null;
    }
  }

  async createTeam(
    name: string,
    prefs?: TeamPrefs,
  ): Promise<EnrichedNativeTeam> {
    const userId = globalState.userId;
    if (!userId) throw new Error("Utilisateur non connecté");

    const rawTeam = await pb.collection("teams").create({
      name,
      members: [userId],
      createdBy: userId,
      roles: { [userId]: "owner" },
      description: prefs?.description || "",
      city: prefs?.city || "",
      isPublic: prefs?.isPublic || false,
    });

    // Re-fetch avec expand pour avoir les membres enrichis
    const enriched = await this.fetchTeam(rawTeam.id);
    if (!enriched) throw new Error("Erreur après création d'équipe");
    return enriched;
  }

  async updateTeam(
    teamId: string,
    name?: string,
    prefs?: TeamPrefs,
  ): Promise<void> {
    const data: Record<string, any> = {};
    if (name) data.name = name;
    if (prefs) {
      if (prefs.description !== undefined) data.description = prefs.description;
      if (prefs.city !== undefined) data.city = prefs.city;
      if (prefs.isPublic !== undefined) data.isPublic = prefs.isPublic;
    }

    if (Object.keys(data).length > 0) {
      await pb.collection("teams").update(teamId, data);
    }

    await this.fetchTeam(teamId);
  }

  async deleteTeam(teamId: string): Promise<void> {
    await pb.collection("teams").delete(teamId);
    this.#teams.delete(teamId);
    await db.nativeTeams.delete(teamId);
  }

  /**
   * Invite des membres par email.
   *
   * NOTE : En PB, l'invitation par email nécessite un hook PB ou un mécanisme
   * externe. Pour l'instant, cette méthode est un stub qui log l'action.
   * L'ajout direct de membres (via userId) fonctionne via addMember().
   * Le système d'invitations complet sera implémenté dans le Lot F-3.
   */
  async inviteTeamMember(
    teamId: string,
    emails: string[],
    _message?: string,
  ): Promise<void> {
    // TODO: Lot F-3 — implémenter les invitations via PB hooks ou service externe
    console.warn(
      `[NativeTeamsStore] inviteTeamMember: stub — emails=${emails.join(", ")}, teamId=${teamId}. En attente du Lot F-3.`,
    );
    toastService.info(
      "L'invitation par email sera disponible prochainement (migration en cours).",
    );
  }

  /**
   * Retire un membre d'une team.
   * En PB, le paramètre est le userId (pas un membershipId).
   * L'interface utilise encore le nom `membershipId` pour compatibilité.
   */
  async removeMember(teamId: string, membershipId: string): Promise<void> {
    // membershipId = userId en PB
    const rawTeam = await pb.collection("teams").getOne(teamId);
    const currentMembers: string[] = rawTeam.members || [];
    const updatedMembers = currentMembers.filter((id) => id !== membershipId);

    // Retirer aussi du roles
    const roles: Record<string, string> = rawTeam.roles || {};
    delete roles[membershipId];

    await pb.collection("teams").update(teamId, {
      members: updatedMembers,
      roles,
    });

    await this.fetchTeam(teamId);
  }

  /**
   * Met à jour le rôle d'un membre.
   * En PB, le paramètre membershipId est le userId.
   * Le rôle est stocké dans le champ JSON `roles` de la team.
   */
  async updateMemberRole(
    teamId: string,
    membershipId: string,
    role: "owner" | "member",
  ): Promise<void> {
    const rawTeam = await pb.collection("teams").getOne(teamId);
    const roles: Record<string, string> = rawTeam.roles || {};
    roles[membershipId] = role;

    await pb.collection("teams").update(teamId, { roles });
    await this.fetchTeam(teamId);
  }

  async reload(): Promise<void> {
    this.#loading = true;
    try {
      this.#teams.clear();
      await this.#loadTeams();
    } finally {
      this.#loading = false;
    }
  }

  async destroy(): Promise<void> {
    // Unsubscribe PB realtime
    if (this.#realtimeUnsubscribe) {
      this.#realtimeUnsubscribe();
      this.#realtimeUnsubscribe = null;
    }
    this.#teams.clear();
    await db.nativeTeams.clear();
    this.#isInitialized = false;
    this.#realtimeInitialized = false;
  }
}

export const nativeTeamsStore = new NativeTeamsStore();
