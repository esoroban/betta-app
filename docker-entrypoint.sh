#!/bin/sh
set -e

echo "Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Running seed (if DB is empty)..."
node ./seed-docker.js || echo "Seed skipped or already seeded."

# Copy baseline assets to persistent storage on first run
STORAGE="/app/storage"
if [ -d "$STORAGE" ] && [ -d "./data/ASSETS" ]; then
  if [ ! -f "$STORAGE/.assets-copied" ]; then
    echo "Copying baseline assets to persistent storage..."
    mkdir -p "$STORAGE/ASSETS" "$STORAGE/SERVER"
    cp -rn ./data/ASSETS/* "$STORAGE/ASSETS/" 2>/dev/null || true
    cp -n ./data/SERVER/*.json "$STORAGE/SERVER/" 2>/dev/null || true
    touch "$STORAGE/.assets-copied"
    echo "Done: $(du -sh $STORAGE/ASSETS | cut -f1) of assets copied."
  else
    echo "Assets already on persistent storage, skipping copy."
  fi
fi

echo "Starting Next.js server..."
exec node server.js
