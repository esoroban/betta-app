# BETTA_APP — Implementation Plan

Решения из `DECISIONS.md` имеют приоритет. Этот план уже учитывает их.

---

## Scope

Три фазы:

1. **Auth + Roles + Docker** — вход, сессия, роли, Docker setup
2. **Lesson Read + Edit Candidates** — уроки из файлов, revisioner создаёт candidates
3. **Admin Review + Publish + Rollback** — administrator approve/reject/publish/rollback

---

## Phase 1: Auth + Roles + Docker

**Цель:** Docker compose up → postgres + app → login → сессия → role-aware UI.

### 1.1 Docker Setup

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://beta:beta@postgres:5432/betta
      SESSION_SECRET: ...
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: beta
      POSTGRES_PASSWORD: beta
      POSTGRES_DB: betta
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

volumes:
  pgdata:
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

### 1.2 Prisma Schema

```prisma
enum Role {
  owner
  administrator
  revisioner
  teacher
  student
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  displayName   String
  baseRole      Role
  status        String    @default("active") // active | inactive
  preferredLang String    @default("en")
  createdAt     DateTime  @default(now())
  createdBy     String?
  deactivatedAt DateTime?
}
```

MVP упрощение: раз auth только credentials и нет Google/Soroban, LoginIdentity / AccountLink / account picker не нужны. Один User = один email = один password. Расширим когда добавим OAuth.

### 1.3 Session

HTTP-only cookie с session ID → AppSession в БД:

```prisma
model AppSession {
  id             String   @id @default(cuid())
  userId         String
  baseRole       Role
  activeRoleMode Role
  createdAt      DateTime @default(now())
  lastSeenAt     DateTime @updatedAt
  expiresAt      DateTime
  isRevoked      Boolean  @default(false)
  user           User     @relation(fields: [userId], references: [id])
}
```

### 1.4 API Endpoints

| Method | Path | Кто | Что делает |
|---|---|---|---|
| POST | `/api/auth/login` | анон | email + password → session cookie |
| POST | `/api/auth/logout` | все | revoke session |
| GET | `/api/auth/session` | все | текущий user, role, activeRoleMode |
| POST | `/api/auth/switch-role` | все кроме student | сменить activeRoleMode |

### 1.5 Role Logic

```typescript
// Кто может переключиться в кого
const SWITCH_MAP: Record<Role, Role[]> = {
  owner:         ["administrator", "revisioner", "teacher", "student"],
  administrator: ["revisioner", "teacher", "student"],
  revisioner:    ["teacher", "student"],
  teacher:       ["student"],
  student:       [],
};

// Кто может создавать кого
const CREATE_MAP: Record<Role, Role[]> = {
  owner:         ["administrator", "revisioner", "teacher", "student"],
  administrator: ["revisioner", "teacher", "student"],
  revisioner:    [],
  teacher:       [],
  student:       [],
};
```

### 1.6 Middleware

```typescript
// withAuth — проверяет session cookie, ставит req.user
// withRole(minRole) — проверяет activeRoleMode
// 401 — нет сессии
// 403 — нет доступа по роли
```

### 1.7 Seed

```typescript
// prisma/seed.ts
// owner:         owner@sylaslova.com / owner123
// administrator: admin@sylaslova.com / admin123
// revisioner:    revisioner@sylaslova.com / rev123
// teacher 1:     teacher1@sylaslova.com / teach123
// teacher 2:     teacher2@sylaslova.com / teach123
// student 1:     student1@sylaslova.com / stud123
// student 2:     student2@sylaslova.com / stud123
```

### 1.8 UI Pages

| Page | Route | Что |
|---|---|---|
| Login | `/login` | email + password form |
| Dashboard redirect | `/` | redirect по роли |

### 1.9 Задачи Phase 1

| # | Задача |
|---|---|
| 1.1 | Next.js init: `create-next-app`, TypeScript, App Router |
| 1.2 | Docker compose: postgres + app + dev/prod configs |
| 1.3 | Dockerfile: multi-stage build, standalone output |
| 1.4 | Prisma schema: User, AppSession, Role enum |
| 1.5 | `npx prisma migrate dev` — первая миграция |
| 1.6 | Seed: 7 пользователей |
| 1.7 | API: login (bcrypt verify, create session, set cookie) |
| 1.8 | API: logout, session, switch-role |
| 1.9 | Middleware: withAuth, withRole |
| 1.10 | Login page: form + error state |
| 1.11 | Rate limiting: 5 attempts per minute per email |
| 1.12 | Tests: login flow, 401/403, role switch, wrong password |
| 1.13 | `docker compose up` → всё работает от нуля |

### 1.10 Критерий готовности

- [ ] `docker compose up` — postgres + app стартуют
- [ ] Seed отрабатывает, 7 users в БД
- [ ] Owner логинится, получает cookie
- [ ] `GET /api/auth/session` возвращает user + role
- [ ] Role switch: owner → teacher → student → back to owner
- [ ] 401 без cookie на защищённый route
- [ ] 403 при switch в роль выше базовой
- [ ] Login page работает в браузере
- [ ] Тесты проходят

---

## Phase 2: Lesson Read + Edit Candidates

**Цель:** revisioner открывает урок, видит published/baseline state, создаёт edit candidate.

### 2.1 Content Adapter

```typescript
class LessonFileAdapter {
  // Читает SERVER/lesson_{id}_runtime.json → нормализованная модель
  async getLesson(id: string): Promise<LessonReadModel>

  // Все lesson_*_runtime.json → list summaries
  async listLessons(): Promise<LessonSummary[]>

  // TOOLS/image_review/{id}_briefs.json → briefs
  async getBriefs(id: string): Promise<SceneBrief[]>

  // ASSETS/{id}/ → list image paths
  async getAssets(id: string): Promise<string[]>
}
```

### 2.2 Prisma Schema (дополнение)

```prisma
model EditCandidate {
  id             String   @id @default(cuid())
  lessonId       String
  sceneId        String?
  stepId         String?
  locationKey    String   // "sc1.sc1_3.prompt"
  field          String   // "prompt" | "explanation" | "overlay" | "brief" | "image"
  candidateType  String   // "text" | "image"
  originalValue  String   // JSON string
  proposedValue  String   // JSON string
  languageCode   String?
  status         String   @default("pending")
  authorUserId   String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  reviewedBy     String?
  reviewedAt     DateTime?
  reviewNote     String?
  withdrawnAt    DateTime?
  publishVersionId String?
  author         User     @relation(fields: [authorUserId], references: [id])
}

model AuditEvent {
  id           String   @id @default(cuid())
  actorUserId  String
  actionType   String   // "candidate.created", "candidate.accepted", ...
  targetType   String   // "EditCandidate", "User", "PublishVersion"
  targetId     String
  metadata     Json?
  createdAt    DateTime @default(now())
}
```

### 2.3 API Endpoints

| Method | Path | Кто | Что |
|---|---|---|---|
| GET | `/api/lessons` | auth | Dashboard: список всех уроков |
| GET | `/api/lessons/:id` | auth | Lesson detail (published-first) |
| GET | `/api/lessons/:id/candidates` | revisioner+ | Pending candidates по уроку |
| POST | `/api/candidates` | revisioner+ | Создать edit candidate |
| POST | `/api/candidates/:id/withdraw` | автор | Отозвать свой candidate |

### 2.4 Published-First Logic

```typescript
class LessonQueryService {
  async getDetail(lessonId: string) {
    const published = await prisma.publishVersion.findFirst({
      where: { lessonId, isActive: true }
    });
    if (published) return { source: "published", data: published.snapshot };

    const baseline = await this.fileAdapter.getLesson(lessonId);
    return { source: "baseline", data: baseline };
  }
}
```

### 2.5 UI Pages

| Page | Route | Кто видит | Что |
|---|---|---|---|
| Lessons Dashboard | `/lessons` | все auth | Карточки уроков, pending badges |
| Lesson Detail | `/lessons/:id` | все auth | Immersive view (наш mock → React) |

Lesson Detail:
- teacher, student → read-only view (как teacher видит урок)
- revisioner → read-only view + action strip + editor drawers
- administrator, owner → то же что revisioner

### 2.6 Задачи Phase 2

| # | Задача |
|---|---|
| 2.1 | Prisma: EditCandidate, AuditEvent, миграция |
| 2.2 | LessonFileAdapter: парсинг runtime JSON, briefs, assets listing |
| 2.3 | LessonQueryService: published-first logic |
| 2.4 | API: GET /api/lessons — dashboard |
| 2.5 | API: GET /api/lessons/:id — detail |
| 2.6 | API: POST /api/candidates — create (revisioner+ only) |
| 2.7 | API: POST /api/candidates/:id/withdraw — author only |
| 2.8 | AuditService: log events |
| 2.9 | UI: Lessons Dashboard page (Next.js) |
| 2.10 | UI: Lesson Detail page — портируем mock на React |
| 2.11 | UI: Editor drawers → POST /api/candidates при Save |
| 2.12 | Role guard: teacher НЕ видит action strip и edit buttons |
| 2.13 | Tests: create candidate, withdraw, 403 for teacher, published-first |

### 2.7 Критерий готовности

- [ ] Dashboard показывает все 25 уроков из SERVER/
- [ ] Lesson detail показывает baseline (пока нет published versions)
- [ ] Revisioner создаёт text candidate через drawer
- [ ] Teacher видит lesson detail без edit buttons
- [ ] Candidate появляется в `GET /api/lessons/:id/candidates`
- [ ] Revisioner может withdraw свой candidate
- [ ] Teacher получает 403 при попытке создать candidate
- [ ] AuditEvent записывается

---

## Phase 3: Admin Review + Publish + Rollback

**Цель:** administrator видит pending, approve/reject, publish. Lesson отражает snapshot.

### 3.1 Prisma Schema (дополнение)

```prisma
model PublishVersion {
  id            String   @id @default(cuid())
  lessonId      String
  versionNumber Int
  snapshot      Json     // полный materialized snapshot
  description   String?
  isActive      Boolean  @default(false)
  publishedBy   String
  publishedAt   DateTime @default(now())
  candidates    EditCandidate[]
}
```

### 3.2 API Endpoints

| Method | Path | Кто | Что |
|---|---|---|---|
| POST | `/api/candidates/:id/accept` | administrator+ | Accept candidate |
| POST | `/api/candidates/:id/reject` | administrator+ | Reject candidate |
| GET | `/api/revision/dashboard` | administrator+ | Teachers/revisionеры + pending counts |
| GET | `/api/revision/users/:id/lessons` | administrator+ | Pending по конкретному автору |
| GET | `/api/lessons/:id/review` | administrator+ | Review page: candidates grouped by scene |
| POST | `/api/lessons/:id/publish` | administrator+ | Publish new version |
| GET | `/api/lessons/:id/versions` | administrator+ | Version history |
| POST | `/api/lessons/:id/rollback` | administrator+ | Rollback к выбранной version |
| POST | `/api/users` | administrator+ | Create user |
| GET | `/api/users` | administrator+ | List users |
| POST | `/api/users/:id/deactivate` | administrator+ | Deactivate user |

### 3.3 PublishService

```typescript
class PublishService {
  async publish(lessonId: string, actorId: string, description?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Current live state (published or baseline)
      const current = await this.lessonQuery.getDetail(lessonId);

      // 2. Accepted unpublished candidates
      const accepted = await tx.editCandidate.findMany({
        where: { lessonId, status: "accepted", publishVersionId: null }
      });
      if (!accepted.length) throw new Error("Nothing to publish");

      // 3. Apply changes → snapshot
      const snapshot = applyChanges(current.data, accepted);

      // 4. Deactivate previous
      await tx.publishVersion.updateMany({
        where: { lessonId, isActive: true },
        data: { isActive: false }
      });

      // 5. Create new version
      const last = await tx.publishVersion.findFirst({
        where: { lessonId }, orderBy: { versionNumber: "desc" }
      });
      const version = await tx.publishVersion.create({
        data: {
          lessonId,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          snapshot,
          isActive: true,
          publishedBy: actorId,
          description,
        }
      });

      // 6. Mark candidates published
      await tx.editCandidate.updateMany({
        where: { id: { in: accepted.map(c => c.id) } },
        data: { status: "published", publishVersionId: version.id }
      });

      // 7. Audit
      await this.audit.log(actorId, "publish.created", "PublishVersion", version.id);

      return version;
    });
  }

  async rollback(lessonId: string, targetVersionId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.publishVersion.updateMany({
        where: { lessonId, isActive: true },
        data: { isActive: false }
      });
      await tx.publishVersion.update({
        where: { id: targetVersionId },
        data: { isActive: true }
      });
      await this.audit.log(actorId, "rollback.executed", "PublishVersion", targetVersionId);
    });
  }
}
```

### 3.4 UI Pages

| Page | Route | Кто | Что |
|---|---|---|---|
| Revision Dashboard | `/revision` | administrator+ | Авторы + pending counts |
| Lesson Review | `/lessons/:id/review` | administrator+ | Comparison blocks, accept/reject, publish |
| Version History | `/lessons/:id/versions` | administrator+ | List versions, rollback button |
| User Management | `/admin/users` | administrator+ | Create, list, deactivate users |

### 3.5 Задачи Phase 3

| # | Задача |
|---|---|
| 3.1 | Prisma: PublishVersion, миграция |
| 3.2 | API: accept, reject candidates |
| 3.3 | API: revision dashboard, user drilldown |
| 3.4 | API: lesson review (candidates by scene) |
| 3.5 | PublishService: snapshot materialization + publish |
| 3.6 | API: publish |
| 3.7 | API: version history |
| 3.8 | RollbackService + API: rollback |
| 3.9 | API: user CRUD (create, list, deactivate) |
| 3.10 | UI: Revision Dashboard |
| 3.11 | UI: Lesson Review page (comparison blocks, accept/reject) |
| 3.12 | UI: Publish panel |
| 3.13 | UI: Version History + rollback confirmation |
| 3.14 | UI: User Management page |
| 3.15 | E2E tests: full flow revisioner→admin→publish→verify→rollback→verify |

### 3.6 Критерий готовности

- [ ] Administrator видит revision dashboard с pending counts
- [ ] Administrator accept/reject candidates
- [ ] Administrator publish → snapshot создан → lesson detail отражает
- [ ] Administrator rollback → lesson detail возвращается к предыдущей версии
- [ ] Administrator создаёт нового revisioner/teacher/student
- [ ] Revisioner НЕ может accept/reject/publish (403)
- [ ] E2E flow: create candidate → accept → publish → rollback проходит

---

## Deployment on Render

```
Render setup:
  - Web Service: Docker, auto-deploy from main branch
  - PostgreSQL: Render managed DB
  - Environment:
    - DATABASE_URL (from Render DB)
    - SESSION_SECRET (generated)
  - Build: docker build
  - Start: node server.js
  - Health check: /api/health
```

### Render-specific tasks

| # | Задача |
|---|---|
| R.1 | Dockerfile production-ready (multi-stage, standalone) |
| R.2 | `render.yaml` (Infrastructure as Code) |
| R.3 | Health check endpoint `/api/health` |
| R.4 | Prisma migrate on deploy (postBuild or entrypoint script) |
| R.5 | Environment variable documentation for DevOps |

---

## Summary

```
Phase 1: Auth + Docker          ~13 задач
  docker compose up → login → session → role switch

Phase 2: Lesson Read + Edit     ~13 задач
  25 уроков из файлов → revisioner creates candidates

Phase 3: Review + Publish       ~15 задач
  admin approve → publish snapshot → rollback

Render deployment               ~5 задач
```
