> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: debt · Urgence: light · Source: run 26-10-24 granularité des dommages (review de clôture, § Trouvailles différées du rapport) · Ancre: svelte-app/src/lib/utils/materiel.utils.ts (isLoanPlanned, extractMaterielIdsFromLoans)

# Orphelins de materiel.utils.ts : isLoanPlanned et extractMaterielIdsFromLoans

**Constat** — `isLoanPlanned` et `extractMaterielIdsFromLoans` sont exportés de
`materiel.utils.ts` sans aucun consommateur ni test (grep mesuré au run du
24-10). Ils ne portent pas de sémantique périmée (contrairement aux helpers de
période purgés au commit `a1874a49`, qui réexportaient la formule de stock
d'avant le lot) : c'est de la dette légère, pas un bug.

**Impact** — nul à l'exécution ; coût de lecture seulement (faisait vivre
l'illusion d'une API utils plus large qu'elle n'est).

**Reco** — purger les deux fonctions au prochain passage sur la zone (même
geste que la purge A4 : grep de preuve avant/après, suite utils verte), ou les
rebrancher si un besoin réel apparaît.
