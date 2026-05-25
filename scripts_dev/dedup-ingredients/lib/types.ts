export interface CatalogIngredient {
  n: string;
  t: string;
  u: string;
  pF?: boolean;
  a?: string[];
}

export interface RecipeIngredient {
  uuid: string;
  name: string;
  originalQuantity: number;
  originalUnit: string;
  normalizedQuantity: number;
  normalizedUnit: string;
  comment: string;
  allergens: string[];
  type: string;
  pF?: boolean;
  pS?: boolean;
}

export interface RecipeDocument {
  title: string;
  ingredients: string[];
  $id: string;
  $updatedAt: string;
  $createdAt: string;
  $databaseId: string;
  $collectionId: string;
  [key: string]: unknown;
}

export interface MergeEntry {
  winner: {
    uuid: string;
    name: string;
    type: string;
    a?: string[];
    pF?: boolean;
  };
  losers: {
    uuid: string;
    name: string;
    type: string;
    a?: string[];
  }[];
  reason: string;
}

export interface MergePlan {
  merges: MergeEntry[];
  meta: {
    createdBy: string;
    date: string;
    totalMerges: number;
  };
}
