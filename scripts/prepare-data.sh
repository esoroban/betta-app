#!/bin/bash
# Bundle lesson data into data/ for Docker build
# Run from betta-app repo root
set -e

REPO_ROOT="${1:?Usage: bash scripts/prepare-data.sh /path/to/SylaSlova_only_online}"

echo "Copying lesson data from $REPO_ROOT ..."

rm -rf data
mkdir -p data/SERVER data/ASSETS

# Runtime JSONs (~2.5MB)
cp "$REPO_ROOT"/SERVER/lesson_*_runtime.json data/SERVER/
echo "  $(ls data/SERVER/*.json | wc -l | tr -d ' ') runtime JSONs"

# Assets (~340MB)
cp -r "$REPO_ROOT"/ASSETS/* data/ASSETS/
echo "  $(du -sh data/ASSETS | cut -f1) of assets"

echo "Done. Ready for: docker build -t betta-app ."
