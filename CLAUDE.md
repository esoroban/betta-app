# BETTA APP — Claude Instructions

## What is this

Production lesson review & publishing system. Deployed on Render.

- **Repo:** https://github.com/esoroban/betta-app
- **Production:** https://betta-app.onrender.com
- **Source repo (lessons, assets, pipeline):** https://github.com/esoroban/SulaSlovaOnlineLessons

## Stack

Next.js 16 (App Router, TypeScript) + Prisma + PostgreSQL + Docker

## Architecture

```
Render:
  Web Service (Docker) → Next.js app
  PostgreSQL            → users, candidates, versions, audit
  Persistent Disk       → all images (baseline 340MB + uploads)
```

## Key decisions (docs/DECISIONS.md has priority over other docs)

- Administrator = approver + publisher. Owner only assigns admins.
- Teacher does NOT edit. Only revisioner creates edit candidates.
- Auth: credentials only (no OAuth in MVP).
- Images: Render Persistent Disk at /app/storage/. R2/S3 later.
- All 25 lessons from bundled data/.

## Code layout

```
src/app/api/auth/     — login, logout, session, switch-role
src/app/api/lessons/  — list all, get by id
src/app/api/users/    — list, create (role-guarded)
src/app/api/assets/   — serve images from persistent disk
src/app/api/health/   — health check with storage info
src/app/dashboard/    — lesson grid + admin panel + role switcher
src/app/lessons/[id]/ — immersive lesson view + 5 editor drawers
src/app/login/        — login page with remember me
src/lib/auth.ts       — session management (cookie, 1d/30d expiry)
src/lib/lessons.ts    — read lessons from persistent disk or local FS
src/lib/roles.ts      — role hierarchy, canSwitchTo, canCreateUser, canEdit
src/lib/storage.ts    — persistent disk helpers for candidate images
src/lib/prisma.ts     — Prisma client singleton
src/lib/rate-limit.ts — in-memory rate limiter (5/min prod, 100 dev)
```

## Data flow

```
Persistent Disk /app/storage/:
  ASSETS/        ← 25 lessons × backgrounds, thumbnails, objects (340MB)
  SERVER/        ← 25 lesson runtime JSONs (2.5MB)
  candidates/    ← uploaded/generated candidate images (grows)
  published/     ← published assets (future)

PostgreSQL:
  users            ← accounts, roles, passwords
  app_sessions     ← login sessions
  edit_candidates  ← proposed changes by revisionеrs
  publish_versions ← materialized lesson snapshots
  audit_events     ← who did what when
```

## Testing

```bash
node_modules/.bin/playwright test    # 41 e2e tests (API + UI)
```

## Deploy

Render auto-deploys on push to main. Or: Blueprint → Manual sync.
First run: entrypoint copies baseline assets from Docker image to persistent disk.

## DevOps migration

See docs/DEVOPS_MIGRATION.md. Backup = `pg_dump` + `tar /app/storage`.

## Rules

- Run tests after changes.
- Do not commit .env or secrets.
- data/ is in git (baseline lessons) — will move to external storage later.
- Prisma seed.ts excluded from TypeScript build (tsconfig exclude).
