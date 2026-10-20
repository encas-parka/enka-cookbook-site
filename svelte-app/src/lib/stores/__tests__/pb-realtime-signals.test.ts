/**
 * @vitest-environment jsdom
 */

/**
 * pb-realtime — signaux SSE (connect/disconnect) et cycle de vie auth.
 *
 * Contrats épinglés :
 *  - la première connexion PB_CONNECT est consommée (hasConnectedOnce),
 *    les suivantes notifient les listeners de reconnexion (resync orchestrateur)
 *  - onDisconnect avec abonnés actifs → « disconnected » APRÈS le debounce
 *    de 3 s (le SDK tire onDisconnect à chaque cycle de backoff ~2 s —
 *    sans debounce, la StatusBar clignoterait)
 *  - une reconnexion dans la fenêtre de debounce annule l'affichage
 *    (micro-coupure jamais visible) tout en notifiant le resync
 *  - onDisconnect sans abonné actif (autoclose propre, ex. logout) → jamais
 *    « disconnected »
 *  - teardown : unsubscribe PB_CONNECT, hook retiré, statut remis à null,
 *    hasConnectedOnce réinitialisé (re-login = première connexion re-consommée)
 *  - échec d'abonnement au login (serveur injoignable) : résilient, sans crash
 *
 * Le module `pb` est mocké ici (surface `realtime` minimale) — le stub t12
 * n'expose pas les signaux SSE.
 */

const { fakeRealtime } = vi.hoisted(() => {
  class FakeRealtime {
    isConnected = false;
    onDisconnect: ((activeSubscriptions: string[]) => void) | undefined;
    unsubscribeCalls = 0;
    #connectListeners: Array<(data: unknown) => void> = [];

    async subscribe(
      _topic: string,
      callback: (data: unknown) => void,
    ): Promise<() => Promise<void>> {
      this.#connectListeners.push(callback);
      return async () => {
        this.unsubscribeCalls++;
        this.#connectListeners = [];
      };
    }

    emitConnect(): void {
      this.isConnected = true;
      for (const cb of [...this.#connectListeners]) cb({});
    }

    emitDisconnect(activeSubscriptions: string[]): void {
      this.isConnected = false;
      this.onDisconnect?.(activeSubscriptions);
    }
  }

  return { fakeRealtime: new FakeRealtime() };
});

vi.mock("$lib/db-sync/pb", () => ({ pb: { realtime: fakeRealtime } }));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initRealtimeSignals,
  onRealtimeReconnect,
  teardownRealtimeSignals,
} from "$lib/db-sync/pb-realtime";
import { statusBarStore } from "$lib/stores/StatusBarStore.svelte";

let reconnectCallCount = 0;
let unregisterReconnect: (() => void) | null = null;

describe("pb-realtime signals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reconnectCallCount = 0;
    unregisterReconnect = onRealtimeReconnect(() => {
      reconnectCallCount++;
    });
  });

  afterEach(async () => {
    await teardownRealtimeSignals();
    if (unregisterReconnect) unregisterReconnect();
    unregisterReconnect = null;
    fakeRealtime.unsubscribeCalls = 0;
    vi.useRealTimers();
  });

  it("consomme la première connexion puis notifie les reconnexions", async () => {
    await initRealtimeSignals();

    fakeRealtime.emitConnect();
    expect(reconnectCallCount).toBe(0);
    expect(statusBarStore.serverStatus).toBeNull();

    fakeRealtime.emitConnect();
    expect(reconnectCallCount).toBe(1);
  });

  it("affiche « disconnected » seulement après le debounce de 3 s", async () => {
    await initRealtimeSignals();
    fakeRealtime.emitConnect();

    fakeRealtime.emitDisconnect(["events"]);
    vi.advanceTimersByTime(2_999);
    expect(statusBarStore.serverStatus).toBeNull();
    vi.advanceTimersByTime(1);
    expect(statusBarStore.serverStatus).toBe("disconnected");
  });

  it("annule l'affichage si une reconnexion survient dans la fenêtre de debounce", async () => {
    await initRealtimeSignals();
    fakeRealtime.emitConnect();

    fakeRealtime.emitDisconnect(["events"]);
    fakeRealtime.emitConnect();
    vi.advanceTimersByTime(5_000);
    expect(statusBarStore.serverStatus).toBeNull();
    // la reconnexion notifie quand même le resync orchestrateur
    expect(reconnectCallCount).toBe(1);
  });

  it("ignore un débranchement propre (aucun abonné actif)", async () => {
    await initRealtimeSignals();
    fakeRealtime.emitConnect();

    fakeRealtime.emitDisconnect([]);
    vi.advanceTimersByTime(10_000);
    expect(statusBarStore.serverStatus).toBeNull();
  });

  it("teardown : unsub PB_CONNECT, hook retiré, statut null, re-init re-consomme", async () => {
    await initRealtimeSignals();
    fakeRealtime.emitConnect();
    fakeRealtime.emitDisconnect(["events"]);
    vi.advanceTimersByTime(3_000);
    expect(statusBarStore.serverStatus).toBe("disconnected");

    await teardownRealtimeSignals();
    expect(fakeRealtime.unsubscribeCalls).toBe(1);
    expect(fakeRealtime.onDisconnect).toBeUndefined();
    expect(statusBarStore.serverStatus).toBeNull();

    // plus aucun effet post-teardown (pas de hook, pas d'abonné)
    fakeRealtime.emitDisconnect(["events"]);
    vi.advanceTimersByTime(5_000);
    expect(statusBarStore.serverStatus).toBeNull();
    expect(reconnectCallCount).toBe(0);

    // re-init : la première connexion est re-consommée
    await initRealtimeSignals();
    fakeRealtime.emitConnect();
    expect(reconnectCallCount).toBe(0);
    fakeRealtime.emitConnect();
    expect(reconnectCallCount).toBe(1);
  });

  it("échec d'abonnement au login (serveur injoignable) : résilient, sans crash", async () => {
    const original = fakeRealtime.subscribe.bind(fakeRealtime);
    fakeRealtime.subscribe = async () => {
      throw new Error("connect failed");
    };

    await expect(initRealtimeSignals()).resolves.toBeUndefined();
    expect(fakeRealtime.onDisconnect).toBeUndefined();
    expect(statusBarStore.serverStatus).toBeNull();

    // répare le fake pour le teardown d'afterEach
    fakeRealtime.subscribe = original;
  });
});
