/**
 * Générateur d'événements de démonstration
 *
 * Ce module génère des événements de démonstration avec des dates futures dynamiques,
 * en récupérant les recettes depuis RecipesStore et en produisant des objets EnrichedEvent
 * entièrement compatibles avec le mode local.
 */

import type {
  EnrichedEvent,
  EventMeal,
  EventContributor,
} from "$lib/types/events.d";
import type { MainStatus, RecettesTypeR } from "$lib/types/appwrite.d";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";

// =============================================================================
// IMPORT & RE-EXPORT DES TYPES DEPUIS demo-event-config.ts
// =============================================================================

import type {
  DemoEventConfig,
  DemoMeal,
  DemoRecipe,
} from "./demo-event-config";

// Re-export for external use
export type { DemoEventConfig, DemoMeal, DemoRecipe };

// =============================================================================
// IMPORT DE LA CONFIGURATION EXISTANTE
// =============================================================================

import { DEMO_EVENT_CONFIG, DEMO_EVENT_ID } from "./demo-event-config";

/**
 * Configuration des événements de démonstration
 *
 * Importée depuis demo-event-config.ts qui contient la configuration validée
 * avec des recettes réelles existant dans la base de recettes.
 */
export const DEMO_EVENTS_CONFIGS: DemoEventConfig[] = [DEMO_EVENT_CONFIG];

// =============================================================================
// UTILITAIRES DE DATE
// =============================================================================

/**
 * Trouve le prochain vendredi à partir d'aujourd'hui + offset en jours
 * @param offsetDays - Nombre de jours à ajouter avant de chercher le vendredi
 * @returns Date du prochain vendredi
 */
function getNextFutureDate(offsetDays: number = 0): Date {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + 7 + offsetDays); // Minimum 7 jours dans le futur

  // Trouver le vendredi suivant
  const dayOfWeek = targetDate.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7; // 5 = vendredi

  targetDate.setDate(targetDate.getDate() + daysUntilFriday);

  // Normaliser à minuit
  targetDate.setHours(0, 0, 0, 0);

  return targetDate;
}

/**
 * Ajoute des jours à une date
 * @param date - Date de départ
 * @param days - Nombre de jours à ajouter
 * @returns Nouvelle date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Extrait toutes les dates uniques (YYYY-MM-DD) d'un tableau d'EventMeal
 * @param meals - Tableau d'EventMeal
 * @returns Tableau de dates triées
 */
function extractAllDates(meals: EventMeal[]): string[] {
  const datesSet = new Set<string>();

  meals.forEach((meal) => {
    const dateOnly = meal.date.split("T")[0]; // Extraire YYYY-MM-DD
    datesSet.add(dateOnly);
  });

  return Array.from(datesSet).sort(); // Dates triées
}

/**
 * Slugifie une chaîne de caractères
 * @param text - Texte à slugifier
 * @returns Slug (kebab-case)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// GÉNÉRATION D'EVENTMEAL
// =============================================================================

/**
 * Génère un EventMeal à partir d'une configuration
 * @param baseDate - Date de base pour le calcul
 * @param config - Configuration du meal
 * @returns EventMeal complet avec toutes ses recipes
 */
async function generateEventMeal(
  baseDate: Date,
  config: DemoMeal,
): Promise<EventMeal> {
  // 1. Construire la date complète avec l'heure
  const [hours, minutes] = config.time.split(":");
  const mealDate = new Date(baseDate);
  mealDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // 2. Valider et récupérer les recipes (optionnel - le config a déjà toutes les données)
  // La configuration existante inclut déjà typeR et hasOwnPlatesNb
  const mealRecipes = await Promise.all(
    config.recipes.map(async (recipeConfig) => {
      // Vérifier que la recette existe dans RecipesStore
      const recipe = await recipesStore.getRecipeByUuid(
        recipeConfig.recipeUuid,
      );

      if (!recipe) {
        console.error(
          `[DemoEvents] Recipe not found: ${recipeConfig.recipeUuid}. Skipping.`,
        );
        return null;
      }

      // La configuration a déjà toutes les données nécessaires
      // Ensure hasOwnPlatesNb matches the optional type
      const hasOwnPlates = recipeConfig.hasOwnPlatesNb ?? false;
      const recipeObj: import("$lib/types/events.d").EventMealRecipe = {
        recipeUuid: recipeConfig.recipeUuid,
        plates: recipeConfig.plates,
        typeR: recipeConfig.typeR as RecettesTypeR,
      };
      if (hasOwnPlates) {
        recipeObj.hasOwnPlatesNb = hasOwnPlates;
      }
      return recipeObj;
    }),
  );

  // 3. Filtrer les recipes null (non trouvés)
  const validRecipes = mealRecipes.filter(
    (r): r is import("$lib/types/events.d").EventMealRecipe => r !== null,
  );

  if (validRecipes.length === 0) {
    throw new Error(
      `No valid recipes found for meal at day ${config.dayOffset}, ${config.time}`,
    );
  }

  // 4. Construire l'EventMeal complet
  return {
    id: crypto.randomUUID(),
    date: mealDate.toISOString(), // DateTime ISO 8601 complet
    guests: config.guests,
    recipes: validRecipes,
  };
}

// =============================================================================
// GÉNÉRATION D'ÉVÉNEMENT
// =============================================================================

/**
 * Génère un événement de démonstration complet
 * @param config - Configuration de l'événement
 * @param offsetDays - Décalage en jours (défaut: 0)
 * @returns EnrichedEvent complet
 */
export async function generateDemoEvent(
  config: DemoEventConfig,
  offsetDays: number = 0,
): Promise<EnrichedEvent> {
  console.log(`[DemoEvents] Generating event: ${config.name}`);

  // 1. Calculer les dates de l'événement
  // startDate est à minuit (00:00:00)
  const startDate = getNextFutureDate(offsetDays);
  // endDate doit inclure le dernier jour complet, donc on ajoute durationDays et on met à 23:59:59
  const endDate = addDays(startDate, config.durationDays - 1);
  endDate.setHours(23, 59, 59, 999);

  console.log(
    `[DemoEvents] Event dates: ${startDate.toISOString()} → ${endDate.toISOString()}`,
  );

  // 2. Générer tous les EventMeal
  const meals: EventMeal[] = [];

  for (const mealConfig of config.meals) {
    // Calculer la date du jour
    const dayDate = addDays(startDate, mealConfig.dayOffset);

    try {
      const meal = await generateEventMeal(dayDate, mealConfig);
      meals.push(meal);
    } catch (error) {
      console.error(`[DemoEvents] Error generating meal:`, error);
      // Continue with other meals
    }
  }

  // 3. Trier les meals par date chronologique
  meals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log(`[DemoEvents] Generated ${meals.length} meals`);

  // 4. Générer allDates (dates uniques YYYY-MM-DD)
  const allDates = extractAllDates(meals);

  console.log(
    `[DemoEvents] Event covers ${allDates.length} days: ${allDates.join(", ")}`,
  );

  // 5. Construire l'EnrichedEvent complet
  // Utiliser l'ID constant de l'event de démo
  const eventId = DEMO_EVENT_ID;

  // ✅ AJOUTER: Guest contributor
  const guestContributor: EventContributor = {
    id: "guest",
    name: "Visiteur",
    email: "guest@demo.local",
    status: "accepted",
    invitedAt: new Date().toISOString(),
    respondedAt: new Date().toISOString(),
  };

  const enrichedEvent: EnrichedEvent = {
    // Required fields from Models.Row
    $id: eventId,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],

    // Main fields
    name: config.name,
    description: config.description,
    status: "proposition" as MainStatus, // Mode démo utilise le statut standard
    dateStart: startDate.toISOString(),
    dateEnd: endDate.toISOString(),
    allDates: allDates,
    meals: meals, // ← Tableau d'objets EventMeal (PAS stringified)
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

  console.log(`[DemoEvents] Event generated: ${eventId}`);

  // 6. Valider l'événement généré
  validateDemoEvent(enrichedEvent);

  return enrichedEvent;
}

/**
 * Génère tous les événements de démonstration
 * Les événements sont espacés de 30 jours pour éviter les conflits de dates
 * @returns Tableau de tous les événements de démonstration
 */
export async function generateAllDemoEvents(): Promise<EnrichedEvent[]> {
  console.log(
    `[DemoEvents] Generating ${DEMO_EVENTS_CONFIGS.length} demo events`,
  );

  const events: EnrichedEvent[] = [];
  const DAYS_BETWEEN_EVENTS = 30; // Espacer les événements de 30 jours

  for (let i = 0; i < DEMO_EVENTS_CONFIGS.length; i++) {
    const config = DEMO_EVENTS_CONFIGS[i];
    const offsetDays = i * DAYS_BETWEEN_EVENTS;

    try {
      const event = await generateDemoEvent(config, offsetDays);
      events.push(event);
    } catch (error) {
      console.error(
        `[DemoEvents] Error generating event "${config.name}":`,
        error,
      );
      // Continue with other events
    }
  }

  console.log(
    `[DemoEvents] Generated ${events.length}/${DEMO_EVENTS_CONFIGS.length} events successfully`,
  );

  return events;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Valide la cohérence d'un événement de démonstration
 * @param event - Événement à valider
 * @throws Error si la validation échoue
 */
export function validateDemoEvent(event: EnrichedEvent): void {
  console.log(`[DemoEvents] Validating event: ${event.$id}`);

  const errors: string[] = [];

  // 1. Vérifier le statut (doit être "proposition" comme un event normal)
  if (event.status !== "proposition") {
    errors.push(`Event status should be "proposition", got: ${event.status}`);
  }

  // 2. Vérifier que allDates est cohérent avec les meals
  const mealDatesSet = new Set(event.meals.map((m) => m.date.split("T")[0]));
  const allDatesSet = new Set(event.allDates || []);

  const missingDates = Array.from(mealDatesSet).filter(
    (d) => !allDatesSet.has(d),
  );
  if (missingDates.length > 0) {
    errors.push(`Dates missing in allDates: ${missingDates.join(", ")}`);
  }

  const extraDates = Array.from(allDatesSet).filter(
    (d) => !mealDatesSet.has(d),
  );
  if (extraDates.length > 0) {
    errors.push(`Extra dates in allDates (no meals): ${extraDates.join(", ")}`);
  }

  // 3. Vérifier que dateStart/dateEnd englobent tous les meals
  if (!event.dateStart || !event.dateEnd) {
    errors.push("Event dateStart and dateEnd must be defined");
  } else {
    const start = new Date(event.dateStart).getTime();
    const end = new Date(event.dateEnd).getTime();

    for (const meal of event.meals) {
      const mealTime = new Date(meal.date).getTime();
      if (mealTime < start || mealTime > end) {
        errors.push(
          `Meal "${meal.id}" date (${meal.date}) is outside event range (${event.dateStart} → ${event.dateEnd})`,
        );
      }
    }
  }

  // 4. Vérifier que tous les meals ont au moins une recipe
  for (const meal of event.meals) {
    if (!meal.recipes || meal.recipes.length === 0) {
      errors.push(`Meal "${meal.id}" has no recipes`);
    }
  }

  // Report errors
  if (errors.length > 0) {
    throw new Error(
      `Demo event validation failed:\n  - ${errors.join("\n  - ")}`,
    );
  }

  console.log(`[DemoEvents] ✅ Validation passed for event: ${event.$id}`);
}

// =============================================================================
// TESTING HELPER
// =============================================================================

/**
 * Fonction helper pour tester la génération d'événements démo
 * À utiliser dans la console du navigateur pour développement
 *
 * Usage dans la console:
 * ```javascript
 * import { testGenerateDemoEvents } from './src/lib/data/demo-events.ts';
 * await testGenerateDemoEvents();
 * ```
 */
export async function testGenerateDemoEvents(): Promise<void> {
  console.log("=== Demo Events Test ===");

  try {
    const events = await generateAllDemoEvents();

    console.log(`✅ Generated ${events.length} events`);

    events.forEach((event, index) => {
      console.log(`\nEvent ${index + 1}: ${event.name}`);
      console.log(`  ID: ${event.$id}`);
      console.log(`  Status: ${event.status}`);
      console.log(`  Dates: ${event.dateStart} → ${event.dateEnd}`);
      console.log(`  All dates: ${event.allDates?.join(", ") ?? "N/A"}`);
      console.log(`  Meals: ${event.meals.length}`);
      console.log(`  Contributors: ${event.contributors.length}`);
      console.log(`  Todos: ${event.todos.length}`);

      // Détail des meals
      event.meals.forEach((meal, mealIndex) => {
        console.log(
          `    Meal ${mealIndex + 1}: ${new Date(meal.date).toLocaleString()} - ${meal.guests} guests - ${meal.recipes.length} recipes`,
        );
      });
    });

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}
