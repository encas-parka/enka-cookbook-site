#!/bin/bash
# T17 Phase 1 — merge recipe content site (enka-next, READ-ONLY source) → mig
# - copies the 89 site-only dirs, EXCLUDING the 2 z-test drafts (legitimate exclusion)
# - overwrites the 33 divergent common index.md with the site version (site canonical)
# - removes the 3 old mig-only rename dirs via trash (mapping documented in run.md)
set -eu

SITE=/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/content/recipe
MIG=/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/content/recipe

while IFS= read -r d; do
  if [ "$d" = "z-test_ribrm-hidtvl" ] || [ "$d" = "z-test-2-v2-qa_ssqprsi2lg4i" ]; then
    echo "SKIP z-test: $d"
    continue
  fi
  if [ -d "$MIG/$d" ]; then
    echo "SKIP already-exists: $d"
    continue
  fi
  cp -a "$SITE/$d" "$MIG/$d"
  echo "COPIED: $d"
done < /tmp/orchestrate/t17-site-only.txt

while IFS= read -r d; do
  cp -a "$SITE/$d/index.md" "$MIG/$d/index.md"
  echo "OVERWRITTEN from site: $d"
done < /tmp/orchestrate/t17-divergent-dirs.txt

trash "$MIG/ktipiti_ez-yo8_dromj" "$MIG/salade-aubergine-micui__txz4__ct_ir" "$MIG/tom-kha-soupe-thai_fdy0l64ios9o"
echo "TRASHED 3 old mig renames: ktipiti_ez-yo8_dromj salade-aubergine-micui__txz4__ct_ir tom-kha-soupe-thai_fdy0l64ios9o"
