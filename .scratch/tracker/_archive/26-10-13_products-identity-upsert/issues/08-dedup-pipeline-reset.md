# 08: Dédup produits dans le pipeline + reset dev + index unique appliqué

**What to build:** rejouer le pipeline de migration complet sur une base vierge ne recrée plus de doublons (event, nom) : le transform déduplique les produits avec remappage des achats, la base de dev est régénérée par reset + ré-import, et l'index unique (déjà prouvé from scratch au T07) s'applique — un doublon soumis ensuite reçoit le toast métier.

**Blocked by:** 07 (index écrit et prouvé, bornes posées).

**Status:** done (atterri 14-10 : transform `ee2be69c` ; reset + ré-import + sonde opérés le jour même, preuves en logs du run report)

- [x] Le transform déduplique les produits par (event source, productName) : survivant = porteur du plus d'achats non supprimés (égalité → le plus ancien ; cas ref-vs-sans-ref → la ligne avec ref) et remappe les références d'achats du perdant vers le survivant AVANT la résolution des relations
- [x] La dédup est vérifiée en dry (comptage avant/après : 7 paires → 0, achats conservés un pour un) et son log versé au run report
- [x] Base dev régénérée par reset + ré-import complet (pas de --upsert sur l'existant) ; 0 paire dupliquée après import (mesuré sqlite)
- [x] `migrate up` de l'index unique passe sur la base ré-importée (le T07 l'a prouvé sur migrations fraîches)
- [x] Sonde finale : créer un produit doublon → 400 `validation_not_unique` → toast métier (chemin UI simulé au harnais si le live ne couvre pas le toast)
- [x] Le critère `[!]` du ticket 07 (unicité) peut passer `[x]` — coordonner l'amend

## Notes d'atterrissage (implementer 14-10)

- **7 groupes, 8 lignes perdantes** : oignons (week end taff) compte 3 lignes → 2 pertes. Le compteur transform (`8 duplicates dropped`) compte les LIGNES, le ticket les PAIRES — cohérents (log `/tmp/orchestrate/transform-t08-dedup.log`, dry check `/tmp/orchestrate/dry-check-t08-dedup.log`).
- **Précédence des règles tranchée par les données + dispatch** : Tahin (test debug) = achats 1-1, âge → manuel, ref → besoin (`u33083`) — la règle ref DOIT primer pour s'appliquer (sinon lettre morte : l'âge diffère toujours). Ordre implémenté : (1) exactement une ligne avec `ingredientRef` → elle gagne ; (2) plus d'achats non supprimés ; (3) plus ancien ; (4) id le plus bas (déterminisme). Sur les 7 groupes, 6/7 en consensus toutes lectures.
- **Import SOUS l'index** : le pb_data vierge est provisionné avec TOUTES les migrations (index inclus) AVANT l'import — preuve plus forte que le scénario nominal : 974 produits créés, 0 failed, sous `UNIQUE(eventId, productName)`.
- **Full reset = -19 produits vs base précédente** : 11 produits créés runtime après le dernier import full (Deferred T11 connu) sont détruits — acté par le maintainer (events clos).
- **Password user sonde ré-aligné** : le ré-import crée les users avec mots de passe aléatoires ; `ghald@riseup.net` re-patché sur la valeur `.env.local` via admin API (état documenté du dev, log `/tmp/orchestrate/probe-user-password-t08.log`). Reste du reset password des users migrés : backlog Phase 1.8.
- **PB dev relancé sur 8090** (base ré-importée) en fin de ticket — `bun run dev:pb` en fond par l'implementer, **arrêté par le user juste après** (8090 libre ; la base sur disque est complète, relance : `bun run dev:pb`) ; serveur jetable 8093 (T07) toujours actif, à arrêter côté orchestrateur/user.
- Transform non couvert vitest (scripts_dev hors suite svelte-app) : preuve = dry check + import réel sous contrainte + validate 86/86 — accepté dispatch. Régression stores+utils+db-sync : 31 fichiers / 208 tests vert ; check 0 erreur / 6 warnings (canon intact).
