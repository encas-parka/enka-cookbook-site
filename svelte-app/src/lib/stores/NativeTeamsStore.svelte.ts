import { SvelteMap } from "svelte/reactivity";
import type { Models } from "appwrite";
import type {
  EnrichedNativeTeam,
  NativeTeamMember,
  InviteResult,
  AsyncInviteResult,
} from "$lib/types/aw_native_team.d";
import { toastService } from "$lib/services/toast.service.svelte";
import {
  listUserTeams,
  getTeam,
  createTeam as createNativeTeam,
  updateTeam as updateNativeTeam,
  deleteTeam as deleteNativeTeam,
  listMembers,
  removeMember,
  inviteMembers,
  updateTeamPrefs,
  updateMembershipRoles,
  type TeamPrefs,
} from "@/lib/services/appwrite-native-teams";
import { globalState } from "./GlobalState.svelte";
import {
  registerRealtime,
  unregisterRealtime,
  isRealtimeInitialized,
  db,
} from "$lib/db-sync/aw-sync";

export class NativeTeamsStore {
  // État réactif
  #teams = new SvelteMap<string, EnrichedNativeTeam>();
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #realtimeInitialized = false;

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
   * Phase 2 : Charge les équipes depuis Appwrite
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
   * Phase 3 : Configure les abonnements realtime
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
   * Initialise les 3 phases séquentiellement (méthode legacy pour compatibilité)
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

    // Vider l'état
    this.#teams.clear();
    this.#isInitialized = false;

    // Recharger depuis Appwrite
    await this.initialize();

    console.log("[NativeTeamsStore] Hard reset terminé");
  }

  async #loadTeams(): Promise<void> {
    const response = await listUserTeams();
    for (const team of response.teams) {
      await this.fetchTeam(team.$id);
    }
  }

  async #setupRealtimeInternal(): Promise<void> {
    registerRealtime(
      "native-teams",
      ["teams", "memberships"],
      async (response: any) => {
        console.log(
          "[NativeTeamsStore] ⚡️ Realtime RECEIVED:",
          response.events,
        );
        await this.#loadTeams();
      },
    );
  }

  // =============================================================================
  // API PUBLIQUE
  // =============================================================================

  getTeamById(teamId: string): EnrichedNativeTeam | undefined {
    return this.#teams.get(teamId);
  }

  /**
   * Retourne la liste des usernames des membres d'une team
   * @param teamId - ID de la team
   * @returns string[] - Liste des noms des membres
   */
  getTeamMemberNames(teamId: string): string[] {
    const team = this.#teams.get(teamId);
    if (!team || !team.members) return [];
    return team.members
      .map((m) => {
        // Priorité: name > partie avant le @ de l'email > "Inconnu"
        if (m.name) return m.name;
        if (m.userEmail) return m.userEmail.split("@")[0];
        return "Inconnu";
      })
      .filter(Boolean);
  }

  async fetchTeam(teamId: string): Promise<EnrichedNativeTeam | null> {
    try {
      const team = await getTeam(teamId);
      const memberships = await listMembers(teamId);

      const enriched: EnrichedNativeTeam = {
        $id: team.$id,
        name: team.name,
        total: team.total,
        $createdAt: team.$createdAt,
        $updatedAt: team.$updatedAt,
        prefs: team.prefs,
        members: memberships.memberships.map((m) => ({
          $id: m.$id,
          id: m.userId,
          name: m.userName,
          userEmail: m.userEmail,
          roles: m.roles,
          joinedAt: m.joined,
          confirmed: m.confirm,
        })),
      };

      this.#teams.set(teamId, enriched);
      // Write-through vers Dexie
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
    const team = await createNativeTeam(name);
    if (prefs && Object.keys(prefs).length > 0) {
      await updateTeamPrefs(team.$id, prefs);
    }
    const enriched = await this.fetchTeam(team.$id);
    if (!enriched) throw new Error("Erreur après création d'équipe");
    return enriched;
  }

  async updateTeam(
    teamId: string,
    name?: string,
    prefs?: TeamPrefs,
  ): Promise<void> {
    if (name) await updateNativeTeam(teamId, name);
    if (prefs && Object.keys(prefs).length > 0) {
      await updateTeamPrefs(teamId, prefs);
    }
    await this.fetchTeam(teamId);
  }

  async deleteTeam(teamId: string): Promise<void> {
    await deleteNativeTeam(teamId);
    this.#teams.delete(teamId);
    await db.nativeTeams.delete(teamId);
  }

  async inviteTeamMember(
    teamId: string,
    emails: string[],
    message?: string,
  ): Promise<void> {
    const result = await inviteMembers(teamId, emails, message);

    // ✅ La fonction est maintenant async, le reload se fera via realtime
    // Ne pas faire await this.fetchTeam() immédiatement
    // Les membres apparaîtront automatiquement via realtime
  }

  async removeMember(teamId: string, membershipId: string): Promise<void> {
    await removeMember(teamId, membershipId);
    await this.fetchTeam(teamId);
  }

  async updateMemberRole(
    teamId: string,
    membershipId: string,
    role: "owner" | "member",
  ): Promise<void> {
    await updateMembershipRoles(teamId, membershipId, [role]);
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
    unregisterRealtime("native-teams");
    this.#teams.clear();
    await db.nativeTeams.clear();
    this.#isInitialized = false;
    this.#realtimeInitialized = false;
  }
}

export const nativeTeamsStore = new NativeTeamsStore();
