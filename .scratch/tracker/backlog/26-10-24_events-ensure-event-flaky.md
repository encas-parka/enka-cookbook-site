> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: debt · Urgence: light · Source: review post-session tests composants (24-10) · Ancre: svelte-app/src/lib/stores/__tests__/events-store-ensure-event.test.ts (« cache chaud : aucun appel réseau »)

# Flaky sous charge : events-store-ensure-event « cache chaud »

**Constat** — le test échoue de façon intermittente quand la suite complète
tourne en parallèle (56 workers) : `collectionSpy` a été appelé alors que le
scénario attend un cache chaud sans réseau. En isolement : 5/5 verts. Deux
runs consécutifs de la suite complète le 24-10 : 1 rouge, 1 vert — même code.
Les review-fixes du jour ne touchent ni ce test ni ce chemin.

**Impact** — un rouge intermittent érode la confiance dans les runs de suite
et masque les vraies régressions (bruit de triage).

**Reco** — remplacer l'attente figée du setup par une condition (pattern
`waitForCondition`, cf. tests composants ADR 0004), ou séquencer l'assertion
« cache chaud » après un tick déterministe du cache ; qualifier ensuite par
quelques runs de suite en parallélisme forcé.
