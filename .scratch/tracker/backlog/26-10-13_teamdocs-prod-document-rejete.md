> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `soon` · Source: run 26-10-13 (T08) · Ancre: scripts_dev/migrate.ts / pocketbase schema

- teamdocs prod : 1 document rejete (content > 5000 chars) — toujours absent apres reset+re-import (T08, mesure 14-10 : 21 docs, 6a3ff71f0008dcb17ba5 absent) : le filtre est dans le transform/import, pas un simple re-import. Localiser ou la ligne saute, puis re-importer (schema live : content max: 0).
