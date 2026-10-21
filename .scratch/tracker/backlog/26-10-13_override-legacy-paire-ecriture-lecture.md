> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `soon` · Source: run 26-10-13 (T06) · Ancre: svelte-app/src/lib/stores/OverrideManager.ts

- Override legacy : paire ecriture+lecture a traiter ensemble — ecriture : OverrideManager.handleSetOverride normalise via autoConvertUnit (inverse du stockage attendu : 1500 gr. se stocke 1.5 kg) ; lecture : helpers soeur getNormalizedOverride/getEffectiveNeededQuantities absents de mig (60 lignes legacy exposees). Corriger un seul cote laisserait ecriture et lecture incompatibles.
