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
#   2. Supprime static/app/ de l'index Git (git rm --cached)
#   3. Commit le retrait
#   4. Bascule sur enka-next, pull
#   5. Merge la branche
#   6. Optionnel : rebuild + commit du build (--rebuild)
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

if [ -n "$(git status --porcelain)" ]; then
    err "Le working tree n'est pas propre. Commit ou stash tes changements d'abord."
    git status --short
    exit 1
fi

info "Branche source  : $SOURCE_BRANCH"
info "Brananche cible  : $TARGET_BRANCH"
if [ "$SQUASH" = true ]; then
    info "Mode            : squash merge"
fi

# ── Étape 1 : Retirer static/app de l'index sur la branche source ──
info "Retire static/app/ de l'index Git sur $SOURCE_BRANCH…"

# Vérifier si des fichiers du build sont trackés
TRACKED=$(git ls-files "$BUILD_DIR/" | head -1)
if [ -n "$TRACKED" ]; then
    git rm -r --cached "$BUILD_DIR/" 2>/dev/null || true
    # Ajouter au .gitignore pour éviter qu'il revienne
    if ! grep -q "^static/app" .gitignore; then
        echo "" >> .gitignore
        echo "# build svelte (géré par scripts_dev/)" >> .gitignore
        echo "static/app" >> .gitignore
    fi
    git add .gitignore
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

# ── Étape 3 : Basculer sur enka-next et pull ───────────────────────
info "Bascule sur $TARGET_BRANCH…"
git checkout "$TARGET_BRANCH"
git pull origin "$TARGET_BRANCH"
ok "À jour sur $TARGET_BRANCH."

# ── Étape 4 : Retirer static/app de enka-next aussi ────────────────
TRACKED_TARGET=$(git ls-files "$BUILD_DIR/" | head -1)
if [ -n "$TRACKED_TARGET" ]; then
    info "Retire aussi static/app/ de l'index sur $TARGET_BRANCH…"
    git rm -r --cached "$BUILD_DIR/" 2>/dev/null || true
    if ! grep -q "^static/app" .gitignore; then
        echo "" >> .gitignore
        echo "# build svelte (géré par scripts_dev/)" >> .gitignore
        echo "static/app" >> .gitignore
    fi
    git add .gitignore
    git commit -m "chore: retire static/app de l'index sur $TARGET_BRANCH avant merge" || true
    ok "Build retiré de $TARGET_BRANCH."
fi

# ── Étape 5 : Merge ────────────────────────────────────────────────
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
    echo "    # puis relance avec --rebuild si nécessaire"
    echo ""
    echo "Conflits :"
    git diff --name-only --diff-filter=U
    exit 1
fi

# ── Étape 6 : Push enka-next ───────────────────────────────────────
info "Push $TARGET_BRANCH…"
git push origin "$TARGET_BRANCH"
ok "Push réussi."

# ── Étape 7 : Rebuild optionnel ────────────────────────────────────
if [ "$REBUILD" = true ]; then
    info "Rebuild Svelte…"
    # Décommenter le gitignore temporairement
    sed -i 's|^static/app|# static/app|' .gitignore 2>/dev/null || true
    cd "$ROOT_DIR/svelte-app"
    if bun run build; then
        ok "Build réussi."
    else
        err "Échec du build."
        exit 1
    fi
    cd "$ROOT_DIR"
    git add "$BUILD_DIR/" .gitignore
    git commit -m "build: static/app post-merge ($SOURCE_BRANCH → $TARGET_BRANCH)"
    git push origin "$TARGET_BRANCH"
    # Recommenter le gitignore
    sed -i 's|^# static/app|static/app|' .gitignore 2>/dev/null || true
    ok "Build déployé sur $TARGET_BRANCH."
fi

# ── Retour sur la branche source ───────────────────────────────────
info "Retour sur $SOURCE_BRANCH…"
git checkout "$SOURCE_BRANCH"
ok "Terminé ! Tu es de retour sur $SOURCE_BRANCH."
