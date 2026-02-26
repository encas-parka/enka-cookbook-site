# Local Mode for Demo Events

## Overview

Local mode allows demo/showcase events to function completely offline without any Appwrite communication. Data is stored exclusively in IndexedDB.

## How It Works

### Detection

An event is considered "local" when its `status` field equals `'local'`:

```typescript
event.status === 'local'
```

### Behavior

When an event is in local mode:

1. **All Appwrite operations are skipped**
   - No sync from remote
   - No realtime subscriptions
   - No cloud function calls

2. **All updates persist to IndexedDB only**
   - Event metadata
   - Meals
   - Todos
   - Contributors
   - Products & Purchases

3. **Data flows through the normal reactive pipeline**
   - SvelteMap updates
   - UI reacts automatically
   - Same user experience as synced events

## Implementation Pattern

### Guard Clause Pattern

Every method that communicates with Appwrite uses a guard clause:

```typescript
async someMethod(eventId: string, data: SomeData) {
  // 🔥 MODE LOCAL: Bypass Appwrite
  if (this.#isLocalMode(eventId)) {
    return await this.#someMethodLocal(eventId, data);
  }

  // Mode normal: Appwrite
  // ... existing code
}
```

### Local Methods

Local-only methods follow this pattern:

```typescript
async #someMethodLocal(eventId: string, data: SomeData): Promise<Result> {
  const existing = this.#events.get(eventId);
  if (!existing) throw new Error("Not found");

  const updated = { ...existing, ...data, $updatedAt: new Date().toISOString() };
  this.#events.set(eventId, updated);

  if (this.#cache) {
    await this.#cache.saveEvent(updated);
  }

  return updated;
}
```

## Usage

### Creating Demo Events

Demo events should be created as fixtures with `status: 'local'`:

```typescript
const demoEvent: Main = {
  $id: 'demo-event-1',
  name: 'Demo Event',
  status: 'local', // ← CRUCIAL
  // ... other fields
};
```

See `src/lib/data/demo-events.ts` for the generation script.

### Loading Demo Events

Events are loaded into the store normally:

```typescript
await eventsStore.initialize();
// Demo events are mixed with normal events in the Map
```

The store automatically detects local mode and routes operations correctly.

## Limitations

- ❌ Cannot create events in local mode via UI
- ❌ Cannot delete events in local mode via UI
- ❌ Cannot convert local ↔ synced
- ❌ No realtime updates for local events
- ❌ No cloud functions (todo status, assignments) work in local mode

## Testing

See `docs/local-mode-testing.md` for test procedures.

## Architecture Decisions

### Why `status: 'local'`?

- **KISS**: Reuses existing field, no schema change
- **Simple**: Easy to check and understand
- **YAGNI**: No need for complex metadata system

### Why Guard Clauses?

- **Minimal changes**: No refactor needed
- **Clear intent**: Easy to see what's skipped
- **Localizable**: Each method handles its own logic

### Why No Realtime in Local Mode?

- **Offline by design**: Demo events shouldn't sync
- **No multi-user**: No need for realtime
- **Simpler**: Less code to maintain

## Future Considerations

If we later need:
- Local → Synced conversion: Would need migration logic
- Multi-user demo mode: Would need local realtime
- Partial sync: Would need more granular permissions

These are explicitly out of scope for now (YAGNI).
