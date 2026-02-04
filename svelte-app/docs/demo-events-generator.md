# Demo Events Generator

## Overview

The demo events generator creates realistic demonstration events with dynamic future dates, complete with meals and recipes. These events are used to showcase the application to unauthenticated users.

## Architecture

### Configuration Format

Events are defined using simple configuration objects:

```typescript
interface DemoEventConfig {
  name: string;
  description: string;
  durationDays: number;
  meals: DemoMeal[];
}

interface DemoMeal {
  recipes: Array<{
    recipeUuid: string;
    plates: number;
    typeR: string;
    hasOwnPlatesNb?: boolean;
  }>;
  guests: number;
  dayOffset: number; // Days from start
  time: string; // "HH:mm" format
}
```

### Date Generation

- Events always start on the next Friday (minimum 7 days in future)
- Multiple events are spaced 30 days apart
- Meal times use exact hours (e.g., "08:00", "12:00", "20:00")
- Dates are generated as full ISO 8601 timestamps

### Recipe Integration

- Recipes are validated against RecipesStore during generation
- Recipe UUIDs must exist in the recipe database
- Missing recipes are logged and skipped
- Each recipe includes typeR, plates, and metadata from the config

### Output Format

Generator produces `EnrichedEvent` objects:

```typescript
interface EnrichedEvent {
  $id: string;
  name: string;
  status: "local"; // ← Local mode flag
  dateStart: string; // ISO 8601
  dateEnd: string; // ISO 8601
  allDates: string[]; // YYYY-MM-DD
  meals: EventMeal[]; // ← Array of objects (NOT stringified)
  contributors: EventContributor[];
  todos: EventTodo[];
  // ... other fields
}
```

## Usage

### Basic Generation

```typescript
import { generateAllDemoEvents } from "$lib/data/demo-events";

// Generate all demo events
const demoEvents = await generateAllDemoEvents();

// Load into EventsStore
await eventsStore.loadDemoEvents();
```

### Custom Event

```typescript
import { generateDemoEvent } from "$lib/data/demo-events";

const customEvent = await generateDemoEvent({
  name: "My Custom Event",
  description: "A custom demo event",
  durationDays: 2,
  meals: [
    {
      recipes: [
        {
          recipeUuid: "recipe-1",
          plates: 50,
          typeR: "entree",
          hasOwnPlatesNb: false,
        },
      ],
      guests: 50,
      dayOffset: 0,
      time: "12:00",
    },
  ],
});
```

### Testing

```typescript
import { testGenerateDemoEvents } from "$lib/data/demo-events";

// Run test suite
await testGenerateDemoEvents();
```

## Adding New Demo Events

1. **Define Configuration**

Add to `demo-event-config.ts`:

```typescript
export const MY_DEMO_EVENT: DemoEventConfig = {
  name: "Corporate Seminar",
  description: "3-day corporate event for 150 attendees",
  durationDays: 3,
  meals: [
    // Add meals...
  ]
};
```

2. **Export Configuration**

Add to `DEMO_EVENTS_CONFIGS` array in `demo-events.ts`:

```typescript
export const DEMO_EVENTS_CONFIGS: DemoEventConfig[] = [
  DEMO_EVENT_CONFIG,
  MY_DEMO_EVENT,
];
```

3. **Verify Recipe UUIDs**

Ensure all `recipeUuid` values exist in your recipe database:

```typescript
const recipe = await recipesStore.getRecipeByUuid("my-recipe-uuid");
console.log(recipe); // Should not be null
```

## Validation

The generator includes automatic validation:

- ✅ Event status is "local"
- ✅ Meals are in chronological order
- ✅ allDates matches meal dates
- ✅ Event date range covers all meals
- ✅ All meals have at least one recipe
- ✅ Guest/plate ratios are reasonable

## Integration with Local Mode

- Generated events have `status: "local"`
- EventsStore automatically detects local mode
- All updates work offline (no Appwrite calls)
- Data persists to IndexedDB only

## File Structure

```
src/lib/data/
├── demo-events.ts           # Main generator
├── demo-event-config.ts     # Event configurations
└── __tests__/
    └── demo-events.test.ts # Unit tests
```

## Troubleshooting

### Recipe Not Found

**Error:** `Recipe not found: xyz`

**Solution:** Check that the recipe UUID exists in the recipe database. Run:

```javascript
await recipesStore.initialize();
const recipe = await recipesStore.getRecipeByUuid("xyz");
console.log(recipe);
```

### Validation Errors

**Error:** `Demo event validation failed`

**Solution:** Check the validation errors in the console. Common issues:

- Meals not in chronological order
- Dates outside event range
- Missing allDates entries

### Events Not Appearing

**Check:**

1. Events are loaded: `await eventsStore.loadDemoEvents()`
2. Check EventsStore: `eventsStore.events`
3. Check IndexedDB: DevTools → Application → IndexedDB

## Example: Current Demo Event

The default demo event is a **5-day Corporate Seminar** with:

- **Duration:** 5 days (Monday to Friday)
- **Meals:** 10 meals (lunch + dinner each day)
- **Guests:** 200-300 per meal
- **Recipes:** 3-4 recipes per meal
- **Vegan Options:** Included with lower plate counts
- **Status:** "local" (offline mode)
