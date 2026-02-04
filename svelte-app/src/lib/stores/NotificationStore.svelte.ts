/**
 * NotificationStore - Gestion centralisée des notifications utilisateur/événement
 *
 * Nouvelle architecture (2025-01-27 refactor) :
 * - Une collection unique avec champ "scope" (user | event)
 * - Scope "user" : une row par utilisateur pour les notifications individuelles
 * - Scope "event" : une row par événement pour les notifications de groupe
 * - Lazy initialization : la row utilisateur est créée à la première connexion
 * - Notifications JSON-stringified dans le champ "notifications"
 *
 * Flux realtime :
 * - Abonnement unique à la collection user_notifications
 * - Filtrage par scope (user = rowId = userId, event = rowId = mainId)
 * - Traitement des notifications sans vidage (la stratégie last-win côté cloud écrase automatiquement)
 */

import { getDatabaseId, getAppwriteInstances } from "../services/appwrite";
import { Permission, Role } from "appwrite";
import { realtimeManager } from "./RealtimeManager.svelte";
import { globalState } from "./GlobalState.svelte";
import { toastService } from "$lib/services/toast.service.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { productsStore } from "./ProductsStore.svelte";

// ===========================================================================
//  TYPES
// ===========================================================================

interface Notification {
  type:
    | "event_access_granted"
    | "team_access_granted"
    | "batch_products_update";
  targetCollection: string;
  targetDocumentId: string;
  createdAt: string;
  from?: string;
}

class NotificationStore {
  #isInitialized = $state(false);
  #realtimeInitialized = false;
  #notifications: Notification[] = [];

  // ===========================================================================
  //  LIFECYCLE
  // ===========================================================================

  /**
   * Phase 1 : Lazy initialization de la row utilisateur
   *
   * Stratégie :
   * - Tente de récupérer la row utilisateur (rowId = userId)
   * - Si 404 → création avec lazy init (scope: "user")
   * - Parse le tableau de notifications JSON-stringified
   */
  async initialize(): Promise<void> {
    const userId = globalState.userId;

    if (!userId) {
      console.error("[NotificationStore] No userId found, cannot initialize");
      return;
    }

    const DB_ID = getDatabaseId();

    try {
      // Try to get user row
      const instances = await getAppwriteInstances();
      const userRow = await instances.tables.getRow({
        databaseId: DB_ID,
        tableId: "user_notifications",
        rowId: userId,
      });

      // Parse notifications si la row existe
      this.#notifications = JSON.parse(userRow.notifications || "[]");
      console.log(`[NotificationStore] User row found for ${userId}`);
    } catch (err: any) {
      // Si 404, créer la row (lazy init)
      if (err.code === 404) {
        console.log(
          `[NotificationStore] User row not found, creating lazy init for ${userId}`,
        );
        await this.#createUserRow(userId);
        this.#notifications = [];
      } else {
        console.error("[NotificationStore] Error fetching user row:", err);
        throw err;
      }
    }

    await this.setupRealtime();
  }

  // ===========================================================================
  //  REALTIME
  // ===========================================================================

  /**
   * Phase 2 : Configuration de l'abonnement realtime
   *
   * Abonnement unique à toute la collection user_notifications.
   * Le filtrage par scope se fait dans le handler #handleRealtimeEvent.
   */
  async setupRealtime(): Promise<void> {
    if (this.#realtimeInitialized) {
      console.log("[NotificationStore] Already initialized, skipping.");
      return;
    }

    try {
      console.log("[NotificationStore] Setting up realtime...");
      const DB_ID = getDatabaseId();

      // Single subscription pour toute la collection
      realtimeManager.register(
        [`databases.${DB_ID}.collections.user_notifications.documents`],
        async (response: any) => await this.#handleRealtimeEvent(response),
      );

      this.#isInitialized = true;
      this.#realtimeInitialized = true;
      console.log(
        "[NotificationStore] ✅ Realtime configured (RealtimeManager)",
      );
    } catch (err) {
      console.error("[NotificationStore] Error configuring realtime:", err);
      throw err;
    }
  }

  /**
   * Handler des événements realtime
   *
   * Filtrage par scope :
   * - scope "user" → rowId doit correspondre à userId
   * - scope "event" → rowId doit correspondre à currentMainId
   *
   * Traite uniquement les événements ".update" (pas les creates).
   */
  async #handleRealtimeEvent(response: any): Promise<void> {
    console.log("[NotificationStore] 📨 Raw realtime event:", {
      events: response.events,
      channels: response.channels,
      payload: response.payload,
    });

    const payload = response.payload;
    const currentUserId = globalState.userId;
    const currentMainId = globalState.currentMainId;

    console.log("[NotificationStore] 🔍 Context check:", {
      payloadScope: payload.scope,
      payloadId: payload.$id,
      currentUserId,
      currentMainId,
    });

    // Guard clause: ignorer si pas de currentMainId pour le scope event
    if (payload.scope === "event" && !currentMainId) {
      console.log(
        "[NotificationStore] ⚠️ Ignored: event scope but no currentMainId",
      );
      return;
    }

    // Filtrage par scope
    if (payload.scope === "user") {
      if (payload.$id !== currentUserId) {
        console.log("[NotificationStore] ⚠️ Ignored: user ID mismatch");
        return;
      }
    } else if (payload.scope === "event") {
      if (payload.$id !== currentMainId) {
        console.log("[NotificationStore] ⚠️ Ignored: event ID mismatch");
        return;
      }
    } else {
      console.log("[NotificationStore] ⚠️ Ignored: invalid scope");
      return;
    }

    console.log("[NotificationStore] ✅ Event passed filters, processing...");

    // Traiter les updates ET les creates (création initiale ou mise à jour de notification)
    if (
      response.events.some(
        (e: string) => e.includes(".update") || e.includes(".create"),
      )
    ) {
      console.log("[NotificationStore] ✅ Update/Create event detected");
      const notifications = JSON.parse(payload.notifications || "[]");

      console.log(
        "[NotificationStore] 📋 Notifications to process:",
        notifications,
      );

      for (const notif of notifications) {
        await this.#processNotification(notif);
      }
    } else {
      console.log(
        "[NotificationStore] ⚠️ Ignored: unexpected event type",
        response.events,
      );
    }
  }

  // ===========================================================================
  //  NOTIFICATION PROCESSING
  // ===========================================================================

  /**
   * Traite une notification individuellement
   *
   * Dispatche vers les stores appropriés selon le type :
   * - team_access_granted → NativeTeamsStore.reload()
   * - event_access_granted → EventsStore.reload()
   * - batch_products_update → ProductsStore.syncFromAppwrite()
   */
  async #processNotification(notif: Notification): Promise<void> {
    console.log("[NotificationStore] 🔔 Processing notification:", notif);

    switch (notif.type) {
      case "team_access_granted":
        await nativeTeamsStore.reload();
        toastService.success("Nouvelle équipe ajoutée");
        break;

      case "event_access_granted":
        console.log("[NotificationStore] 🎉 event_access_granted received");
        const eventId = notif.targetDocumentId;
        const enriched = await eventsStore.fetchEvent(eventId);

        if (enriched) {
          console.log(
            `[NotificationStore] ✅ Event ${eventId} fetched successfully`,
          );
          toastService.success("Nouvel événement disponible");
        } else {
          console.log(
            `[NotificationStore] ⚠️ Failed to fetch ${eventId}, falling back to reload()`,
          );
          // Fallback: reload complet si fetch échoue
          await eventsStore.reload();
          toastService.success("Nouvel événement disponible");
        }
        break;

      case "batch_products_update":
        console.log("[NotificationStore] 🛒 batch_products_update received");
        if (notif.targetDocumentId === globalState.currentMainId) {
          console.log(
            "[NotificationStore] ✅ Calling productsStore.syncFromAppwrite()",
          );
          await productsStore.syncFromAppwrite();

          if (notif.from && notif.from !== globalState.userId) {
            if (notif.from === "system") {
              toastService.info("Produits mis à jour", { source: "system" });
            } else {
              toastService.info("Produits modifiés par un autre utilisateur", {
                source: "realtime-other",
              });
            }
          }
        } else {
          console.log("[NotificationStore] ⚠️ Ignored: mainId mismatch", {
            notificationTarget: notif.targetDocumentId,
            currentMain: globalState.currentMainId,
          });
        }
        break;

      default:
        console.log(
          "[NotificationStore] ❓ Unknown notification type:",
          notif.type,
        );
    }
  }

  // ===========================================================================
  //  HELPERS
  // ===========================================================================

  /**
   * Crée la row utilisateur pour la lazy initialization
   *
   * Scope: "user"
   * RowId: userId
   * Permissions: read("user:userId"), update("user:userId")
   */
  async #createUserRow(userId: string): Promise<void> {
    const DB_ID = getDatabaseId();
    const instances = await getAppwriteInstances();

    await instances.tables.createRow({
      databaseId: DB_ID,
      tableId: "user_notifications",
      rowId: userId,
      data: {
        scope: "user",
        notifications: JSON.stringify([]),
      },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
      ],
    });

    console.log(`[NotificationStore] User row created for ${userId}`);
  }

  /**
   * Détruit le store et réinitialise
   */
  destroy(): void {
    this.#isInitialized = false;
    this.#realtimeInitialized = false;
    this.#notifications = [];
    console.log("[NotificationStore] Store destroyed");
  }
}

// Singleton exporté
export const notificationStore = new NotificationStore();
