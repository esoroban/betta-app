# DevOps Migration Guide — Render → Dedicated Server

## Что есть на Render

| Компонент | Что хранит | Как забрать |
|---|---|---|
| **PostgreSQL** `betta-db` | Пользователи, правки, публикации, аудит | `pg_dump` |
| **Persistent Disk** `/app/storage/` | Загруженные/сгенерированные картинки | rsync / tar |
| **Docker Image** `data/` | Исходные lesson JSONs + 340MB baseline картинок | Из Git репо |
| **Git Repo** `esoroban/betta-app` | Весь код приложения | `git clone` |

## Пошаговая миграция

### 1. Экспорт базы данных с Render

```bash
# Получить CONNECTION_STRING из Render Dashboard → betta-db → Connect → External
pg_dump "postgres://beta:PASSWORD@HOST:5432/betta" > betta_backup.sql

# Или через Render CLI
render pgdump betta-db > betta_backup.sql
```

Это содержит:
- Все пользователи (users)
- Все сессии (app_sessions)
- Все правки ревизионеров (edit_candidates)
- Все опубликованные версии (publish_versions)
- Весь аудит (audit_events)

### 2. Экспорт файлов с persistent disk

```bash
# SSH в Render shell (Dashboard → betta-app → Shell)
tar -czf /tmp/storage-backup.tar.gz -C /app/storage .

# Скачать через Render Dashboard или:
# Render не дает прямой rsync, поэтому вариант:
# 1. Добавить API endpoint для скачивания backup (временно)
# 2. Использовать Render shell + curl для отправки на свой сервер
```

### 3. Развернуть на dedicated сервере

```bash
# 1. Клонировать код
git clone https://github.com/esoroban/betta-app.git
cd betta-app

# 2. Подготовить данные (если не в репо)
bash scripts/prepare-data.sh /path/to/SylaSlova_only_online

# 3. Настроить .env
cp .env.example .env
# Отредактировать:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/betta
#   SESSION_SECRET=сгенерировать
#   STORAGE_PATH=/path/to/persistent/storage

# 4. Импортировать базу
createdb betta
psql betta < betta_backup.sql

# 5. Восстановить файлы
mkdir -p /path/to/persistent/storage
tar -xzf storage-backup.tar.gz -C /path/to/persistent/storage

# 6. Запустить через Docker
docker compose up -d

# 7. Или без Docker
npm install
npx prisma generate
npm run build
npm start
```

### 4. Docker Compose для dedicated сервера

```yaml
# docker-compose.prod.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes:
      - storage:/app/storage      # persistent volume
    environment:
      DATABASE_URL: postgresql://beta:PASSWORD@postgres:5432/betta
      SESSION_SECRET: CHANGE_THIS
      STORAGE_PATH: /app/storage
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: beta
      POSTGRES_PASSWORD: PASSWORD
      POSTGRES_DB: betta

volumes:
  pgdata:
  storage:
```

## Что критически важно не потерять

| Приоритет | Данные | Источник | Размер |
|---|---|---|---|
| **1. КРИТИЧНО** | База данных | `pg_dump` | ~10-50MB |
| **2. КРИТИЧНО** | Загруженные картинки | `/app/storage/` | растёт |
| **3. Можно пересоздать** | Baseline картинки | Git `data/ASSETS/` | 340MB |
| **4. Можно пересоздать** | Lesson JSONs | Git `data/SERVER/` | 2.5MB |

## Бэкапы

Рекомендуемый автоматический бэкап на dedicated сервере:

```bash
#!/bin/bash
# /etc/cron.daily/betta-backup.sh
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backups/betta

mkdir -p $BACKUP_DIR

# База
pg_dump betta | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Файлы
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz -C /app/storage .

# Удалить старше 30 дней
find $BACKUP_DIR -mtime +30 -delete
```

## Переменные окружения

| Variable | Обязательно | Описание |
|---|---|---|
| `DATABASE_URL` | Да | PostgreSQL connection string |
| `SESSION_SECRET` | Да | Случайная строка для подписи cookies |
| `STORAGE_PATH` | Нет | Путь к persistent storage (default: `./storage`) |
| `NODE_ENV` | Нет | `production` для prod |
| `PORT` | Нет | default 3000 |

## Проверка после миграции

```bash
# 1. Health check
curl https://your-server/api/health
# Должен вернуть: {"status":"ok", "storage":{"root":"/app/storage","exists":true}}

# 2. Login
curl -X POST https://your-server/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sylaslova.com","password":"owner123"}'
# Должен вернуть user + sessionId

# 3. Lessons
curl https://your-server/api/lessons -b cookies.txt
# Должен вернуть 25 уроков

# 4. Проверить в браузере
# - Login → Dashboard → открыть урок → картинки грузятся
# - Admin → пользователи на месте
# - Все правки ревизионеров сохранены
```
