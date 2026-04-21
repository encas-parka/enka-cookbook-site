#!/usr/bin/env bash
#
# merge-to-enka-next.sh — Merge propre d'une branche de dev vers enka-next.
#
# Usage :
#   ./scripts_dev/merge-to-enka-next.sh              # merge + rebuild (défaut)
#   ./scripts_dev/merge-to-enka-next.sh --squash      # squash merge + rebuild
#   ./scripts_dev/merge-to-enka-next.sh --no-rebuild  # merge sans rebuild
#
# Prérequis :
#   - .gitattributes doit contenir : static/app/** merge=ours
#   - Cela évite les conflits sur les fichiers de build
#
# Le script :
#   1. Vérifie qu'on est sur une branche de dev (pas enka-next/main)
#   2. Push la branche source (backup)
#   3. Bascule sur enka-next, pull, merge
#   4. Rebuild Svelte sur enka-next (par défaut)
#   5. Push enka-next
#   6. Retour sur la branche source (toujours, même en cas d'erreur)
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_BRANCH="enka-next"
BUILD_DIR="static/app"
GITIGNORE_ROOT="$ROOT_DIR/.gitignore"
GITIGNORE_SVELTE="$ROOT_DIR/svelte-app/.gitignore"

# ── Helpers ─────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m→\033[0m $*"; }
ok()    { echo -e "\033[1;32m✓\033[0m $*"; }
warn()  { echo -e "\033[1;33m⚠\033[0m $*"; }
err()   { echo -e "\033[1;31m✗\033[0m $*"; }

# Commente une ligne de gitignore (ajoute # devant).
# Utilise grep -Fxq (fixed string, ligne exacte) pour éviter
# les problèmes avec les métacaractères regex (ex: * dans "static/*").
# Puis sed par numéro de ligne (pas de regex dans le pattern).
comment_line() {
    local file="$1" pattern="$2"
    if grep -Fxq "$pattern" "$file"; then
        local line_num
        line_num=$(grep -Fxn "$pattern" "$file" | head -1 | cut -d: -f1)
        sed -i "${line_num}s|^|# |" "$file"
        info "Gitignore : '$pattern' → désactivé (commenté)"
    fi
}

# ── Parse args ──────────────────────────────────────────────────────
SQUASH=false
REBUILD=true
for arg in "$@"; do
    case "$arg" in
        --squash)      SQUASH=true ;;
        --no-rebuild)  REBUILD=false ;;
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
if [ "$REBUILD" = false ]; then
    warn "Rebuild désactivé (--no-rebuild). Pense à rebuilder manuellement sur $TARGET_BRANCH."
fi

# ── Étape 1 : Push la branche source (backup) ──────────────────────
info "Push $SOURCE_BRANCH (backup)…"
git push origin "$SOURCE_BRANCH"
ok "Push réussi."

# ── Étape 2 : Nettoyer le build du disque avant checkout ────────────
# Supprime les fichiers générés pour éviter les conflits lors du
# checkout vers enka-next. C'est safe : recréables par bun run build.
if [ -d "$BUILD_DIR" ]; then
    info "Supprime static/app/ du disque (fichiers générés, recréables)…"
    rm -rf "$BUILD_DIR"
    ok "Build supprimé du disque."
fi

# ── Étape 3 : Basculer sur enka-next et pull ───────────────────────
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
    echo ""
    echo "Conflits :"
    git diff --name-only --diff-filter=U
    echo ""
    err "Tu es resté sur $TARGET_BRANCH. Résous les conflits avant de revenir."
    cleanup_done=true  # empêche le trap de faire un checkout forcé
    exit 1
fi

# ── Étape 5 : Rebuild Svelte (par défaut) ──────────────────────────
if [ "$REBUILD" = true ]; then
    info "Rebuild Svelte sur $TARGET_BRANCH…"

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

    # Vérifier qu'il y a du nouveau contenu
    if git diff --quiet "$BUILD_DIR" && git diff --cached --quiet "$BUILD_DIR"; then
        if [ -z "$(git ls-files --others --exclude-standard "$BUILD_DIR")" ]; then
            warn "Aucun changement détecté dans static/app/. Pas de commit de build."
        fi
    else
        git add "$BUILD_DIR/"
        # Ne pas committer les gitignore s'ils n'ont pas changé
        git diff --quiet "$GITIGNORE_ROOT" 2>/dev/null || git add "$GITIGNORE_ROOT"
        git diff --quiet "$GITIGNORE_SVELTE" 2>/dev/null || git add "$GITIGNORE_SVELTE"
        git commit -m "build: static/app post-merge ($SOURCE_BRANCH → $TARGET_BRANCH)"
        ok "Build commité sur $TARGET_BRANCH."
    fi
fi

# ── Étape 6 : Push enka-next ───────────────────────────────────────
info "Push $TARGET_BRANCH…"
git push origin "$TARGET_BRANCH"
ok "Push réussi."

# ── Retour sur la branche source ───────────────────────────────────
info "Retour sur $SOURCE_BRANCH…"
git checkout "$SOURCE_BRANCH"
cleanup_done=true
ok "Terminé ! Tu es de retour sur $SOURCE_BRANCH."
