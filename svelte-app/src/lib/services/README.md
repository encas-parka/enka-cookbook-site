# Architecture ProductsStore & Appwrite Interactions

## Vue d'ensemble

Cette documentation décrit l'architecture moderne du système de gestion des produits avec une séparation claire des responsabilités entre `ProductsStore` (gestion d'état) et `appwrite-products` (services de données).

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                    ProductsStore                           │
│  • Gestion d'état réactif (Svelte 5)                       │
│  • Logique métier (filtres, formatage, groupement)        │
│  • UI réactive (loading, error, syncing)                  │
└─────────────────▲───────────────────────────────────────────┘
                   │ Appelle les services
                   │
┌─────────────────▼───────────────────────────────────────────┐
│              appwrite-products                         │
│  • Accès aux données Appwrite pur                          │
│  • Transformations de données sans état                   │
│  • Logique de chargement, synchro, realtime               │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Appwrite                                │
│  • Base de données NoSQL                                    │
│  • Services CRUD                                           │
│  • Abonnements Realtime                                    │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Flux de Données Complet

### 1. Initialisation (`ProductsStore.initialize()`)

```typescript
// Dans ProductsStore
await this.initialize("mainId");
```

**Étape 1 : Chargement Initial**

```typescript
// Si pas de cache disponible
await this.#loadProductsFromService(mainId);
// ↓ appelle
const products = await loadProducts(mainId, {
  includePurchases: true,
});
```

**Étape 2 : Synchronisation Incrémentielle (si cache)**

```typescript
// Si cache existant
await this.#syncProductsFromService();
// ↓ appelle
const updates = await syncProducts(mainId, {
  lastSync: this.lastSync,
});
// ↓ fusionne
const merged = applyProductUpdates(this.products, updates);
```

**Étape 3 : Configuration Realtime**

```typescript
// Configuration des callbacks
const callbacks = this.#setupRealtimeCallbacks();
// ↓ s'abonne
this.#unsubscribe = subscribeToRealtime(mainId, callbacks);
```

### 2. Flux Realtime

```
Appwrite Event → subscribeToRealtime() → handleRealtimeEvent() → Callbacks appropriés
```

**Types d'événements :**

- `products.create` → `onProductCreate(product)`
- `products.update` → `onProductUpdate(product)`
- `products.delete` → `onProductDelete(productId)`
- `purchases.create` → `onPurchaseCreate(purchase)`
- `purchases.update` → `onPurchaseUpdate(purchase)`
- `purchases.delete` → `onPurchaseDelete(purchaseId)`

## 📋 Répartition des Responsabilités

### ProductsStore (Gestion d'état)

- ✅ **État réactif** : `$state`, `$derived`
- ✅ **Logique métier** : filtres, formatage, groupement
- ✅ **UI state** : loading, error, syncing, realtimeConnected
- ✅ **Persistence** : `PersistedState` pour cache local
- ✅ **Handlers d'événements** : méthodes spécifiques pour chaque type
- ✅ **Débouncing** : `#debouncedUpdateLastSync()`

### appwrite-products (Services de données)

- ✅ **Accès Appwrite** : CRUD, queries, pagination
- ✅ **Transformations pures** : sans état, réutilisables
- ✅ **Realtime management** : abonnement, dispatch d'événements
- ✅ **Utilitaires de fusion** : `applyProductUpdates`, `mergeProductsWithPurchases`
- ✅ **Gestion d'erreurs** : wrapping des erreurs Appwrite

## 🔄 Services Principaux

### Services de Lecture

```typescript
// Chargement complet avec achats
const products = await loadProducts("mainId", {
  includePurchases: true,
  limit: 100,
  orderBy: "productName",
});

// Synchronisation incrémentielle
const updates = await syncProducts("mainId", {
  lastSync: "2024-01-01T00:00:00Z",
});
```

### Services d'Écriture

```typescript
// Mise à jour produit
await updateProduct("productId", {
  productName: "Nouveau nom",
  pF: true,
});

// Gestion des achats
await createPurchase({
  products: ["productId1", "productId2"],
  mainId: "mainId",
  store: "Carrefour",
});
```

### Service Realtime

```typescript
const unsubscribe = subscribeToRealtime("mainId", {
  onProductCreate: (product) => {
    // Handler appelé par ProductsStore
  },
  onProductUpdate: (product) => {
    // Handler appelé par ProductsStore
  },
  onConnect: () => {
    // Gestion état connexion
  },
});

// Pour se désabonner
unsubscribe();
```

## 🔧 Utilitaires de Fusion

### `mergeProductsWithPurchases`

```typescript
// Enrichit les produits avec leurs achats
const enriched = mergeProductsWithPurchases(products, purchases);
// Retourne : ProductWithPurchases[]
```

### `applyProductUpdates`

```typescript
// Applique les mises à jour incrémentielles
const updated = applyProductUpdates(currentProducts, newUpdates);
// Retourne : Products[] (liste fusionnée)
```

## 🚀 Avantages de cette Architecture

1. **Séparation claire** : État vs Données
2. **Testabilité** : Services purs, handlers isolés
3. **Réutilisabilité** : Services utilisables par d'autres stores
4. **Maintenabilité** : Responsabilités bien définies
5. **Performance** : Sync incrémentielle, realtime optimisé
6. **Type Safety** : TypeScript strict, interfaces claires

## 📊 Cycle de Vie

1. **Mount** → `initialize()` → load/sync → realtime
2. **Update** → realtime events → handlers → état réactif
3. **Unmount** → `destroy()` → unsubscribe → cleanup

## 🔍 Debug

Les logs sont préfixés pour identifier facilement la source :

- `[ProductsStore]` : Log du store (état, UI)
- `[Appwrite Interactions]` : Log des services (Appwrite, transformations)

Cette architecture facilite le diagnostic car chaque couche a une responsabilité claire et des logs identifiables.
