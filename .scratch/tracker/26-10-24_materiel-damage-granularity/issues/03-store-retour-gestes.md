# 03: Store — retour qui décrémente les manquants, gestes remise en service et réforme

**What to build:** le retour d'un emprunt met le stock à la vérité : les
manquants décrémentent définitivement la quantité, les exemplaires à
réparer incrémentent le compteur de réparation, les items revenus intacts ne
subissent aucune écriture, et plus aucun statut n'est écrit. Deux gestes
nouveaux — remise en service et réforme — ferment le cycle. Les sélecteurs
du store ne filtrent plus sur le statut : seule la disponibilité calculée
décide. Prouvé en tests de store au harness existant (vrai store + transport
PocketBase factice).

Références : spec (§ Implementation Decisions, sémantique du retour et des gestes) · ADR 0003.
Zone : `svelte-app/src/lib/stores/MaterielStore.svelte.ts` (`completeLoanWithReturn`, `getAvailableMaterielsByOwner`, `getAvailableMaterielsForPeriod`, nouveaux gestes), tests dans `stores/__tests__/` (patron : `materiel-store-loan-sync.test.ts` — harness `stub-pb`, fixtures, fake-indexeddb).

**Blocked by:** 01 (champ), 02 (formule de disponibilité juste).

**Status:** ready-for-agent

- [ ] Scénario « 2 cassés sur 12, 6 empruntés » : `repairQuantity = 2`, `quantity = 12`, item toujours proposable pour 10
- [ ] Scénario « 2 manquants sur 12 » : `quantity = 10`, `repairQuantity` inchangé
- [ ] Scénario « 3 manquants sur un emprunt de 3, stock 50 » : `quantity = 47` — aucune écriture de statut, la perte ne propage plus à tout l'item
- [ ] Item du retour sans dommage déclaré : aucune écriture émise pour lui (vérifié au transport factice)
- [ ] Geste remise en service : `repairQuantity -= n`, garde `n ≤ repairQuantity`
- [ ] Geste réforme : `repairQuantity -= n` **et** `quantity -= n` (les exemplaires deviennent manquants)
- [ ] Sélecteurs : un item entièrement en réparation (backfill ticket 01) n'est pas proposé ; un item partiellement en réparation l'est pour ses unités saines ; dispo sur période identique
- [ ] Payload de retour et closing de l'emprunt inchangés (statut « completed », notes, lignes)
- [ ] Tests de store verts ; `bun run check:app` vert

## Comments
