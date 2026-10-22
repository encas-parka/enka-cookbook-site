> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

# Figéage des réservations closses : uniquement côté client à ce jour

Tag: debt · Urgence: conditional · Source: run 26-10-22 dossier emprunt, itération 2 · Ancre: svelte-app/src/lib/components/teamMatos/loan/LoanForm.svelte (dérivée `isFrozen`)

L'UI fige la fiche de réservation quand le retour est effectué ou que la
date de fin est passée (`LoanForm.isFrozen`) : champs désactivés, bouton
d'enregistrement masqué. **Le backend, lui, accepte toujours la mise à jour**
d'un emprunt `completed` ou échu (PUT/PATCH sur la collection `materielloans`
non restreint) — un appel direct (script, autre client) modifierait un
historique censé être figé.

Décision à prendre : le degré de contrainte serveur voulu.

Options :

1. API rules de collection : conditionner `update` sur `status != "completed"`
   et `endDate > now` — grossier mais sans hook ;
2. Hook JSVM `materielloans:update` refusant la modification des champs
   matériels/dates sur un emprunt clos (les labels de retour restent
   modifiables via le flux de retour) ;
3. Rester client-only (assumé, documenté).

Reco : option 2 (le flux de retour écrit précisément sur les emprunts qu'il
clôt — les rules brutes de l'option 1 le bloqueraient), à acter en ADR si
retenu, cohérent avec l'ADR 0002 (règles volontairement grossières côté
serveur : ici c'est le contraire qui est souhaité, la décision mérite d'être
écrite).
