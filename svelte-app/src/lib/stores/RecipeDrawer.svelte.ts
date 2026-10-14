class RecipeDrawer {
  isOpen = $state(false);
  recipeId = $state<string | null>(null);
  servings = $state(0);

  openRecipeDrawer(recipeId: string, servings: number): void {
    this.recipeId = recipeId;
    this.servings = servings;
    this.isOpen = true;
  }

  closeRecipeDrawer(): void {
    this.isOpen = false;
  }
}

export const recipeDrawer = new RecipeDrawer();
