import os
import json
import re
import unicodedata
from pathlib import Path

# Utilitaire pour slugifier un titre
def slugify(s):
    # Supprimer les accents
    s = unicodedata.normalize('NFKD', s)
    s = s.encode('ascii', 'ignore').decode('ascii')
    # Supprimer les apostrophes droites et typographiques
    s = s.replace("'", "").replace("’", "")
    # Remplacer tout ce qui n'est pas alphanumérique par un tiret
    s = re.sub(r'[^a-z0-9]+', '-', s.lower().strip())
    return s.strip('-')

# Chemins
BASE_DIR = os.path.dirname(__file__)
DATA_FILE = os.path.join(BASE_DIR, '../data/ingredients/ingredients.json')
OUT_DIR = os.path.join(BASE_DIR, '../content/ingredients')

# Crée le dossier de sortie si besoin
os.makedirs(OUT_DIR, exist_ok=True)

def to_yaml(data):
    """Convertit un dict en yaml simple (pour l'entête frontmatter Hugo)"""
    lines = []
    for k, v in data.items():
        if isinstance(v, list):
            lines.append(f'{k}:')
            for item in v:
                lines.append(f'  - "{item}"')
        elif isinstance(v, bool):
            lines.append(f'{k}: {str(v).lower()}')
        else:
            lines.append(f'{k}: "{v}"')
    return '\n'.join(lines)

def main():
    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)
    for ing in data['ingredients']:
        title = ing.get('title', 'ingredient')
        slug = slugify(title)
        ing_dir = os.path.join(OUT_DIR, slug)
        os.makedirs(ing_dir, exist_ok=True)
        # Préparer le frontmatter YAML
        frontmatter = to_yaml(ing)
        md = f"""---
{frontmatter}
---\n"""
        # Écrire le fichier index.md
        with open(os.path.join(ing_dir, 'index.md'), 'w', encoding='utf-8') as out:
            out.write(md)
    print(f"{len(data['ingredients'])} fichiers markdown créés dans {OUT_DIR}")

if __name__ == '__main__':
    main()
