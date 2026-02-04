/**
 * Types for the Event Poster components
 */

import type { EnrichedEvent } from "$lib/types/events.d";

export interface PosterConfig {
  showDate: boolean;
  showHoraire: boolean;
  showDescription: boolean;
  showCategories: boolean;
  showRecipes: boolean;
  showRegimes: boolean;
  showAllergens: boolean;
  showIngredients: boolean;
  catPageBreak: boolean;
  dateByPageBreak: boolean;
  messageTop: string;
  messageBottom: string;
  fontDate: string;
  fontSizeDate: number;
  boldDate: boolean;
  italicDate: boolean;
  fontHoraire: string;
  fontSizeHoraire: number;
  boldHoraire: boolean;
  italicHoraire: boolean;
  fontCat: string;
  fontSizeCat: number;
  boldCat: boolean;
  italicCat: boolean;
  fontRecettes: string;
  fontSizeRecettes: number;
  boldRecettes: boolean;
  italicRecettes: boolean;
  fontDesc: string;
  fontSizeDesc: number;
  boldDesc: boolean;
  italicDesc: boolean;
  fontRegimes: string;
  fontSizeRegimes: number;
  boldRegimes: boolean;
  italicRegimes: boolean;
  fontAlert: string;
  fontSizeAlert: number;
  boldAlert: boolean;
  italicAlert: boolean;
  fontIng: string;
  fontSizeIng: number;
  boldIng: boolean;
  italicIng: boolean;
  fontTop: string;
  fontSizeTop: number;
  boldTop: boolean;
  italicTop: boolean;
  fontBottom: string;
  fontSizeBottom: number;
  boldBottom: boolean;
  italicBottom: boolean;
  centerVertical: boolean;
}

export interface SavedPosterConfig {
  id: string; // uuid
  name: string; // "Version du DD/MM/YYYY à HH:mm"
  config: PosterConfig;
  createdAt: string;
}

export interface PosterConfigContainer {
  current: PosterConfig;
  versions: SavedPosterConfig[];
}

export interface GroupedMeals {
  dateKey: string;
  date: Date;
  horaire: string;
  meals: Array<{
    id: string;
    date: Date;
    guests: number;
    recipes: Array<{
      recipeUuid: string;
      plates: number;
      typeR: string;
      hasOwnPlatesNb?: boolean;
    }>;
  }>;
}

export interface RecipeCardProps {
  recipeUuid: string;
  plates: number;
  typeR: string;
  recipeKey: string;
  config: PosterConfig;
  visible: boolean;
  name: string;
  onToggle: (recipeKey: string) => void;
  onStartEdit: (recipeKey: string) => void;
  onFinishEdit: () => void;
  onUpdateName: (recipeKey: string, newName: string) => void;
  isEditing: boolean;
}

export interface MealPosterProps {
  dateKey: string;
  date: Date;
  horaire: string;
  meals: GroupedMeals["meals"];
  config: PosterConfig;
  sectionId: string;
  sectionsToPrint: Record<string, boolean>;
  recipeVisibility: Record<string, boolean>;
  recipeNames: Record<string, string>;
  editingRecipe: string | null;
  onPrintThis: (sectionId: string) => void;
  onToggleRecipe: (recipeKey: string) => void;
  onStartEditRecipe: (recipeKey: string) => void;
  onFinishEditRecipe: () => void;
  onUpdateRecipeName: (recipeKey: string, newName: string) => void;
}
