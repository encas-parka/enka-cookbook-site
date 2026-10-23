> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

# Invariants materielloans non garantis côté serveur

Tag: debt · Urgence: conditional · Source: runs 26-10-22 dossier emprunt (it. 2 et 5) · Ancres: svelte-app/src/lib/components/teamMatos/loan/LoanForm.svelte (dérivée `isFrozen`), loan/LoanReturnForm.svelte (`onQty`), stores/MaterielStore.svelte.ts (`completeLoanWithReturn`)

Deux invariants ne vivent que dans l'UI — un appel direct (script, autre
client) peut les contourner :

1. **Fichéage des fiches closes** : l'UI fige la réservation quand le retour
   est effectué ou la date de fin passée (`LoanForm.isFrozen`), mais
   PUT/PATCH sur `materielloans` reste non restreint — un historique censé
   être figé reste modifiable.
2. **Cohérence des déclarations de retour** : l'UI plafonne `lost + broken ≤
   quantity` (`onQty`), mais `completeLoanWithReturn` propage les valeurs
   telles quelles et aucun hook ne valide — des sommes incohérentes
   fausseraient les disponibilités en cascade.

Décision à prendre : le degré de contrainte serveur voulu.

Options :

1. API rules de collection : conditionner `update` sur `status != "completed"`
   et `endDate > now` — grossier mais sans hook ; ne couvre pas l'invariant 2 ;
2. Hook JSVM `materielloans` : refuser la modification des champs
   matériels/dates sur un emprunt clos (invariant 1) et valider
   `lost + broken ≤ quantity` à la clôture (invariant 2) ;
3. Rester client-only (assumé, documenté).

Reco : option 2 (le flux de retour écrit précisément sur les emprunts qu'il
clôt — les rules brutes de l'option 1 le bloqueraient ; et le hook couvre les
deux invariants au même endroit), à acter en ADR si retenu, cohérent avec
l'ADR 0002 (règles volontairement grossières côté serveur : ici c'est le
contraire qui est souhaité, la décision mérite d'être écrite).
