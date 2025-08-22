#!/usr/bin/env python3

import yaml
import os
import glob
import sys
from collections import defaultdict

# Liste des ingrédients recherchés (ceux qui ont des itypes différents)
TARGET_INGREDIENTS = {
    "Ail",
    "Crème florette",
    "Gingembre",
    "Jus de citron",
    "Lait de cajou",
    "Levure chimique",
    "Noix de coco râpée",
    "Oignon",
    "Pâte feuilletée",
    "Tofu ferme",
    "Vinaigre de cidre",
    "Yaourt nature"
}

def find_duplicate_ingredients_in_recipes(recipes_dir):
    """
    Parcourt les fichiers de recettes, analyse leur YAML et cherche les ingrédients ciblés.
    Retourne une structure : {ingredient_name: {category_name: [filepath1, filepath2, ...]}}
    """
    # Utilisation de defaultdict pour simplifier l'ajout d'éléments
    # found_ingredients = {ingredient_name: {category_name: set(filepaths)}}
    found_ingredients = defaultdict(lambda: defaultdict(set))

    search_pattern = os.path.join(recipes_dir, '**', '*.md')
    recipe_files = glob.glob(search_pattern, recursive=True)

    for filepath in recipe_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if content.startswith('---'):
                    end_of_front_matter = content.find('---', 3)
                    if end_of_front_matter != -1:
                        yaml_content = content[3:end_of_front_matter]
                        data = yaml.safe_load(yaml_content)

                        if data and 'ingredients' in data:
                            recipe_ingredients = data['ingredients']
                            for category, items in recipe_ingredients.items():
                                if isinstance(items, list):
                                    for item in items:
                                        if isinstance(item, dict) and 'title' in item:
                                            ingredient_title = item['title']
                                            if ingredient_title in TARGET_INGREDIENTS:
                                                # Ajout à notre structure: ingredient -> category -> filepath
                                                found_ingredients[ingredient_title][category].add(filepath)
        except Exception as e:
            print(f"Erreur lors du traitement du fichier {filepath}: {e}", file=sys.stderr)

    return found_ingredients

if __name__ == "__main__":
    RECIPES_DIRECTORY = 'enka-cookbook-site/content/recettes'

    if not os.path.isdir(RECIPES_DIRECTORY):
        print(f"Le répertoire des recettes '{RECIPES_DIRECTORY}' n'a pas été trouvé.", file=sys.stderr)
        sys.exit(1)

    ingredients_data = find_duplicate_ingredients_in_recipes(RECIPES_DIRECTORY)

    if not ingredients_data:
        print("Aucun des ingrédients recherchés n'a été trouvé dans les recettes.")
    else:
        print("Ingrédients recherchés trouvés dans les recettes :\n")
        # Trier les ingrédients par ordre alphabétique
        for ingredient_name in sorted(ingredients_data.keys()):
            categories = ingredients_data[ingredient_name]
            print(f"{ingredient_name}")

            # Trier les catégories par ordre alphabétique
            for category_name in sorted(categories.keys()):
                filepaths = categories[category_name]
                print(f"  Dans la catégorie '{category_name}':")

                # Trier les noms de fichiers par ordre alphabétique
                for filepath in sorted(list(filepaths)): # Convertir le set en liste pour le tri
                    print(f"    - {filepath}")
            print("") # Ligne vide pour séparer les ingrédients
