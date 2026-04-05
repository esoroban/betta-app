# BETTA APP — SylaSlova Lesson Review & Publishing

Lesson revision, review, and publishing system. Revisioners propose edits, administrators approve, and published snapshots become the canonical lesson state.

## Quick Start (Dev)

```bash
# Prerequisites: Node.js 20+, PostgreSQL running on localhost:5432

# 1. Install
npm install

# 2. Setup database
cp .env.example .env   # edit DATABASE_URL if needed
npx prisma migrate dev
npx prisma db seed

# 3. Run
npm run dev
# → http://localhost:3000/login
```

Dev accounts (from seed):

| Role | Email | Password |
|---|---|---|
| Owner | owner@sylaslova.com | owner123 |
| Administrator | admin@sylaslova.com | admin123 |
| Revisioner | revisioner@sylaslova.com | rev123 |
| Teacher | teacher1@sylaslova.com | teach123 |
| Student | student1@sylaslova.com | stud123 |

## Deploy (Render)

See `docs/DEPLOY_PLAN.md` for full instructions.

```bash
# 1. Upload assets to Render Object Storage
S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=betta-assets \
  node scripts/upload-assets.js /path/to/SylaSlova_only_online

# 2. Deploy via Render Dashboard or render.yaml Blueprint
```

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma** + PostgreSQL
- **S3-compatible storage** for lesson assets
- **Docker** for deployment

## Docs

- `docs/PRODUCT_TZ.md` — Product spec
- `docs/DECISIONS.md` — Accepted decisions (overrides TZ)
- `docs/ARCHITECTURE.md` — System architecture
- `docs/IMPLEMENTATION_PLAN.md` — Phase plan
