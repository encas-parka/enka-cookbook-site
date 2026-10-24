> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

# Flake : `events-store-ensure-event` échoue en suite complète, vert isolé

Tag: debt · Urgence: conditional · Source: run 26-10-22 dossier emprunt, itération 6 · Ancre: svelte-app/src/lib/stores/__tests__/events-store-ensure-event.test.ts

En suite vitest complète, « cache chaud : aucun appel réseau » échoue par
intermittence : le spy `collection` enregistre un appel `events` que le test
interdit. Le log du run montre la cause probable — une réinitialisation du
client PocketBase **pendant** le test (`[pb] PocketBase client initialized →
http://localhost:8090` après la sync), signature d'une pollution d'état
module entre fichiers de test partagés dans un même worker.

Isolé (`bunx vitest run <fichier>`) : 5/5 vert, de façon reproductible.

Historique : ce fichier avait déjà basculé une fois (run itération 1 du
26-10-22, « WIP étranger »), puis repassé vert — le caractère intermittent
n'est pas nouveau.

Piste : identifier quel(s) fichier(s) mutent le client/singleton partagé
(initialisation à une autre baseURL, reset de module) et cloisonner via
`vi.resetModules()` + import dynamique dans le setup de chaque fichier, ou
isoler le worker (`maxConcurrency` / pool). Tant que c'est ouvert, un échec
de CE test seul en suite complète se traite par un run isolé avant tout
diagnostic.
