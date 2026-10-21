> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: audit delta-sync 26-10-20 · Ancre: pocketbase/pb_migrations/* (teamdocs)

- Split teamdocs -> team_docs + event_docs : la collection porte deux axes de grant (listRule a 4 clauses) alors que la donnee est 17/23 event-seule, 5/23 team-seule, 0 les deux — split sans cas ambigu. Motivation : simplification des permissions. Vehicule : pipeline migrate.ts + schema PB + SPA dans le meme train, fenetre post-Phase-1 / pre-cutover. A embarquer dans le meme train : retrait de la clause ownerUser de la regle materiel + ignorer les ~10 orphelins sans teamId ni ownerUser a l'import. Detail : .scratch/handoff/26-10-20_split-teamdocs-event-docs.md.
