#!/usr/bin/env bash
#
# deploy-build.sh — Build Svelte, commit le résultat dans static/app/, push.
#
# Usage :
#   ./scripts_dev/deploy-build.sh           # commit + push
#   ./scripts_dev/deploy-build.sh --no-push # commit seulement
#
# Le script :
#   1. Décommente les lignes d'exclusion du build dans les .gitignore
#   2. Lance bun run build dans svelte-app/
#   3. git add + commit + push (si --no-push n'est pas passé)
#   4. Recommente les .gitignore (nettoyage always, même en cas d'erreur)
#
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GITIGNORE_ROOT="$ROOT_DIR/.gitignore"
GITIGNORE_SVELTE="$ROOT_DIR/svelte-app/.gitignore"
BUILD_DIR="$ROOT_DIR/static/app"
COMMIT_MSG="build: mise à jour static/app (auto-build svelte)"

# ── Helpers ─────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m→\033[0m $*"; }
ok()    { echo -e "\033[1;32m✓\033[0m $*"; }
warn()  { echo -e "\033[1;33m⚠\033[0m $*"; }
err()   { echo -e "\033[1;31m✗\033[0m $*"; }

cleanup_done=false

cleanup() {
    if [ "$cleanup_done" = true ]; then return; fi
    cleanup_done=true
    info "Nettoyage : re-commente les .gitignore…"
    comment_line "$GITIGNORE_ROOT" "static/app"
    comment_line "$GITIGNORE_SVELTE" "static/*"
    ok "Gitignore restaurés."
}

trap cleanup EXIT

# Décommente une ligne (supprime le # devant), matche uniquement la ligne exacte
# Ex: "# static/app" → "static/app"    mais PAS "# voir static/app/old"
uncomment_line() {
    local file="$1" pattern="$2"
    if grep -q "^#\s\?${pattern}\s*$" "$file"; then
        sed -i "s|^#\(\s\?\)${pattern}\s*$|${pattern}|" "$file"
    fi
}

# Recommente une ligne (ajoute # devant), matche uniquement la ligne exacte
# Ex: "static/app" → "# static/app"    mais PAS "static/app/dist"
comment_line() {
    local file="$1" pattern="$2"
    if grep -q "^${pattern}\s*$" "$file"; then
        sed -i "s|^${pattern}\s*$|# ${pattern}|" "$file"
    fi
}

# ── Vérifications ───────────────────────────────────────────────────
cd "$ROOT_DIR"

BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "enka-next" ]; then
    err "Ne pas lancer ce script sur main ou enka-next. Branche actuelle : $BRANCH"
    exit 1
fi

if [ ! -d "svelte-app" ]; then
    err "Dossier svelte-app/ introuvable. Lancer depuis la racine du projet."
    exit 1
fi

# ── Étape 1 : Décommenter les gitignore ────────────────────────────
info "Décommente les .gitignore pour inclure static/app…"
uncomment_line "$GITIGNORE_ROOT" "static/app"
uncomment_line "$GITIGNORE_SVELTE" "static/*"
ok "Lignes d'exclusion commentées."

# ── Étape 2 : Build Svelte ─────────────────────────────────────────
info "Build Svelte (bun run build)…"
cd "$ROOT_DIR/svelte-app"
if bun run build; then
    ok "Build réussi."
else
    err "Échec du build. Abandon."
    exit 1
fi
cd "$ROOT_DIR"

# ── Étape 3 : Vérifier qu'il y a du nouveau contenu ────────────────
if git diff --quiet "$BUILD_DIR" && git diff --cached --quiet "$BUILD_DIR"; then
    # Vérifier aussi les fichiers non-trackés
    if [ -z "$(git ls-files --others --exclude-standard "$BUILD_DIR")" ]; then
        warn "Aucun changement détecté dans static/app/. Rien à committer."
        exit 0
    fi
fi

# ── Étape 4 : Git add + commit ─────────────────────────────────────
info "Stage et commit…"
git add "$BUILD_DIR/" "$GITIGNORE_ROOT" "$GITIGNORE_SVELTE"
git commit -m "$COMMIT_MSG" || {
    warn "Rien à committer (peut-être déjà à jour)."
    exit 0
}
ok "Commit créé : $COMMIT_MSG"

# ── Étape 5 : Push (sauf si --no-push) ─────────────────────────────
if [ "${1:-}" != "--no-push" ]; then
    info "Push vers origin/$BRANCH…"
    git push origin "$BRANCH"
    ok "Push réussi."
else
    info "Option --no-push : pas de push. Commit local uniquement."
fi

# ── Fin ─────────────────────────────────────────────────────────────
ok "Déploiement terminé avec succès sur $BRANCH."
