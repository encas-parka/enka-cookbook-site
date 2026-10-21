> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `conditional` · Source: session 26-10-22 (diagnostic boucle sync CreateLoanModal) · Ancre: svelte-app/src/lib/db-sync/pb-collection.ts

- Garde de contenu sur l'upsert delta : dans `runFetch`, comparer le record fetché à la copie locale et sauter l'écriture s'ils sont identiques (égalité d'octets, PAS sur `updated` seul). Supprime l'écriture Dexie + la passe réactive redondantes du replay frontière `>=` à chaque revalidation (visibilitychange, reconnect SSE — le GET, lui, reste inévitable sous le contrat inclusif). Ne rouvre pas le trou des mutations à même milliseconde : le record fetché porte de toute façon l'état serveur le plus récent — l'objection de l'ADR 0001 vise les gardes sur `updated` seul. Coût : une comparaison d'égalité dans le chemin chaud + amendement de l'ADR 0001 (contrat « upsert inconditionnel » épinglé, test `pb-sync-scoped-cursor.test.ts`) + choix d'une égalité profonde (champ à champ vs hash).
Question user: 
→ une modification à la meme miliseconde sur un meme record est elle crédible ? Comparaison des id uniquement envisageable ?

→ lorsqu'une resync de verif get le meme record a la meme miliseconde, ne serait il pas envisageable d'avancer le curseur d'une miliseconde ?
 
