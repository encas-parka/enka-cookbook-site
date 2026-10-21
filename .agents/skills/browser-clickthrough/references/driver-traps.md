# Pièges du pilote navigateur

Chaque entrée suit le même schéma : le symptôme, pourquoi ça arrive, ce qu'on
fait à la place. La règle de lecture : **un échec de pilotage n'est pas un
constat applicatif**. Il se nomme et se contourne ; s'il résiste, il devient
une ligne « bloqué pilote » dans le gate.

## Onglets et identifiants

**Symptôme** — un clic n'a aucun effet, ou agit sur une autre page ; un snapshot
revient vide ; le driver affiche soudain l'Admin UI d'un autre outil.

**Pourquoi** — ouvrir une URL crée un onglet et renvoie un identifiant
(`tabId`). Les appels sans identifiant ciblent « l'onglet actif », et cet actif
dérive dès qu'un onglet est créé, fermé ou que le focus change. Les
identifiants eux-mêmes changent à chaque ouverture.

**Recette**

- Conserver les identifiants dans des variables nommées (`tabA`, `tabB`) et
  passer `tabId` **à chaque** appel : clic, saisie, snapshot.
- Ne jamais supposer qu'un `tabId` capturé plus tôt est encore valide après une
  nouvelle ouverture.
- Après un `open`, faire un snapshot _avant_ d'agir : on découvre parfois que la
  page n'a pas fini de charger, ou qu'on regarde le mauvais onglet.
- Les onglets s'accumulent et alourdissent le navigateur : garder deux ou trois
  onglets vivants, réutiliser plutôt que rouvrir.

## Sélecteurs

**Symptôme** — un clic « réussit » (`ok: true`) mais l'action attendue ne se
produit pas ; pire, une autre action se déclenche (confirmer un objet au lieu
d'ajouter un champ).

**Pourquoi** — les sélecteurs structurels (`div:nth-of-type(3) > div > button`)
sont relatifs et ne sont pas ancrés à la racine : ils peuvent résoudre sur un
autre sous-arbre que celui qu'on visait, surtout dans une page à plusieurs
cartouches identiques.

**Recette**

- Préférer, dans cet ordre : `#id`, `[aria-label="…"]`, une classe unique
  (`button.btn-accent`), le texte exact, puis le placeholder.
- Pour un texte ambigu (« Ajouter » présent plusieurs fois), viser le libellé
  complet et unique (« Inviter (1) »).
- **Toujours lire le champ `label` du retour de clic** : c'est le seul signal
  qu'on a cliqué ce qu'on croyait. Sans cette lecture, une dérive passe
  inaperçue et fausse le verdict.
- Si un sélecteur dérive, changer de stratégie plutôt que l'affiner : un
  sélecteur structurel qui a dérivé une fois dérivera encore.

## `select` natif dans un framework réactif

**Symptôme** — cliquer une option d'une liste déroulante ne change rien ; la
saisie dans le `select` est refusée (« n'est pas un champ texte »).

**Pourquoi** — le composant écoute l'événement `change`. Un clic synthétique sur
une option native ne le déclenche pas de façon fiable : l'application ne voit
jamais la sélection.

**Recette**

- Chercher une voie parallèle dans l'UI : boutons radio, chips, « ajout rapide »,
  menu alternatif. Beaucoup d'apps en offrent une.
- Sinon, poser la valeur par API (voir la skill, § Fixtures) en le déclarant, ou
  écrire « bloqué pilote : `select` natif ».
- Ne jamais en conclure que le `select` est cassé côté produit : c'est
  l'instrument qui ne sait pas le manipuler.

## Dialogues système

**Symptôme** — une action destructrice s'annule toute seule, ou le parcours
nominal ne se termine jamais.

**Pourquoi** — `confirm()`/`alert()`/`prompt()` sont des dialogues du navigateur,
hors du DOM : le pilote les rejette par défaut. On ne peut donc jouer que la
branche « annuler ».

**Recette**

- Chercher si l'app possède sa propre modale de confirmation (composant maison) :
  celle-là se pilote, et c'est elle que l'utilisateur voit le plus souvent.
- Pour tester une suppression réelle, passer par la modale applicative ; si seul
  `confirm()` existe, consigner « branche annuler seulement ».

## Saisie dans un éditeur riche

**Symptôme** — le contenu d'un document est remplacé au lieu d'être complété.

**Pourquoi** — taper dans un `contenteditable` revient à sélectionner puis à
remplacer. L'app n'a rien écrasé : l'instrument a réécrit le champ.

**Recette**

- Taper le contenu complet voulu, pas un fragment à ajouter.
- Ne jamais interpréter le résultat comme un écrasement applicatif. Pour tester
  un vrai conflit d'édition, écrire depuis une autre session (API ou second
  onglet) et observer l'onglet resté ouvert.

## Temps : démarrage, navigation, instantanés

**Symptôme** — « Démarrage… » qui ne finit pas ; page vide ; texte de la page
précédente ; app qu'on croit plantée.

**Pourquoi** — un snapshot est un instantané, pas une attente. Une app lourde
peut tenir un écran de démarrage plusieurs dizaines de secondes ; une navigation
peut laisser l'ancienne vue dans le DOM pendant la transition.

**Recette**

- Attendre explicitement (quelques secondes) avant de lire un écran de
  démarrage, puis re-snapshoter.
- Comparer deux snapshots : celui qui bouge est en cours de chargement, celui qui
  stagne mérite une enquête.
- Un timeout du pilote n'est pas une preuve de plantage : rejouer une fois avant
  de qualifier.
- Mesurer les temps (démarrage, première réponse) : ce sont des observations
  utiles en soi, à noter comme telles.

## Origines multiples

**Symptôme** — impossible de tester un second utilisateur ; le serveur ne répond
pas sur une adresse qui « devrait » marcher.

**Pourquoi** — `localhost`, `127.0.0.1` et `[::1]` sont trois origines
distinctes : trois `localStorage`, donc trois sessions. Et un serveur de dev
peut n'écouter que sur une famille d'adresses (souvent IPv6 seule) : l'autre
forme échoue alors même que la première fonctionne.

**Recette**

- Tester une URL dans le navigateur avant de conclure : `chrome-error` sur une
  forme et succès sur l'autre = simple question d'adresse d'écoute.
- Pour deux sessions sans mode privé : ouvrir le même serveur sous deux origines
  et se connecter avec deux comptes.
- Les liens absolus générés par l'app portent l'origine courante : réécrire
  l'origine à la main pour les ouvrir dans l'autre session.

## Réseau du shell (piège de diagnostic)

**Symptôme** — `curl http://localhost:PORT` échoue, et on en déduit que le
serveur est arrêté.

**Pourquoi** — un shell confiné peut vivre dans un espace réseau séparé de
l'hôte : il ne joint pas la loopback où tourne le serveur, alors que le
navigateur (hors confinement) le joint sans peine.

**Recette**

- Sonde : servir un fichier trivial depuis le shell, l'ouvrir dans le navigateur.
  Échec de chargement → le shell est isolé ; les échecs réseau du shell ne
  signifient plus rien.
- Demander à l'humain de lancer les serveurs, et de rediriger leur sortie vers un
  fichier lisible si les logs importent.

## Console

**Symptôme** — « 0 erreur console » coché un peu vite, ou une erreur attribuée à
la mauvaise action.

**Pourquoi** — les problèmes console exposés par un snapshot couvrent la fenêtre
depuis le snapshot précédent, pas depuis le début de la session.

**Recette**

- Snapshoter avant l'action, agir, snapshoter après : l'erreur appartient à
  l'écart.
- Établir une fois la liste des avertissements de fond (bruit récurrent) et ne
  plus les compter comme signal. Les noter en observation plutôt que les
  répéter à chaque case.

## Ce qui n'est pas pilotable

À traiter par un substitut explicite, jamais par un verdict inventé :

| Geste                                | Substitut                                                                |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `Échap` (fermeture de tiroir)        | naviguer ailleurs puis revenir ; vérifier l'état                         |
| Émulation d'impression / média       | lecture statique du code (`print:hidden`, feuille `@media print`)        |
| DevTools (IndexedDB, `localStorage`) | vérification comportementale (changer d'identité, observer les fantômes) |
| Coupure d'un service, relance        | action humaine, avec surveillance de la barre d'état                     |

Écrire dans le gate _comment_ l'item a été couvert, pour qu'un relecteur sache
que ce n'est pas une vérification à l'écran.
