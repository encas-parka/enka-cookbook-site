# /dev/null/update_ingredients.py
import json

def update_ingredients(filepath):
    """
    Modifie le fichier ingredients.json pour corriger les itypes
    et supprimer les doublons d'ingrédients avec des itypes incorrects.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Définition des corrections à apporter
    corrections = {
        "Crème florette": "frais",
        "Gingembre": "legumes",
        "Gingembre bio": "legumes",
        "Jus de citron": "sucres",
        "Lait de cajou": "lof",
        "Levure chimique": "lof",
        "Noix de coco râpée": "sucres",
        "Oignon": "legumes",
        "Pâte feuilletée": "frais",
        "Tofu ferme": "frais",
        "Vinaigre de cidre": "epices",
        "Yaourt nature": "frais",
    }

    # Création d'un dictionnaire pour stocker les ingrédients corrigés
    # et identifier les doublons potentiels.
    # La clé sera le titre de l'ingrédient, et la valeur sera l'ingrédient lui-même.
    processed_ingredients = {}

    for ingredient in data.get("ingredients", []):
        title = ingredient.get("title")
        current_itype = ingredient.get("itype")

        if not title:
            continue

        # Si le titre est dans nos corrections
        if title in corrections:
            target_itype = corrections[title]

            # Si l'itype actuel n'est pas le bon, on le corrige
            if current_itype != target_itype:
                ingredient["itype"] = target_itype

            # On ajoute l'ingrédient corrigé ou déjà correct à notre dictionnaire de traitement
            # Si un ingrédient avec le même titre existe déjà, on le remplace
            # car on privilégie celui qui a le bon itype (ou celui qui a été corrigé).
            processed_ingredients[title] = ingredient
        else:
            # Si le titre n'est pas concerné par les corrections, on l'ajoute tel quel
            # Sauf s'il existe déjà dans processed_ingredients (doublon non lié aux corrections)
            if title not in processed_ingredients:
                processed_ingredients[title] = ingredient

    # Reconstruction de la liste d'ingrédients à partir du dictionnaire traité
    # Cela garantit que seuls les ingrédients uniques (ou les versions corrigées) sont conservés.
    data["ingredients"] = list(processed_ingredients.values())

    # Écriture du fichier modifié
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Chemin vers votre fichier ingredients.json
file_path = 'data/ingredients/ingredients.json'
update_ingredients(file_path)

print(f"Le fichier {file_path} a été mis à jour avec succès.")
