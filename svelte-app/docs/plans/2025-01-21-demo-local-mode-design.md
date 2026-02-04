# Design Document - Mode Démo Public

**Date :** 2025-01-21
**Auteur :** Claude (Brainstorming session)
**Status :** Validé - Ready for implementation

---

## 📋 Vue d'ensemble

**Objectif :** Permettre aux utilisateurs non authentifiés d'explorer une démo complète des fonctionnalités de gestion d'événements, sans duplication de code.

**Principe :** Adaptation guards + `canEdit` basé sur `status === "local"` + Lazy initialization + Auto-init dans les guards.

**Contraintes :**
- ✅ PAS de duplication de pages (EventEditPage, EventRecipesPage, etc.)
- ✅ Fonctionnalité complète du mode local (édition, todos, meals)
- ✅ Compatible avec l'architecture existante (EventsStore, ProductsStore)
- ✅ Lazy initialization (pas de surcharge au démarrage)

---

## 🏗️ Architecture

### **1. Initialisation du store en mode public**

**Fichier :** `src/lib/stores/EventsStore.svelte.ts`

**Ajouter une méthode publique :**

```typescript
async initializeForPublic(): Promise<void> {
  if (this.#isInitialized) {
    console.log("[EventsStore] Déjà initialisé");
    return;
  }

  console.log("[EventsStore] Initialisation mode public...");
  this.#loading = true;
  this.#error = null;

  try {
    // Ouvrir le cache IndexedDB
    this.#cache = await createEventsIDBCache();

    // Charger les events démo directement (pas depuis IDB)
    await this.loadDemoEvents();

    this.#isInitialized = true;
    this.#userId = "guest"; // ← Utilisateur invité
    this.#userTeams = [];

    console.log("[EventsStore] Mode public initialisé : events démo chargés");
  } catch (err) {
    console.error("[EventsStore] Erreur init mode public:", err);
    throw err;
  } finally {
    this.#loading = false;
  }
}
```

**Pourquoi :**
- Initialise le store **sans** Appwrite
- Définit `userId = "guest"` pour les assignations de todos
- Charge directement les events démo (pas depuis un cache potentiellement vide)

---

### **2. Adaptation de `canUserEditEvent()`**

**Fichier :** `src/lib/stores/EventsStore.svelte.ts`

**Modifier la méthode existante :**

```typescript
canUserEditEvent(
  eventId: string,
  userId: string,
  userTeams?: string[],
): boolean {
  const event = this.#events.get(eventId);
  if (!event) return false;

  // ✅ MODE LOCAL : Toujours éditable
  if ((event.status as string) === "local") {
    return true;
  }

  // Mode normal (existing code)
  if (!userId) return false;

  if (event.createdBy === userId) return true;

  if (event.teams?.length && userTeams?.length) {
    if (event.teams.some((teamId) => userTeams.includes(teamId))) {
      return true;
    }
  }

  if (event.contributors) {
    if (
      event.contributors.some(
        (c) => c.id === userId && c.status === "accepted",
      )
    ) {
      return true;
    }
  }

  return false;
}
```

**Pourquoi :** Un garde unique qui autorise l'édition en mode local sans vérifier les permissions Appwrite.

---

### **3. Support du "guest" dans `toggleTodoAssignment()`**

**Fichier :** `src/lib/stores/EventsStore.svelte.ts`

**Modifier la méthode locale :**

```typescript
async #toggleTodoAssignmentLocal(eventId: string, todoId: string): Promise<void> {
  // 🔥 MODE LOCAL : Utiliser "guest" si pas de userId
  const userId = globalState.userId || "guest";

  const existing = this.#events.get(eventId);
  if (!existing) {
    throw new Error("Événement introuvable");
  }

  const todo = existing.todos.find((t) => t.id === todoId);
  if (!todo) {
    throw new Error("Todo introuvable");
  }

  // Toggle l'assignation
  let currentAssigned: string[] = [];
  if (Array.isArray(todo.assignedTo)) {
    currentAssigned = [...todo.assignedTo];
  } else if (todo.assignedTo) {
    currentAssigned = [todo.assignedTo as string];
  }

  if (currentAssigned.includes(userId)) {
    currentAssigned = currentAssigned.filter((id) => id !== userId);
  } else {
    currentAssigned.push(userId);
  }

  // Update
  existing.todos = existing.todos.map((t) =>
    t.id === todoId
      ? {
          ...t,
          assignedTo: currentAssigned.length > 0 ? currentAssigned : null,
          updatedAt: new Date().toISOString(),
        }
      : t,
  );

  // Persister
  if (this.#cache) {
    await this.#cache.saveEvent(existing);
  }

  console.log(`[EventsStore] Mode local: Todo assignment toggled: ${todoId} par ${userId}`);
}
```

**Pourquoi :** Permet au "guest" de s'assigner des todos dans le mode démo.

---

### **4. Guards pour les locks Appwrite**

**Fichier :** `src/lib/routes/EventEditPage.svelte`

**Ajouter des guards dans les méthodes de lock :**

```typescript
async function acquireLock() {
  // 🔥 MODE LOCAL : Skip locks
  if (currentEvent?.status === "local") {
    console.log("[EventEditPage] Mode local: skip lock acquisition");
    isLockedByMe = true; // Fake lock
    return;
  }

  // Mode normal (existing code)
  isAcquiringLock = true;
  try {
    const success = await locksService.acquireLock(...);
    if (success) {
      isLockedByMe = true;
    }
  } finally {
    isAcquiringLock = false;
  }
}

async function releaseLock() {
  // 🔥 MODE LOCAL : Skip release
  if (currentEvent?.status === "local") {
    console.log("[EventEditPage] Mode local: skip lock release");
    isLockedByMe = false;
    return;
  }

  // Mode normal
  await locksService.releaseLock(...);
  isLockedByMe = false;
}
```

**Pourquoi :** Le système de locks Appwrite ne fonctionne pas en mode local. On le bypass complètement.

---

### **5. PermissionsManager en mode local**

**Fichier :** `src/lib/routes/EventEditPage.svelte`

**Remplacer le composant conditionnellement :**

```svelte
{#if currentEvent?.status === "local"}
  <!-- Mode démo : Message informatif -->
  <Fieldset legend="Participants" iconComponent={Users}>
    <div class="alert alert-info">
      <Info class="h-5 w-5" />
      <div>
        <h4 class="font-bold">Mode Démonstration</h4>
        <p class="text-sm">
          Dans un véritable événement, vous pourrez inviter des équipes
          et des participants à collaborer sur la planification.
        </p>
      </div>
    </div>
  </Fieldset>
{:else}
  <!-- Mode normal : PermissionsManager -->
  <PermissionsManager
    eventId={eventId}
    canEdit={canEdit}
  />
{/if}
```

**Pourquoi :** Éducatif pour l'utilisateur, et évite des erreurs Appwrite.

---

### **6. Bouton d'accès à la démo**

**Fichier :** `src/lib/routes/HomePage.svelte`

**Implémenter `handleDemoEvent()` :**

```typescript
async function handleDemoEvent() {
  try {
    const toastId = toastService.loading("Chargement de la démo...");

    // ✅ Lazy initialization du store pour le mode public
    if (!eventsStore.isInitialized) {
      await eventsStore.initializeForPublic();
    }

    // ✅ Récupérer le premier event démo
    const demoEvents = eventsStore.events.filter(e => e.status === "local");

    if (demoEvents.length === 0) {
      toastService.update(toastId, {
        state: "error",
        message: "Aucun événement de démo disponible",
        autoCloseDelay: 3000,
      });
      return;
    }

    const demoEvent = demoEvents[0];

    toastService.dismiss(toastId);

    // ✅ Naviguer vers l'édition de l'event démo
    navigate(`/demo/event/${demoEvent.$id}`);
  } catch (error) {
    console.error("[HomePage] Erreur chargement démo:", error);
    toastService.error("Erreur lors du chargement de la démo");
  }
}
```

**Pourquoi :** Lazy initialization = pas de surcharge au démarrage de l'app.

---

### **7. ✨ Guard avec auto-initialisation**

**Fichier :** `src/App.svelte`

**Créer un guard personnalisé :**

```typescript
// ✅ Guard pour mode local (AVEC auto-initialisation)
const requireLocalEvent: RouteGuards = {
  beforeEnter: async (params) => {
    const eventId = params?.id;

    if (!eventId) {
      console.log("[Router] EventId manquant > Redirection /");
      navigate("/");
      return false;
    }

    // ✅ AUTO-INITIALISATION si le store n'est pas prêt
    if (!eventsStore.isInitialized) {
      console.log("[Router] EventsStore non initialisé > Auto-init mode public");
      try {
        await eventsStore.initializeForPublic();
      } catch (error) {
        console.error("[Router] Erreur initialisation:", error);
        navigate("/");
        return false;
      }
    }

    // Vérifier que l'event existe ET est en mode local
    const event = eventsStore.getEventById(eventId);

    if (!event) {
      console.log("[Router] Event introuvable > Redirection /");
      navigate("/");
      return false;
    }

    if ((event.status as string) !== "local") {
      console.log("[Router] Event non local > Auth requise");
      navigate("/");
      return false;
    }

    return true;
  },
};
```

**Pourquoi :**
- Résout l'accès direct sans passer par handleDemoEvent
- Plus robuste : l'utilisateur peut bookmark `/demo/event/xxx`
- Lazy initialization préservée (ne se lance que si nécessaire)

---

### **8. Routes publiques pour le mode démo**

**Fichier :** `src/App.svelte`

```typescript
// ✅ Routes pour le mode démo (PAS de requireAuth)
router.addRoute(
  "/demo/event/:id",
  () => import("./lib/routes/EventEditPage.svelte"),
  requireLocalEvent,
);
router.addRoute(
  "/demo/event/recipes/:id",
  () => import("./lib/routes/EventRecipesPage.svelte"),
  requireLocalEvent,
);
router.addRoute(
  "/demo/event/products/:id",
  () => import("./lib/routes/EventProductsPage.svelte"),
  requireLocalEvent,
);
router.addRoute(
  "/demo/event/poster/:id",
  () => import("./lib/routes/EventPosterPage.svelte"),
  requireLocalEvent,
);
```

**Pourquoi :** Permet l'accès aux pages d'édition sans auth, mais uniquement pour les events locaux.

---

### **9. Event démo avec guest contributor**

**Fichier :** `src/lib/data/demo-events.ts`

**Modifier `generateDemoEvent()` :**

```typescript
export async function generateDemoEvent(
  config: DemoEventConfig,
  offsetDays: number = 0,
): Promise<EnrichedEvent> {
  // ... existing code ...

  // ✅ AJOUTER: Guest contributor
  const guestContributor: EventContributor = {
    id: "guest",
    name: "Visiteur",
    email: "guest@demo.local",
    status: "accepted",
    respondedAt: new Date().toISOString(),
  };

  const enrichedEvent: EnrichedEvent = {
    // Required fields
    $id: eventId,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],

    // Main fields
    name: config.name,
    description: config.description,
    status: "local" as MainStatus,
    dateStart: startDate.toISOString(),
    dateEnd: endDate.toISOString(),
    allDates: allDates,
    meals: meals,
    contributors: [guestContributor], // ← Au moins un contributor
    todos: [],
    teams: [],
    teamsId: [],
    createdBy: "demo-system",
    isActive: true,
    originalDataHash: null,
    error: null,
    minContrib: 1,
    $sequence: 0,
    $tableId: "",
    $databaseId: "",
  };

  return enrichedEvent;
}
```

**Pourquoi :** L'événement a au moins un contributor, ce qui évite des bugs potentiels dans les UI qui itèrent sur `contributors`.

---

## 🔄 Flux de données

### **Scénario A : Via bouton Démo**

```
1. User clique sur "Démo" dans HomePage
   ↓
2. handleDemoEvent()
   ↓
3. eventsStore.initializeForPublic()
   - Ouvre IndexedDB
   - Load demo events
   - userId = "guest"
   ↓
4. eventsStore.events contient les events démo
   ↓
5. navigate("/demo/event/{demoEventId}")
   ↓
6. requireLocalEvent guard vérifie status === "local"
   ↓
7. EventEditPage charge
   ↓
8. canEdit = true (grâce à status === "local")
   ↓
9. acquireLock() bypassé (mode local)
   ↓
10. PermissionsManager remplacé par Fieldset informatif
   ↓
11. Édition complète fonctionnelle
```

### **Scénario B : Accès direct via URL**

```
1. User accède à /demo/event/xxx directement
   ↓
2. requireLocalEvent guard
   - Vérifie eventsStore.isInitialized
   - Si false : lance initializeForPublic()
   ↓
3. Vérifie que l'event existe et status === "local"
   ↓
4. EventEditPage charge
   ↓
5. Suite identique au scénario A
```

---

## ⚠️ Cas limites

### **Cas 1 : Store non initialisé**

**✅ RÉSOLU :** Le guard `requireLocalEvent` lance automatiquement `initializeForPublic()` si nécessaire.

**Avantages :**
- Accès direct via URL fonctionne
- Bookmarking possible
- Plus robuste

---

### **Cas 2 : Event local modifié puis auth**

**Analyse :** L'utilisateur modifie l'event démo, puis s'authentifie. L'event local persiste en IDB.

**Comportement actuel :**
- `initializeForPublic()` appelle `loadDemoEvents()` à chaque fois
- Les events démo sont régénérés depuis la config
- Les modifications de l'utilisateur sont **perdues** si elles ne sont pas persistées correctement

**Conclusion :** Ce n'est pas un problème ! Les modifications de l'event démo sont intentionnellement éphémères. C'est une **démo**, pas un vrai event. Les modifications sont sauvegardées en IDB et restent disponibles tant que l'utilisateur ne rafraîchit pas.

**✅ STATUT :** Comportement acceptable pour une démo.

---

### **Cas 3 : ProductsStore en mode local**

**Analyse :** `ProductsStore` a déjà un mode local via `#isLocalMode()`.

**Vérification :**

```typescript
// ProductsStore.svelte.ts L166
#isLocalMode(): boolean {
  if (!this.#currentEventId) return false;

  const event = eventsStore.getEventById(this.#currentEventId);
  return (event?.status as string) === 'local';
}
```

**Utilisation :**
- ✅ `syncFromAppwrite()` a un guard (L772)
- ✅ `#setupRealtimeSubscriptions()` a un guard (L1282)
- ✅ `#loadOrphanPurchases()` a un guard (L1678)

**✅ STATUT :** Aucun changement nécessaire - déjà compatible !

---

## 🧪 Tests à réaliser

### **Test 1 : Navigation via bouton Démo**
1. Cliquer sur "Démo" depuis HomePage
2. Vérifier que l'event se charge
3. Vérifier que l'édition fonctionne
4. Vérifier les toast messages

### **Test 2 : Navigation directe**
1. Accéder directement à `/demo/event/{id}` sans passer par HomePage
2. Vérifier que le guard initialise automatiquement
3. Vérifier que l'accès fonctionne
4. Tester avec un ID invalide (doit redirect vers /)

### **Test 3 : Permissions**
1. Modifier un meal
2. Cocher un todo
3. Changer le statut
4. Vérifier que tout est persisté en IDB

### **Test 4 : Multi-pages**
1. Naviguer vers /demo/event/recipes/{id}
2. Naviguer vers /demo/event/products/{id}
3. Naviguer vers /demo/event/poster/{id}
4. Vérifier que tout fonctionne

### **Test 5 : Guards**
1. Essayer d'accéder à `/dashboard/eventEdit/{demoId}` (doit redirect vers /)
2. Essayer d'accéder à `/demo/event/{realEventId}` (doit redirect vers /)
3. Essayer d'accéder à `/demo/event/invalidId` (doit redirect vers /)

### **Test 6 : Auth après démo**
1. Charger la démo
2. Modifier des données
3. S'authentifier
4. Vérifier que les données démo ne polluent pas l'espace authentifié

---

## 📋 Checklist d'implémentation

### **EventsStore**
- [ ] `initializeForPublic()` - NOUVELLE MÉTHODE
- [ ] `canUserEditEvent()` - AJOUT guard `status === "local"`
- [ ] `#toggleTodoAssignmentLocal()` - Support de "guest"

### **EventEditPage**
- [ ] Guards pour `acquireLock()` (mode local)
- [ ] Guards pour `releaseLock()` (mode local)
- [ ] Replacement de `PermissionsManager` par Fieldset informatif

### **HomePage**
- [ ] `handleDemoEvent()` - Lazy init + navigation

### **App.svelte**
- [ ] Guard `requireLocalEvent` avec auto-initialisation
- [ ] Routes `/demo/event/:id`
- [ ] Routes `/demo/event/recipes/:id`
- [ ] Routes `/demo/event/products/:id`
- [ ] Routes `/demo/event/poster/:id`

### **demo-events.ts**
- [ ] Ajout guest contributor dans `generateDemoEvent()`

---

## 🎯 Succès critères

L'implémentation sera considérée comme réussie si :

1. ✅ Un utilisateur non authentifié peut accéder à la démo
2. ✅ Toutes les fonctionnalités d'édition fonctionnent (meals, todos, statut)
3. ✅ Les modifications sont persistées en IDB
4. ✅ ProductsStore fonctionne correctement en mode local
5. ✅ Les guards empêchent l'accès aux events non-locaux
6. ✅ L'auto-initialisation fonctionne pour l'accès direct via URL
7. ✅ Aucune duplication de code/pages

---

## 📝 Notes de maintenance

### **Évolutions futures**

Si demain on veut permettre la création d'events en mode local :

1. Ajouter une méthode `createLocalEvent()` dans EventsStore
2. Créer un guard `canCreateLocalEvents` basé sur `globalState.isAuthenticated === false`
3. Adapter la UI pour montrer/cacher le bouton "Créer" selon l'auth

### **Limitations actuelles**

- ❌ Impossible de créer des events en mode local via UI
- ❌ Impossible de supprimer des events en mode local via UI
- ❌ Pas de conversion local → sync
- ❌ Pas de realtime pour les events locaux
- ❌ Pas de cloud functions (todo status, assignments) - géré en local

Ces limitations sont **acceptables** pour un mode démo (YAGNI).

---

## 🔗 Références

- [Local Mode Documentation](./local-mode.md)
- [Demo Events Generator](./demo-events-generator.md)
- [EventsStore Implementation](../src/lib/stores/EventsStore.svelte.ts)
- [ProductsStore Implementation](../src/lib/stores/ProductsStore.svelte.ts)

---

**Document validé et prêt pour implémentation.**
