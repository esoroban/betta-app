#!/bin/sh
set -e

echo "Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Running seed (if DB is empty)..."
node ./seed-docker.js || echo "Seed skipped or already seeded."

# Move baseline assets to persistent storage (one-time)
STORAGE="${STORAGE_PATH:-/app/storage}"
if [ -d "$STORAGE" ] && [ -d "./data/ASSETS" ]; then
  if [ ! -f "$STORAGE/.initialized" ]; then
    echo "Initializing persistent storage with baseline assets..."
    mkdir -p "$STORAGE/ASSETS" "$STORAGE/SERVER" "$STORAGE/candidates" "$STORAGE/published"
    cp -r ./data/ASSETS/* "$STORAGE/ASSETS/"
    cp ./data/SERVER/*.json "$STORAGE/SERVER/"
    touch "$STORAGE/.initialized"
    echo "Done: $(du -sh $STORAGE/ASSETS 2>/dev/null | cut -f1) of assets on persistent disk."
  else
    echo "Persistent storage already initialized."
  fi
fi

echo "Starting Next.js server..."
exec node server.js
