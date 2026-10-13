# 07: Durcissement index unique et retour doublon

**What to build:** créer un produit du même nom qu'un existant dans l'événement rend un retour clair (« un produit de ce nom existe ») au lieu d'une fusion silencieuse ou d'un doublon discret.

**Blocked by:** 04 (identité stable), 05 (fusion, coordination : une fusion ne doit pas violer la contrainte).

**Status:** ready-for-agent

- [ ] Contrainte d'unicité par (événement, nom) posée et coordonnée avec la fusion (cas de renommage et de lignes fusionnées spécifiés)
- [ ] Le conflit remonte en message utilisateur explicite (pas d'erreur brute)
- [ ] Le repli par nom du recollage reste cohérent (sensible à la casse des deux côtés, porte du nom vide fermée par le requis)
