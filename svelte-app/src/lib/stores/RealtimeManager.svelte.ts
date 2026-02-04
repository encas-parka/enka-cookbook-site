/**
 * RealtimeManager - Gestionnaire centralisé des souscriptions Realtime Appwrite
 *
 * Cette classe permet de multiplexer plusieurs souscriptions logiques sur une unique
 * connexion WebSocket Appwrite. Elle collecte les channels de tous les stores
 * et établit la connexion au démarrage de l'application.
 */

import type { Client } from "appwrite";
import { getAppwriteInstances } from "../services/appwrite";

interface RealtimeRegistration {
  channels: string[];
  callback: (response: any) => void;
}

export class RealtimeManager {
  #registrations: RealtimeRegistration[] = [];
  #unsubscribe: (() => void) | null = null;
  #isInitialized = false;

  /**
   * Enregistre un ensemble de channels et un callback.
   * Doit être appelé PENDANT la phase d'initialisation des stores,
   * AVANT l'appel à realtimeManager.initialize().
   */
  register(channels: string[], callback: (response: any) => void): void {
    if (this.#isInitialized) {
      console.warn(
        "[RealtimeManager] Enregistrement après initialisation. Utilisez registerDynamic() pour les inscriptions dynamiques.",
      );
    }
    this.#registrations.push({ channels, callback });
    console.log(`[RealtimeManager] Channels enregistrés:`, channels);
  }

  /**
   * Enregistre un ensemble de channels et un callback de manière dynamique.
   * Peut être appelé APRÈS l'initialisation pour ajouter des channels spécifiques
   * (ex: locks qui dépendent de l'événement courant).
   *
   * @returns Fonction de cleanup pour désinscrire ces channels
   */
  registerDynamic(
    channels: string[],
    callback: (response: any) => void,
  ): () => void {
    this.#registrations.push({ channels, callback });
    console.log(`[RealtimeManager] Channels dynamiques enregistrés:`, channels);

    // Si déjà initialisé, créer un nouvel abonnement pour ces channels
    // Appwrite réutilisera automatiquement la connexion WebSocket existante
    if (this.#isInitialized) {
      this.#setupDynamicSubscription(channels, callback);
    }

    // Retourner une fonction de cleanup
    return () => {
      const index = this.#registrations.findIndex(
        (r) => r.channels === channels && r.callback === callback,
      );
      if (index !== -1) {
        this.#registrations.splice(index, 1);
        console.log(
          `[RealtimeManager] Channels dynamiques désenregistrés:`,
          channels,
        );
      }
    };
  }

  /**
   * Établit l'unique connexion WebSocket avec tous les channels cumulés.
   */
  async initialize(): Promise<void> {
    if (this.#isInitialized) return;

    const allChannels = [
      ...new Set(this.#registrations.flatMap((r) => r.channels)),
    ];

    if (allChannels.length === 0) {
      console.log("[RealtimeManager] Aucun channel à souscrire.");
      this.#isInitialized = true;
      return;
    }

    try {
      console.log(
        `[RealtimeManager] Initialisation de la connexion unique avec ${allChannels.length} channels...`,
      );
      const { client } = await getAppwriteInstances();

      this.#unsubscribe = client.subscribe(allChannels, (response) => {
        // Distribuer l'événement à chaque store intéressé
        for (const reg of this.#registrations) {
          const hasMatchingChannel = response.channels.some((ch: string) =>
            reg.channels.includes(ch),
          );
          if (hasMatchingChannel) {
            reg.callback(response);
          }
        }
      });

      this.#isInitialized = true;
      console.log("[RealtimeManager] ✅ Connexion Realtime établie.");
    } catch (err) {
      console.error("[RealtimeManager] Erreur lors de l'initialisation:", err);
      throw err;
    }
  }

  /**
   * Configure un abonnement pour des channels ajoutés dynamiquement
   */
  async #setupDynamicSubscription(
    channels: string[],
    callback: (response: any) => void,
  ): Promise<void> {
    try {
      console.log(
        `[RealtimeManager] Ajout de ${channels.length} channels à la connexion existante...`,
      );
      const { client } = await getAppwriteInstances();

      client.subscribe(channels, (response) => {
        callback(response);
      });

      console.log(
        `[RealtimeManager] ✅ Channels dynamiques ajoutés:`,
        channels,
      );
    } catch (err) {
      console.error(
        "[RealtimeManager] Erreur lors de l'ajout de channels dynamiques:",
        err,
      );
    }
  }

  /**
   * Ferme la connexion et nettoie les enregistrements.
   */
  destroy(): void {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
    this.#registrations = [];
    this.#isInitialized = false;
    console.log("[RealtimeManager] Connexion Realtime fermée.");
  }

  /**
   * Retourne l'état d'initialisation du RealtimeManager.
   * Permet aux stores de savoir s'ils doivent réenregistrer leurs channels.
   */
  get isInitialized(): boolean {
    return this.#isInitialized;
  }
}

// Singleton
export const realtimeManager = new RealtimeManager();
