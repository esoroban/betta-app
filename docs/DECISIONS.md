# BETTA_APP — Product Decisions

Решения, принятые 2026-04-04. Эти решения имеют приоритет над PRODUCT_TZ.md и ARCHITECTURE.md там, где возникают расхождения.

---

## D1. Одна таблица EditCandidate

Все правки (текст, картинка, prompt, overlay, brief) идут в одну таблицу `EditCandidate` с полем `candidateType`. Не делим на TextCandidate / ImageCandidate.

## D2. Administrator = approver + publisher

**Изменение относительно ТЗ.**

Было: administrator approve/reject, owner publish/rollback.

Стало:
- **Administrator** — основной рабочий процесс: approve/reject candidates + publish + rollback.
- **Owner** — только назначает администраторов, не занимается ежедневным approve/publish.

Причина: удобно по странам — один owner назначает administrator-а на регион, тот полностью ведёт процесс.

Следствия:
- Publish button виден administrator и owner.
- Rollback доступен administrator и owner.
- Owner сохраняет все права administrator-а + управление администраторами.

## D3. Teacher НЕ редактирует уроки

**Изменение относительно ТЗ.**

Было: teacher с permission редактирует и создаёт candidates.

Стало:
- **Teacher** — только ведёт урок. Не создаёт edit candidates. Не имеет edit affordances.
- **Revisioner** — особо доверенный учитель, который имеет право вносить предложения. Создаёт edit candidates.

Следствия:
- `TeacherRevisionPermission` убираем — не нужна. Revisioner редактирует по роли.
- Action strip виден только для revisioner, administrator, owner.
- Teacher видит lesson detail как viewer (с teacher text), без edit buttons.
- В будущем runtime teacher ведёт урок для студентов.

## D4. Auth MVP — только credentials

Google OAuth и soroban.ua авторизация не входят в MVP. Только email + password.

LoginIdentity.provider в MVP всегда `"credentials"`. Схема готова к расширению, но код OAuth не пишем.

## D5. Images — локально, потом S3

В MVP candidate images хранятся в локальной файловой системе (`BETTA_APP/storage/candidates/`). Быстрая миграция на S3 запланирована, но не блокирует MVP.

## D6. Все 25 уроков

Dashboard показывает все уроки из `SERVER/lesson_*_runtime.json`. Никакого подмножества.

## D7. Docker-first deployment

Всё должно работать в Docker для передачи DevOps:
- `docker compose up` поднимает полный dev environment
- Production build: один Docker image Next.js + Prisma
- Target deploy: Render
- compose: app + postgres (MinIO позже при переходе на S3)

## D8. Обновлённая иерархия ролей

```
owner
  ├── назначает administrator-ов
  ├── может делать всё что administrator
  └── глобальный надзор

administrator (per region/country)
  ├── approve / reject candidates
  ├── publish / rollback
  ├── создаёт revisioner, teacher, student
  └── операционное управление

revisioner
  ├── просмотр уроков
  ├── создание edit candidates (предложения правок)
  ├── НЕ approve, НЕ publish
  └── переключение в teacher / student mode

teacher
  ├── ведение урока (future runtime)
  ├── просмотр lesson detail (read-only + teacher text)
  ├── НЕ редактирует, НЕ создаёт candidates
  └── переключение в student mode

student
  └── потребление урока (future runtime)
```
