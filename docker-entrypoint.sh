#!/bin/sh
set -e

echo "Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "Running seed (if DB is empty)..."
node ./seed-docker.js || echo "Seed skipped or already seeded."

echo "Starting Next.js server..."
exec node server.js
