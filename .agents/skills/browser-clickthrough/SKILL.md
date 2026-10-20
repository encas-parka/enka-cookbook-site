---
name: browser-clickthrough
description: Mener une passe de click-through dans un navigateur piloté par agent — établir la checklist de gate depuis le travail livré (diff, spec, tickets), vérifier les parcours réels d'une app web et rendre un rapport de bugs sourcé. Utiliser dès qu'il s'agit de valider une app à l'écran plutôt qu'en tests, et en particulier juste après une session d'implémentation pour monter la passe qui prouve le changement dans l'UI réelle : « passe navigateur », « click-through », « recette manuelle », « gate de sortie », « vérifier les parcours », « rejouer la checklist avant release », « on vient de livrer ça, on vérifie à l'écran ».
---

# Click-through piloté par agent

Un click-through est une **campagne de preuve**, pas une démonstration : chaque case cochée doit pouvoir être défendue devant quelqu'un qui demandera « tu l'as vu où ? ». La sortie n'est pas « ça marche » mais un document de gate où chaque verdict porte sa source.

Trois convictions gouvernent le reste :

- **Aucun verdict sans oracle.** L'écran ment régulièrement (cache, délai, keep-alive). Ce qui tranche est ailleurs : API, base, ou logs. Un constat qui n'a pas d'oracle est une impression, à écrire comme telle.
- **Le pilote est un instrument imparfait.** Une part des « bugs » sera en réalité la limite du pilotage. Confondre les deux coûte plus cher que rater un bug : on fait corriger du code sain.
- **La passe est longue et sera interrompue.** Elle survit à la compaction seulement si l'état est écrit au fil de l'eau, dans le fichier de gate, pas dans la conversation.

## 1. Cadrer avant de cliquer

Réunir, en une fois :

- Le **document de gate** (sections numérotées, une ligne = une action vérifiable à l'écran) et son emplacement. S'il n'existe pas encore, on le dérive du travail livré — voir juste après : sans lui, la passe n'a pas de fin.
- Les **comptes** de test avec leurs mots de passe, et lesquels sont réellement membres de quoi.
- La **stratégie multi-session** : deux origines du même serveur suffisent souvent (`localhost:PORT` et `[::1]:PORT` → deux `localStorage`, deux sessions). Voir aussi `references/driver-traps.md` § Origines.
- Le **périmètre exclu** : ce qui relève du pipeline, des tests automatisés ou de l'Admin UI et ne doit pas être re-testé à la main.

Écrire ces réglages en tête du fichier de gate : c'est ce qu'un repreneur lit en premier après une coupure.

### Dériver le gate du travail livré

Quand la passe suit une session d'implémentation, le gate ne se reprend pas d'un
document existant : il se dérive du changement. Le risque dominant n'est pas que
le correctif ne marche pas — c'est qu'il ait cassé un parcours voisin, ou qu'il
ne soit prouvé que sous un seul rôle.

Lire le diff depuis un point fixe choisi avant de commencer (dernier commit, tag
ou merge-base), plus la spec ou les tickets d'origine. Chaque changement se
traduit en lignes de gate, dans quatre familles :

- **Le nominal** — le parcours que le changement devait rendre possible, formulé
  comme une action et un attendu observable, sans vocabulaire d'implémentation.
- **Le voisin** — ce qui partage la même donnée, le même composant ou le même
  état : la liste qui affiche l'entité modifiée, le formulaire jumeau, l'écran
  qui agrège. C'est là que vivent les régressions silencieuses.
- **Le rôle** — le même parcours vu par un autre compte : membre, invité, non
  membre, propriétaire. Un changement de règle d'accès se prouve dans les deux
  sens : celui qui doit voir, et celui qui ne doit pas.
- **L'état** — données déjà présentes ou absentes, cache chaud ou froid,
  formulaire incomplet, erreur serveur. Les boutons et les verrous se vérifient
  dans ces états-là, pas sur une base neuve.

Le repère de fin est chiffrable : **aucune entrée du diff n'est sans ligne de
gate qui la prouve**, et chaque ligne a un oracle ou une raison écrite de ne pas
en avoir. Une passe post-implémentation reste plus courte qu'une recette
complète — les surfaces du diff et leur voisinage immédiat, le parcours général
seulement si le temps le permet.

## 2. Préparer l'environnement, et vérifier qu'il répond

Deux vérifications distinctes, souvent confondues :

- **Le serveur tourne-t-il ?** Pour le frontend, la seule preuve qui compte est que *le navigateur* affiche la page.
- **Mon shell voit-il ce serveur ?** Pas forcément. Un shell confiné (sandbox, conteneur) peut n'avoir aucune route vers la loopback de l'hôte : `curl` échoue alors que le navigateur charge parfaitement. Un `curl` en échec n'est donc **pas** une preuve que le serveur est arrêté.

Sonde rapide si un doute existe : servir un fichier trivial depuis le shell, puis l'ouvrir dans le navigateur. Si le navigateur renvoie une erreur de chargement, le shell est isolé — demander à l'humain de lancer les serveurs, et ne plus interpréter les échecs réseau du shell.

### Logs serveur

Quand un backend tourne sur l'hôte, demander sa sortie consolidée dans un
fichier lisible plutôt que dans un terminal que l'agent ne voit pas :

```bash
mkdir -p /tmp/opencode
bun run dev:all > /tmp/opencode/dev.log 2>&1
```

Un orchestrateur qui préfixe ses sorties (`[PB]`, `[VITE]`) rend le fichier
attribuable ; sans préfixe, demander un fichier par service.

Activer le mode verbeux du serveur s'il en propose un — PocketBase, par exemple,
n'imprime ses requêtes et ses SQL qu'avec `--dev`. Sans ce drapeau, le log ne
contient que la bannière de démarrage : croire qu'on tient un oracle alors qu'on
n'a que la ligne « server started » est pire que pas de log du tout.

Ce que les logs apportent, et que le client ne dira jamais : le statut réel d'un
hook applicatif, la règle qui a refusé un `403`, l'erreur d'une fonction serveur.
Ce qu'ils n'apportent pas : les bugs d'affichage, de calcul ou de synchronisation
côté client.

**Les lire par interrogation ciblée, jamais en entier.** Un backend verbeux écrit
des milliers de lignes par minute ; le fichier est un index, pas un document.

```bash
grep -E "ERROR|panic|400|403|send-emails" /tmp/opencode/dev.log | tail -40
```

### Une base de travail jetable

Une passe qui mute des données de référence (suppressions en cascade, migrations
de schéma, règles d'accès) mérite une base à elle. Le coût habituel d'une
instance neuve est le **seed** — comptes, équipes, contenu ; le clonage
l'élimine.

Cloner plutôt que recréer, et cloner proprement : une base SQLite en WAL ne se
copie pas avec `cp`, `data.db` seul pouvant être incohérent avec son journal.
`sqlite3 data.db ".backup destination.db"` fonctionne à chaud.

Puis pointer l'application vers le clone, sans toucher au code : la plupart des
clients lisent leur URL dans une variable d'environnement (`VITE_POCKETBASE_URL`,
`API_URL`…), et le serveur accepte son répertoire de données et son port en
arguments (`--dir`, `--http`).

À faire quand un résidu peut fausser l'observation : un verrou resté posé, un
compte factice dans une liste d'invités, une entité mutée par une passe
précédente. Sur une passe de simple lecture, la base de travail suffit —
l'isolation n'est pas une fin en soi.

## 3. Fixer les fixtures par API, et les noter

Certaines situations sont inatteignables au pilotage (une valeur exigeant un `select` natif, une donnée en état précis, un compte non invitable). Les créer par API — avec un compte administrateur — est légitime **à condition de le déclarer** : la ligne du gate dit « posé via API superuser », jamais « vérifié dans l'UI ».

Tenir l'inventaire de ce qui a été écrit (id + champ + valeur) dans une note de clôture du fichier de gate. La décision de nettoyer appartient à l'humain : sur un projet dont la base sera rejouée depuis la prod, nettoyer est du travail perdu.

## 4. Passer par tranches, avec retour humain

Une **tranche** = une ou deux sections du gate. Après chaque tranche : rapport court (coché / partiel / bloqué + les constats nouveaux), puis attendre le feu vert. Ce découpage n'est pas protocolaire — c'est ce qui permet à l'humain de corriger une interprétation avant qu'elle contamine dix sections, et de couper court si la passe part dans une mauvaise direction.

Avant de rapporter, relire ses propres constats en se demandant : « est-ce que je peux le prouver en trois lignes ? ».

## 5. Trancher chaque item : quatre verdicts, pas deux

Une checklist binaire pousse au mensonge. Quatre verdicts, tous écrits dans le fichier :

| Verdict | Signe | Ce qu'on écrit |
| --- | --- | --- |
| **Coché** | Fait, prouvé, avec un oracle | la preuve en une ligne |
| **Partiel** | Le chemin principal passe, un sous-cas échoue ou n'est pas atteignable | ce qui passe / ce qui ne passe pas, et pourquoi |
| **Bloqué pilote** | L'UI refuse le pilotage (sélecteur natif, dialogue système) | la limite nommée + le contournement tenté |
| **Obsolète** | La checklist décrit une route, un composant ou une feature qui n'existe pas | la réalité du code (fichier:ligne), item à reformuler |

Décocher honnêtement est un résultat, pas un échec : une case fausse coûte une régression en prod.

**La règle d'oracle** : pour tout constat négatif, croiser au moins deux sources. L'écran dit « aucun document » — l'API dit-elle la même chose ? La base ? Un écart UI/serveur est un bug ; un accord des deux est un état légitime ; un refus serveur est une règle.

## 6. Consigner au fil de l'eau

Le fichier de gate est la mémoire de la passe, pas son compte rendu final. Écrire après **chaque** tranche, jamais « à la fin » :

- la case et son annotation (page, action, attendu / obtenu, console) ;
- les problèmes numérotés (`P1`, `P2`…) avec **cause** et `fichier:ligne` dès qu'elle est trouvée — un rapport sans cause oblige le suivant à refaire l'enquête ;
- les observations (`O1`, `O2`…) : ce qui intrigue sans être un bug ;
- la date de la passe dans les annotations : une case cochée il y a trois mois n'a pas la même valeur.

Une passe interrompue doit laisser un document qu'un inconnu peut reprendre sans rien demander.

## 7. Clore

- Passer le build si le gate le demande, et lire le log (chercher `error`/`warn`, pas seulement le code de sortie).
- Compter les cases : `cochés / total` en tête de fichier, avec la liste de ce qui reste et *pourquoi* il reste.
- Séparer nettement : bugs constatés (décochés exprès), limites du pilote, items obsolètes à reformuler.
- Rendre l'inventaire des artefacts de test et laisser l'humain décider du nettoyage.

## Les faux positifs à connaître

Ce sont les pièges qui font écrire un bug là où il n'y en a pas. La liste détaillée, avec la manière de trancher chacun, est dans `references/verdict-traps.md` — la lire avant de qualifier un constat suspect. Les cinq plus fréquents :

1. **État vide pendant le chargement** — un écran « aucun élément » avant l'arrivée des données est souvent un délai, pas une absence. Attendre, re-snapshoter, puis recharger.
2. **Contenu résiduel de la page précédente** — après une navigation, un snapshot peut encore montrer l'ancienne route (keep-alive). Le texte périmé n'est pas un bug d'affichage.
3. **Saisie remplacée par le pilote** — taper dans un éditeur riche (`contenteditable`) remplace tout le contenu. Ce n'est pas l'app qui écrase : c'est l'instrument.
4. **Bouton désactivé** — un bouton `disabled` peut être le comportement correct (verrou détenu par un autre, formulaire incomplet). Vérifier l'intention avant de crier au blocage.
5. **« Le rechargement ne corrige rien, donc c'est un bug de cache »** — parfois c'est pire : un cache local qui ne se rafraîchit *jamais* (sync incrémentale + curseur avancé). L'API qui renvoie la donnée alors que l'UI ne l'a pas est la signature à chercher.

## Les limites du pilote

`references/driver-traps.md` contient le catalogue complet (onglets et identifiants, sélecteurs, `select` natifs, `confirm()`, délais de démarrage, origines multiples) avec les contournements qui marchent. À lire **avant** la première tranche, pas après le premier échec : la plupart de ces pièges se préviennent.

## Ce que la skill ne fait pas

Elle ne corrige rien pendant la passe. Un gate qui se transforme en session de débogage perd sa valeur : on ne sait plus ce qui a été observé et ce qui a été réparé en route. Les constats se documentent, les corrections viennent après, sur décision explicite.
