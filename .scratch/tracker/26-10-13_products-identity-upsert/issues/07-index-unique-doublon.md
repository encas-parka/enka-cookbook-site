# 07: Bornes produit, générateur d'id sans slice, unicité et retour doublon

**What to build:** créer un produit du même nom qu'un existant dans l'événement rend un retour clair (« un produit de ce nom existe ») au lieu d'un doublon discret ; les noms de produits sont bornés à 60 caractères (client + serveur) ; l'id sémantique n'est plus tronqué (slug complet du nom + eventId entier), dans la limite posée.

**Blocked by:** 04 (identité stable), 05 (fusion, coordination : une fusion ne doit pas violer la contrainte).

**Status:** done (atterri 14-10, 3 tiers : `7cd5112b`, `fed7da91`, `5a5577e6`)

- [x] Migration console `products.id` max 76 (déjà appliquée via console, auto-générée) versionnée dans le lot
- [x] `productName` borné : max 60 côté serveur (migration PB) et côté client (maxlength + message de validation) — max réel mesuré en base : 39
- [x] Générateur d'id sémantique : slug du nom SANS slice (≤ longueur du nom donc ≤ 60) + `_` + eventId complet (15) — plus de slice à 20 ni de slice d'eventId
- [!] Contrainte d'unicité par (événement, nom) posée et coordonnée avec la fusion (cas de renommage et de lignes fusionnées spécifiés) — migration DDL écrite + prouvée from scratch, coordination fusion prouvée par tests sous contrainte, MAIS pose sur dev/prod bloquée : 7 paires dupliquées actives préexistantes (non fusionnées) → ASSAINISSEMENT requis avant `migrate up` (décision maintainer : quelle ligne survit par paire + remappage achats)
- [x] Le conflit remonte en message utilisateur explicite (pas d'erreur brute)
- [x] Le repli par nom du recollage reste cohérent (sensible à la casse des deux côtés, porte du nom vide fermée par le requis)
- [x] Ids existants (slug court + 10 chars) toujours valides — compat ascendante vérifiée

## Notes d'atterrissage (implementer 14-10)

- Faux positif du slice-20 RÉSOLU au passage (mieux que la parité sœur) : « beurre de cacahuètes (salé) » vs « (sucré) » ne convergent plus — test inversé (2 besoins distincts, 0 warn). Le Deferred T06 « révision de la limite » est soldé par ce ticket, pas au backlog.
- Shape wire mesuré (sonde C) : le 400 d'unicité porte `validation_not_unique` sur eventId ET productName (toutes colonnes du groupe) — le mapping client exclut `id` et traduit tout autre champ, le harnais est aligné.
- Serveur jetable 8093 (`/tmp/opencode/pb-t07-copy`, copie du dev) : TOUJOURS ACTIF en fin de run (kill refusé sandbox) — à arrêter côté orchestrateur. Le dev 8090 n'a jamais été touché (migrations absentes vérifiées read-only).
