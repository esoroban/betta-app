# BETTA_APP — Deploy Plan

## Решение

Создать **отдельный Git-репозиторий** для BETTA_APP и деплоить на Render.
Картинки — на Cloudflare R2 с самого начала.

---

## Почему отдельный репо

| Фактор | Монорепо (сейчас) | Отдельный репо |
|---|---|---|
| Размер | ~3GB (APP_ALPHA, pipeline, assets) | ~1MB (только код BETTA) |
| CI/CD | Render тянет весь репо для каждого деплоя | Тянет только BETTA код |
| Доступ | Сотрудники видят pipeline, recovery, legacy | Видят только продукт |
| Деплой | Нужен root directory override | Стандартный root |
| Git history | Перемешана с pipeline коммитами | Чистая продуктовая история |
| Секреты | Один `.env` на весь репо | Изолированный `.env` |

## Что переезжает в новый репо

```
betta-app/                    ← новый репо
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── lessons/
│   │   │   ├── users/
│   │   │   └── health/
│   │   ├── dashboard/
│   │   ├── lessons/[id]/
│   │   └── login/
│   └── lib/
│       ├── auth.ts
│       ├── prisma.ts
│       ├── roles.ts
│       ├── rate-limit.ts
│       └── lessons.ts
├── tests/
│   └── e2e/
├── docs/                     ← продуктовые доки
│   ├── PRODUCT_TZ.md
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_MODEL.md
│   ├── DECISIONS.md
│   └── IMPLEMENTATION_PLAN.md
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Что НЕ переезжает

- `APP_ALPHA/` — legacy, остаётся в старом репо
- `PIPELINE/`, `TOOLS/`, `SERVER/` — pipeline, остаётся
- `ASSETS/` — переезжает на R2, не в Git
- `RECOVERY/` — остаётся в старом репо
- `01_LESSONS_RAW/`, `02_LESSONS_EN_CANONICAL/` — остаётся

## Что остаётся в старом репо

Старый репо `SulaSlovaOnlineLessons` продолжает жить для:
- Pipeline (генерация уроков, тесты, assets)
- APP_ALPHA (если нужно)
- BETTA_APP/experiments/ (UX моки — reference)
- Ссылка в README на новый репо

---

## Cloudflare R2 — план

### Bucket structure

```
betta-assets/                 ← R2 bucket
├── lessons/
│   ├── 1A/
│   │   ├── 1a_thumbnail.png
│   │   ├── 1a_sc1_bg.png
│   │   ├── 1a_sc2_bg.png
│   │   ├── 1a_sc2_bg_children_icecream.png
│   │   ├── 1a_sc2_obj_icecream_choc.png
│   │   └── ...
│   ├── 1B/
│   └── ...
├── candidates/               ← runtime: candidate images от генерации
│   ├── {candidateId}.png
│   └── ...
└── runtime/                  ← runtime JSONs (опционально)
    ├── lesson_1A_runtime.json
    └── ...
```

### Доступ

Два варианта:
1. **Public bucket** — R2 custom domain (e.g. `assets.sylaslova.com`), `<img>` ссылается напрямую
2. **Через API proxy** — `/api/assets/...` → R2 fetch (текущая схема, но с R2 backend)

Рекомендация: **public bucket** — проще, быстрее (CDN), не нагружает Node.js.

### Шаги настройки R2

1. Cloudflare Dashboard → R2 → Create bucket `betta-assets`
2. Settings → Public access → Enable (или custom domain)
3. Получить API tokens: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`
4. Upload:
   ```bash
   # Установить wrangler
   npm install -g wrangler
   wrangler login
   
   # Залить все assets
   for dir in ASSETS/*/; do
     lesson=$(basename $dir)
     wrangler r2 object put "betta-assets/lessons/$lesson/" \
       --file="$dir" --recursive
   done
   ```
5. Залить runtime JSONs:
   ```bash
   for f in SERVER/lesson_*_runtime.json; do
     name=$(basename $f)
     wrangler r2 object put "betta-assets/runtime/$name" --file="$f"
   done
   ```

### Переменные для Render

```
R2_PUBLIC_URL=https://assets.sylaslova.com    # или R2 public URL
R2_ACCESS_KEY_ID=...                           # для upload candidate images
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET=betta-assets
```

---

## Пошаговый план действий

### Этап 1: R2 bucket (15 мин)

1. [ ] Создать Cloudflare аккаунт (или использовать существующий)
2. [ ] Создать R2 bucket `betta-assets`
3. [ ] Включить public access
4. [ ] Получить API keys

### Этап 2: Upload assets (20 мин)

5. [ ] Установить `wrangler`
6. [ ] Залить `ASSETS/` → `betta-assets/lessons/`
7. [ ] Залить `SERVER/lesson_*_runtime.json` → `betta-assets/runtime/`
8. [ ] Проверить доступ по URL

### Этап 3: Новый репо (30 мин)

9. [ ] Создать GitHub repo `esoroban/betta-app` (private)
10. [ ] Скопировать код из `BETTA_APP/src/` в root нового репо
11. [ ] Скопировать `BETTA_APP/docs/` → `docs/`
12. [ ] Обновить `lessons.ts` — читать runtime JSON из R2 (fetch) вместо filesystem
13. [ ] Обновить asset route — redirect на R2 public URL вместо fs.readFileSync
14. [ ] Обновить Dockerfile — убрать COPY data/, добавить R2 env vars
15. [ ] `npm run build` — проверить
16. [ ] `npm test` — прогнать e2e
17. [ ] git push

### Этап 4: Render deploy (15 мин)

18. [ ] Render Dashboard → New Web Service → Connect `betta-app` repo
19. [ ] New PostgreSQL → free plan
20. [ ] Set env vars: `DATABASE_URL`, `SESSION_SECRET`, `R2_PUBLIC_URL`
21. [ ] Deploy → проверить `/api/health`
22. [ ] Проверить login → dashboard → lesson detail

### Этап 5: Проверка (10 мин)

23. [ ] Login всеми ролями
24. [ ] Dashboard показывает 25 уроков с thumbnails
25. [ ] Lesson detail: картинки, навигация, редактирование
26. [ ] Role switch работает
27. [ ] Admin: создание пользователя

---

## Изменения в коде для R2

### lessons.ts — читать JSONs

```typescript
// Вместо fs.readFileSync
// В dev: читаем из файлов (для локальной работы)
// В production: fetch из R2

const R2_URL = process.env.R2_PUBLIC_URL;

async function getLesson(id: string) {
  if (R2_URL) {
    const res = await fetch(`${R2_URL}/runtime/lesson_${id}_runtime.json`);
    return res.json();
  }
  // fallback: local filesystem
  return JSON.parse(fs.readFileSync(...));
}
```

### Assets route — redirect

```typescript
// Вместо fs.readFileSync + Response
// В production: redirect к R2

export async function GET(request, { params }) {
  const segments = (await params).path;
  if (process.env.R2_PUBLIC_URL) {
    const url = `${process.env.R2_PUBLIC_URL}/lessons/${segments.join("/")}`;
    return Response.redirect(url, 302);
  }
  // fallback: serve from filesystem
}
```

### Dockerfile — без данных

```dockerfile
# Убрать:
# COPY --chown=nextjs:nodejs data/SERVER ./data/SERVER
# COPY --chown=nextjs:nodejs data/ASSETS ./data/ASSETS
# COPY --chown=nextjs:nodejs data/TOOLS ./data/TOOLS

# Docker image: ~100MB вместо ~500MB
```

---

## Безопасность

| Аспект | Решение |
|---|---|
| R2 bucket | Public read для assets, write только по API key |
| API keys | В Render env vars, не в коде |
| Database | Render managed, не exposed |
| Passwords | bcrypt hash, не plaintext |
| Sessions | HTTP-only cookie, server-side storage |
| Rate limit | 5 login attempts/min in production |
| CORS | Same-origin (Next.js serves everything) |
| Image upload | Только через API с auth check |
| Path traversal | Validated in asset route |

---

## Стоимость

| Сервис | Plan | Цена |
|---|---|---|
| Render Web Service | Free / Starter $7/mo | $0-7/mo |
| Render PostgreSQL | Free (90 days) / Starter $7/mo | $0-7/mo |
| Cloudflare R2 | 10GB free, then $0.015/GB | $0/mo (340MB < 10GB) |
| **Total** | | **$0-14/mo** |
