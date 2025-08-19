import os
import json

# Dossier contenant les fichiers JSON d'ingrédients
DATA_DIR = os.path.join(os.path.dirname(__file__), '../data/ingredients')
ITYPES = {
    'frais.json': 'frais',
    'legumes.json': 'legumes',
    'lof.json': 'lof',
    'sucres.json': 'sucres',
    'epices.json': 'epices',
    'sec.json': 'sec',
    'animaux.json': 'animaux',
    'autres.json': 'autres',
}

# Fichier de sortie
OUTPUT_FILE = os.path.join(DATA_DIR, 'ingredients.json')

def merge_ingredients():
    merged = []
    for fname, itype in ITYPES.items():
        fpath = os.path.join(DATA_DIR, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, encoding='utf-8') as f:
            data = json.load(f)
            for ing in data.get('ingredients', []):
                ing = dict(ing)  # copy
                ing['itype'] = itype
                merged.append(ing)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump({'ingredients': merged}, f, ensure_ascii=False, indent=2)
    print(f"Fusion terminé. {len(merged)} ingrédients écrits dans {OUTPUT_FILE}")

if __name__ == '__main__':
    merge_ingredients()
