#!/usr/bin/env bash
#
# merge-to-enka-next.sh — Merge propre d'une branche de dev vers enka-next.
#
# Usage :
#   ./scripts_dev/merge-to-enka-next.sh              # merge standard
#   ./scripts_dev/merge-to-enka-next.sh --squash      # squash merge
#   ./scripts_dev/merge-to-enka-next.sh --rebuild     # rebuild static/app après merge
#
# Le script :
#   1. Vérifie qu'on est sur une branche de dev (pas enka-next/main)
#   2. Retire static/app/ de l'index Git (git rm --cached) + commit
#   3. Bascule sur enka-next, pull, merge
#   4. Push enka-next
#   5. Optionnel : rebuild + commit du build (--rebuild)
#   6. Retour sur la branche source (toujours, même en cas d'erreur)
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_BRANCH="enka-next"
BUILD_DIR="static/app"

# ── Helpers ─────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m→\033[0m $*"; }
ok()    { echo -e "\033[1;32m✓\033[0m $*"; }
warn()  { echo -e "\033[1;33m⚠\033[0m $*"; }
err()   { echo -e "\033[1;31m✗\033[0m $*"; }

# Décommente une ligne (supprime le # devant), matche uniquement la ligne exacte
uncomment_line() {
    local file="$1" pattern="$2"
    if grep -q "^#\s\?${pattern}\s*$" "$file"; then
        sed -i "s|^#\(\s\?\)${pattern}\s*$|${pattern}|" "$file"
    fi
}

# Recommente une ligne (ajoute # devant), matche uniquement la ligne exacte
comment_line() {
    local file="$1" pattern="$2"
    if grep -q "^${pattern}\s*$" "$file"; then
        sed -i "s|^${pattern}\s*$|# ${pattern}|" "$file"
    fi
}

# ── Parse args ──────────────────────────────────────────────────────
SQUASH=false
REBUILD=false
for arg in "$@"; do
    case "$arg" in
        --squash)   SQUASH=true ;;
        --rebuild)  REBUILD=true ;;
        *) err "Option inconnue : $arg"; exit 1 ;;
    esac
done

# ── Vérifications ───────────────────────────────────────────────────
cd "$ROOT_DIR"

SOURCE_BRANCH=$(git branch --show-current)

if [ "$SOURCE_BRANCH" = "$TARGET_BRANCH" ] || [ "$SOURCE_BRANCH" = "main" ]; then
    err "Impossible de merger depuis la branche '$SOURCE_BRANCH'. Bascule sur ta branche de dev d'abord."
    exit 1
fi

# On vérifie uniquement les fichiers trackés modifiés/stagés.
# Les untracked (ex: static/app/ après git rm --cached) sont inoffensifs pour un merge.
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    err "Le working tree a des modifications non committées. Commit ou stash d'abord."
    git diff --name-only
    git diff --cached --name-only
    exit 1
fi

# ── Trap : toujours revenir sur la branche source en cas d'erreur ───
cleanup_done=false
cleanup() {
    if [ "$cleanup_done" = true ]; then return; fi
    cleanup_done=true
    local current
    current=$(git branch --show-current 2>/dev/null || echo "")
    if [ "$current" != "$SOURCE_BRANCH" ]; then
        warn "\nScript interrompu — retour forcé sur $SOURCE_BRANCH"
        git checkout "$SOURCE_BRANCH" 2>/dev/null || true
    fi
}
trap cleanup EXIT

info "Branche source  : $SOURCE_BRANCH"
info "Branche cible   : $TARGET_BRANCH"
if [ "$SQUASH" = true ]; then
    info "Mode            : squash merge"
fi

# ── Étape 1 : Retirer static/app de l'index sur la branche source ──
info "Retire static/app/ de l'index Git sur $SOURCE_BRANCH…"

TRACKED=$(git ls-files "$BUILD_DIR/" | head -1)
if [ -n "$TRACKED" ]; then
    git rm -r --cached "$BUILD_DIR/" 2>/dev/null || true
    git commit -m "chore: retire static/app de l'index avant merge vers $TARGET_BRANCH" || {
        warn "Rien à committer pour le retrait du build."
    }
    ok "Build retiré de l'index."
else
    warn "static/app/ n'était pas tracké. Étape ignorée."
fi

# ── Étape 2 : Push la branche source (avec le commit de retrait) ───
info "Push $SOURCE_BRANCH…"
git push origin "$SOURCE_BRANCH"
ok "Push réussi."

# ── Étape 3 : Nettoyer le build du disque avant checkout ────────────
# Les fichiers untracked de static/app/ bloqueraient le checkout vers
# enka-next (qui les tracke avec des hash différents).
# C'est safe : ce sont des fichiers générés, recréables par bun run build.
if [ -d "$BUILD_DIR" ]; then
    info "Supprime static/app/ du disque (fichiers générés, recréables)…"
    rm -rf "$BUILD_DIR"
    ok "Build supprimé du disque."
fi

# ── Étape 4 : Basculer sur enka-next et pull ───────────────────────
info "Bascule sur $TARGET_BRANCH…"
git checkout "$TARGET_BRANCH"
git pull origin "$TARGET_BRANCH"
ok "À jour sur $TARGET_BRANCH."

# ── Étape 4 : Merge ────────────────────────────────────────────────
MERGE_FLAG=""
if [ "$SQUASH" = true ]; then
    MERGE_FLAG="--squash"
fi

info "Merge de $SOURCE_BRANCH dans $TARGET_BRANCH…"
if git merge $MERGE_FLAG "$SOURCE_BRANCH"; then
    ok "Merge réussi."

    if [ "$SQUASH" = true ]; then
        git commit -m "merge: $SOURCE_BRANCH → $TARGET_BRANCH (squash)"
    fi
else
    err "Conflits détectés ! Résous-les manuellement, puis :"
    echo ""
    echo "    git add ."
    echo "    git commit"
    echo "    git push origin $TARGET_BRANCH"
    echo "    # puis relance avec --rebuild si nécessaire"
    echo ""
    echo "Conflits :"
    git diff --name-only --diff-filter=U
    echo ""
    err "Tu es resté sur $TARGET_BRANCH. Résous les conflits avant de revenir."
    cleanup_done=true  # empêche le trap de faire un checkout forcé
    exit 1
fi

# ── Étape 5 : Push enka-next ───────────────────────────────────────
info "Push $TARGET_BRANCH…"
git push origin "$TARGET_BRANCH"
ok "Push réussi."

# ── Étape 6 : Rebuild optionnel ────────────────────────────────────
if [ "$REBUILD" = true ]; then
    info "Rebuild Svelte…"
    GITIGNORE_ROOT="$ROOT_DIR/.gitignore"
    GITIGNORE_SVELTE="$ROOT_DIR/svelte-app/.gitignore"
    # S'assurer que le build n'est PAS exclu par les gitignore
    comment_line "$GITIGNORE_ROOT" "static/app"
    comment_line "$GITIGNORE_SVELTE" "static/*"

    cd "$ROOT_DIR/svelte-app"
    if bun run build; then
        ok "Build réussi."
    else
        err "Échec du build."
        exit 1
    fi
    cd "$ROOT_DIR"

    git add "$BUILD_DIR/"
    # Ne pas committer les gitignore s'ils n'ont pas changé
    git diff --quiet "$GITIGNORE_ROOT" 2>/dev/null || git add "$GITIGNORE_ROOT"
    git diff --quiet "$GITIGNORE_SVELTE" 2>/dev/null || git add "$GITIGNORE_SVELTE"
    git commit -m "build: static/app post-merge ($SOURCE_BRANCH → $TARGET_BRANCH)"
    git push origin "$TARGET_BRANCH"
    ok "Build déployé sur $TARGET_BRANCH."
fi

# ── Retour sur la branche source ───────────────────────────────────
info "Retour sur $SOURCE_BRANCH…"
git checkout "$SOURCE_BRANCH"
cleanup_done=true
ok "Terminé ! Tu es de retour sur $SOURCE_BRANCH."
