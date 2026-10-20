# Trancher : bug, artefact ou limite

Un click-through produit dix constats douteux pour un vrai bug. Ce fichier est
la procédure de tri. Elle s'applique **avant** d'écrire un problème dans le
gate : un faux positif coûte une correction inutile, et discrédite le rapport.

## Le protocole en trois temps

Pour tout constat négatif, dans cet ordre, en s'arrêtant dès qu'une étape
explique ce qu'on voit :

1. **Attendre et relire.** Snapshot après un délai raisonnable. Un écran vide,
   un compteur à zéro, un bouton inactif changent souvent tout seuls.
2. **Recharger.** Un rechargement complet écarte le cache mémoire et les états
   transitoires d'une session. S'il corrige, c'était un délai ou un cache volatil.
3. **Interroger un oracle.** Requête API avec le token de l'utilisateur
   concerné, puis lecture de la base si nécessaire. C'est l'étape qui transforme
   une impression en verdict.

Si le rechargement **ne** corrige **pas** et que l'oracle contredit l'écran, ce
n'est pas un cache périmé : c'est un bug de synchronisation, et souvent le plus
grave du lot. Creuser le mécanisme de rafraîchissement (curseur incrémental,
filtre de collecte, invalidation après changement de droits).

## Les cinq familles d'artefacts

### 1. Le chargement déguisé en absence

« Aucun document », « 0 résultat », « liste vide » : ces messages sont aussi les
messages d'état vide légitimes. Pendant un chargement initial, ils s'affichent
puis disparaissent.

*Trancher* : délai → rechargement → oracle. Si l'oracle confirme l'absence, ce
n'est pas un bug ; si le chargement dure plusieurs secondes, c'est une
observation d'ergonomie (pas de squelette, message trompeur), pas un bug de
données.

### 2. Le résidu de la page précédente

Après une navigation SPA, le DOM peut encore contenir l'ancienne vue, y compris
ses bandeaux et ses boutons. Lire ce texte comme un défaut d'affichage est une
erreur classique.

*Trancher* : re-snapshoter après un délai ; vérifier l'URL réelle de la page.
Un contenu incohérent avec l'URL est presque toujours transitoire.

### 3. L'instrument qui modifie les données

Remplacer le contenu d'un éditeur riche, cocher une case d'un formulaire dont on
ne voulait que lire l'état, déclencher un enregistrement en quittant : ces
mutations viennent du pilotage.

*Trancher* : se demander « qu'est-ce que j'ai envoyé comme événement ? » avant
« qu'est-ce que l'app a fait ? ». Consigner l'artefact dans la note de clôture
pour ne pas le confondre plus tard avec une mutation applicative.

### 4. Le refus légitime

Un bouton `disabled`, un toast d'erreur, un 403 peuvent être exactement le
comportement attendu (droit manquant, verrou détenu par un autre, formulaire
incomplet, SMTP absent).

*Trancher* : vérifier l'intention dans le code avant de qualifier. Un bouton
désactivé qui protège un verrou est une preuve que le verrou fonctionne — c'est
un point **positif** à cocher, pas un bug.

### 5. Le snapshot partiel

L'extracteur d'éléments peut ne rien rendre dans une modale ou un tiroir, alors
que la page affiche bel et bien des champs. Conclure « la modale est vide » est
faux.

*Trancher* : cibler par type de champ ou par placeholder, ou utiliser le texte
de la page comme preuve de présence ; ne pas conclure sur l'absence d'une liste
d'éléments.

## Le tableau UI ↔ oracle

| Écran | Oracle | Verdict |
| --- | --- | --- |
| montre la donnée | confirme | coché |
| ne montre pas | confirme l'absence | état vide légitime → observation |
| ne montre pas | renvoie la donnée | **bug** : synchronisation, filtre, droit côté client |
| montre la donnée | refuse l'accès | **bug** de règle ou de cache de permission |
| erreur affichée | erreur serveur | comportement attendu, vérifier le message |

La troisième ligne est la plus rentable de toute une passe : c'est la signature
d'un cache local qui ne se resynchronise jamais. Elle se creuse en lisant le
mécanisme de collecte (delta sur un champ d'horodatage, curseur persistant,
repli conditionnel) plutôt qu'en cherchant côté UI.

## Un item de checklist peut être faux

Les checklists vieillissent plus vite que le code. Avant de décocher un item,
vérifier qu'il décrit encore quelque chose :

- la route existe-t-elle dans le routeur ? (une URL qui répond 404 n'est pas un
  bug si la page vit sous un autre chemin) ;
- le composant est-il monté quelque part ? (une référence non importée est un
  constat de code, pas d'UI) ;
- la fonctionnalité est-elle livrée dans cette branche ? (une feature planifiée
  n'est pas une régression).

Un item obsolète se **reformule** avec la réalité du code, et se garde dans le
document : l'effacer fait réapparaître la même question à la passe suivante.

## Bruit de console

Distinguer trois classes, une fois pour toutes :

- **bruit de fond** : avertissements récurrents sur toutes les pages. Les lister
  en tête du gate et ne plus les mentionner case par case.
- **signal ponctuel** : apparaît avec une action précise. À attribuer à cette
  action, avec le texte exact.
- **erreur bloquante** : interrompt le parcours. Devient un `P` immédiatement.

Une erreur « non capturée » de framework (clé dupliquée, exception de rendu)
appartient toujours à la troisième classe, même si l'écran semble survivre : la
partie de l'UI qui meurt n'est pas toujours visible.

## Qualifier la sévérité

Trois questions, dans l'ordre — la première réponse positive fixe le niveau :

1. **Un parcours principal est-il cassé ?** (on ne peut plus créer, enregistrer,
   rejoindre) → haute.
2. **Une donnée est-elle perdue, invisible ou écrasée sans avertissement ?**
   → haute, même si le parcours « marche ».
3. **Un utilisateur peut-il se croire bloqué ou trompé ?** (bouton inerte,
   message de succès mensonger, formulaire invalide sans explication) → moyenne.

En dessous : ergonomie et cosmétique, en observation. Cette échelle évite les
rapports où quinze bugs mineurs noient le seul qui empêche la sortie.
