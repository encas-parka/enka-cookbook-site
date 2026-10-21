# Spec — Participation RSVP : invitation virtuelle, lien de partage maîtrisé, email groupé

## Problem Statement

Le flux d'invitation aux événements est incohérent et partiellement cassé :

- un membre d'une équipe invitée à la création voit l'événement sans bandeau, sans entrée au registre des participants, et sans droits d'édition explicites (la vérification côté client ignore la branche équipe) ;
- le bandeau « participez » n'apparaît pour ainsi dire jamais : il n'est monté que sur la page racine, et le chemin join-link pose directement un statut confirmé ;
- le lien de partage est une action manuelle, répétable à l'infini, accessible à tout spectateur de l'événement ;
- les emails d'invitation partent un par un ;
- le champ de tracking des emails invités est écrit mais jamais lu.

Résultat : impossible de distinguer un curieux qui s'informe d'un participant engagé, et la passe de recette ne peut pas valider les parcours d'invitation.

## Solution

Un modèle de RSVP uniforme : toute personne rendue visible sur un événement est une **invitation** — virtuelle si elle découle d'une équipe invitée ou d'un ajout individuel sans réponse encore enregistrée — qui se matérialise dans le registre au moment où la personne répond. L'édition est la récompense de la confirmation. Le lien de partage est un attribut de l'événement : créé avec lui, affiché en lecture seule aux éditeurs, régénérable avec avertissement. L'invitation envoie un email groupé (copie cachée) contenant le lien. Rejoindre par le lien vaut réception d'une invitation, pas une confirmation.

## User Stories

1. As a member of an invited team, I want to see an invitation banner on every page of the event, so that I understand why I have access and what to do next.
2. As a member of an invited team, I want to accept or decline from that banner, so that my participation becomes explicit without organizer action.
3. As an invited user with an account, I want to see the event in my dashboard before responding, so that I can look at it before committing.
4. As a curious invited user, I want read-only access before accepting, so that I can inform myself without risk.
5. As a confirmed participant, I want edit rights on all event pages, so that I can contribute (meals, products, materiel, todos, documents).
6. As a declined user, I want to keep seeing the event read-only and to change my mind later, so that declining is not a trap.
7. As an organizer, I want to invite specific individuals from my teams (checked one by one), so that I do not blindly invite whole teams.
8. As an organizer, I want a check-all / uncheck-all control over a team's members, so that inviting a whole team stays one gesture.
9. As an organizer, I want already-invited people shown as locked (checked, disabled) checkboxes with a hint, so that the UI does not pretend I can un-invite them.
10. As an organizer, I want an explicit confirmation that an email with the participation link will be sent, so that I know the invitation is irrevocable before validating.
11. As an organizer, I want the invitation form to explain its effects (grouped email, dashboard access, full team = future members inherit), so that I understand the semantics before validating.
12. As an organizer, I want each event to carry its share link from creation, so that sharing requires no extra step.
13. As an organizer, I want to regenerate the link behind an explicit warning, so that a leaked link can be neutralized knowingly.
14. As an editor, I want invitation and link management reserved to editors, so that passive viewers cannot invite or share.
15. As an invitee without an account, I want the emailed link to lead me through login/registration and land me on the event as invited, so that I can join and then confirm.
16. As an invitee, I want one grouped email per event with recipients in BCC, so that my address is not exposed and the sender stays discreet.
17. As a team member added after a full-team invitation, I want to see the event without being re-invited, so that team membership stays meaningful.
18. As an RSVP-ing user without a prior registry entry, I want my answer to be recorded anyway, so that accepting works straight from the banner.
19. As an organizer, I want participants listed by RSVP state (confirmed / invited / declined) with invited teams shown as groups, so that I know where the minimum stands.
20. As any user, I want consistent edit gating across all event sub-pages, so that permissions feel identical everywhere.
21. As a user joining via a share link, I want to land as invited (not auto-confirmed), so that "confirmed" always means a deliberate yes.

## Implementation Decisions

- **Statut virtuel dérivé** : le statut d'invitation se dérive (entrée au registre ? son statut ; sinon membre d'une équipe invitée ou rendu visible → invité virtuel). Aucune écriture avant la réponse ; le RSVP fait un upsert (crée l'entrée avec email/nom de la session).
- **Édition sur confirm** : un seul point de passage store décide de l'édition — créateur, ou entrée `accepted` au registre. La branche équipe devient une *invitation*, pas une édition. Toutes les pages event utilisent ce point unique.
- **Bandeau partagé** : monté dans un layout de la branche événement du routeur, présent sur toutes les sous-pages ; il gère son propre état d'occupation.
- **Picker d'invitation** : membres des équipes cochables individuellement + tout cocher/décocher ; en-tête explicatif ; déjà invités = cochés-verrouillés + hint générique ; ConfirmModal avant validation (email = action irrévocable).
- **Règle d'écriture d'invitation** : personnes connues (avec compte) → canal de visibilité individuel + entrée au registre (invité) ; emails inconnus → entrée au registre avec identifiant temporaire (résolution par email au join, mécanisme existant) ; le canal équipe n'est écrit que si **tous** les membres sont cochés (grant vivant : futurs membres héritent). Plus aucune écriture du champ de tracking emails.
- **Lien de partage** : créé automatiquement à la création de l'événement via un service partagé get-or-create ; section en lecture seule (copier) + Régénérer derrière ConfirmModal d'avertissement ; le bouton de création manuelle disparaît.
- **Gates** : invitation et gestion du lien réservées aux éditeurs.
- **Join-link** : le hook pose le statut invité (et non confirmé) ; copy de la page de join ajustée.
- **Email groupé** : une seule expédition par événement, destinataires en copie cachée ; le wrapper mailer gagne le support BCC ; contenu toujours relu côté serveur.
- **Enforcement côté client uniquement** : les règles serveur restent volontairement grossières (un décliné pourrait encore écrire via l'API) — documenté par ADR, pas de hook de contrôle dans ce lot.
- **guestEmails** : plus écrit nulle part, champ supprimé du schéma par migration de clôture ; documentation de collections mise à jour.
- La consigne d'usage de svelte-autofixer (indisponible) est retirée de la doc d'ingénierie au profit de `check` + passe click-through.

## Testing Decisions

- Un bon test passe par le comportement externe du store : cache seedé + transport PB factice, puis invitation / RSVP / lecture de statut — jamais les détails internes.
- **Seam principal (existant)** : le harness store déjà en place pour le write path d'invitation (vrai store + vrai pb-sync + transport factice + IndexedDB simulé). Couvre : statut virtuel, upsert, sémantique d'édition, règle d'écriture d'invitation (équipe entière vs partiel), get-or-create du lien.
- **Hooks JSVM** : non testables en vitest (runtime Goja) → sondes HTTP contre le PB de dev (prior art : sondes du pipeline de migration) + items de passe click-through.
- **UI** : pas d'infrastructure de test composant dans ce repo et svelte-autofixer indisponible → `bun run check` + items click-through listés dans les tickets.

## Out of Scope

- **Révocation / désinvitation** — lot futur, couplé à la régénération du lien (l'email parti ne se rappelle pas).
- **Types de participation** (checkboxes de rôles au RSVP : courses, cuisine, mise en place…) — feature future ; le modèle l'accueille sans migration (entrée de registre extensible).
- **Enforcement serveur des statuts** (hook de contrôle des writes).
- Notifications in-app, relances, digest.
- Backfill des événements existants (aucun requis : le statut virtuel est dérivé, pas stocké).

## Further Notes

- Le vocabulaire fait foi : voir `CONTEXT.md` (invitation, invitation virtuelle, registre des participants, équipe invitée, lien de partage, régénération, éditeur, curieux).
- L'ADR (« le RSVP porte l'accès côté client, les règles serveur restent volontairement grossières ») est rédigé au ticket de clôture, une fois l'as-built connu.
- La ligne d'AGENTS.md imposant svelte-autofixer est corrigée au ticket de clôture.
