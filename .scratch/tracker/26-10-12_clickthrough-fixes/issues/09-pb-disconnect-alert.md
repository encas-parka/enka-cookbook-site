# 09: Alerte perte serveur PB (StatusBar)

**What to build:** quand le serveur PocketBase devient injoignable, une alerte
visible apparaît (~3 s, débounce existant) — distincte du badge « hors-ligne »
internet. Au retour du serveur : « connected » + resync silencieux, sans flash.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §9, item `[!]`
resync : « pas d'alert/toast en cas de perte du serveur pb. Seul le "hors-ligne",
en cas de coupure internet, s'affiche, avec resync ok ». Le signal de déconnexion
débounce ~3 s existe déjà côté signaux SSE — c'est le raccord au statut visible
qui manque.

> Arbitration investigation 12-10 (`mesuré`) — l'évidence ci-dessus est inexacte :
> le raccord existe déjà (StatusBar affiche « Connexion perdue »/« Serveur
> indisponible » via le chemin resync de `main.ts`). Le gap réel :
> `initRealtimeSignals` n'est pas appelé au boot avec une session existante
> (uniquement via le modal de login) — signaux morts sur le chemin dominant. Le fix
> est un chantier d'init/lifecycle (d'où le blocker 07), pas de câblage.

**Blocked by:** 07 (même zone d'écriture probable — lifecycle/signaux temps réel —
écrivain unique).

**Status:** ready-for-agent

- [ ] Couper dev:pb → alerte visible distincte du badge hors-ligne internet.
- [ ] Relancer dev:pb → « connected » + resync silencieux (T15 reste vert).
- [ ] Cacher/rouvrir l'onglet → resync sans flash de loading (comportement actuel
      préservé).
