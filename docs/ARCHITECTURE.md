# BETTA_APP Architecture

## 1. Контекст

BETTA_APP это новый продуктовый трек, который мы строим с нуля после Alpha.

Ключевая рамка:

- Alpha дала полезный стек и часть технических решений;
- Alpha оказалась перегружена лишними слоями и legacy-совместимостью;
- Beta не наследует старую архитектуру как есть;
- Beta сохраняет проверенную технологическую базу:
  - Next.js
  - React
  - TypeScript
  - Prisma
  - PostgreSQL
  - Docker
- Beta проектируется вокруг одного понятного сценария:
  - редактирование урока
  - отправка изменений на ревизию
  - принятие/отклонение
  - publish
  - rollback

MVP Beta не включает classroom runtime. Runtime остаётся отдельным будущим слоем, который будет потреблять published snapshot.

## 2. Архитектурная цель

Новая архитектура должна решить четыре проблемы Alpha:

1. убрать смешение revision-plane и runtime-plane;
2. убрать лишнюю сложность вокруг grants/tokens/reviewer-only legacy модели;
3. сделать published state главным источником истины;
4. сделать систему понятной продуктово: роли, статусы, flow, источники данных.

Итоговая идея:

- BETTA_APP это не generic CMS;
- BETTA_APP это revision and publishing system для существующего урокового контента;
- приложение живёт поверх текущих локальных файлов уроков и ассетов;
- результатом работы является versioned published snapshot урока.

## 3. High-Level Architecture

```text
                 Existing Repository Content
  SERVER/lesson_*_runtime.json
  ASSETS/<lesson_id>/*
  TOOLS/image_review/*
                    |
                    | read-only adapters
                    v
  +------------------------------------------------------+
  |                     BETTA_APP                         |
  |                                                      |
  |  Next.js App Router                                  |
  |  - Web UI                                            |
  |  - Route Handlers / API                              |
  |  - Server Actions only where they simplify UX        |
  |                                                      |
  |  Domain Layer                                        |
  |  - auth / role switch                                |
  |  - lessons query model                               |
  |  - edit candidates                                   |
  |  - revision decisions                                |
  |  - publish / rollback                                |
  |                                                      |
  |  Infrastructure Layer                                |
  |  - Prisma repositories                               |
  |  - file adapters to SERVER/ASSETS/TOOLS              |
  |  - object storage adapter for candidate images       |
  +-------------------------+----------------------------+
                            |
             +--------------+--------------+
             |                             |
             v                             v
       PostgreSQL                    S3-compatible storage
    app-owned state only              candidate image files
```

## 4. Системные границы

### 4.1 Что входит в Beta

В Beta входят:

- аутентификация и сессия;
- роли и role-switch;
- dashboard уроков;
- lesson detail published-first;
- teacher/revisioner edit flow;
- administrator review flow;
- owner publish and rollback flow;
- audit trail;
- user management;
- permission management для teacher revision access;
- published snapshot storage.

### 4.2 Что не входит в Beta MVP

В Beta MVP не входят:

- classroom/player/runtime;
- live lesson session management;
- student response capture;
- сложная генерация изображений как самостоятельный пайплайн;
- старая reviewer-token архитектура Alpha;
- legacy grants/tokens/review access model из Alpha;
- попытка сделать универсальную CMS вне модели текущих уроков.

## 5. Основной архитектурный принцип

Beta делится на три логических плоскости.

### 5.1 Content Source Plane

Это внешний read-only слой, из которого приложение читает исходный контент:

- `SERVER/lesson_*_runtime.json`
- `ASSETS/`
- `TOOLS/image_review/`

Этот слой не принадлежит приложению. Приложение не редактирует его напрямую в MVP.

### 5.2 Revision Plane

Это основная Beta-плоскость:

- пользователь открывает урок;
- видит published состояние;
- создаёт candidate changes;
- изменения проходят review;
- accepted changes готовятся к publish;
- owner выпускает новую published version.

### 5.3 Delivery Plane

Это будущий слой, не реализуемый в Beta MVP:

- teacher/student runtime;
- classroom execution;
- session state.

Важное правило:

- Delivery plane читает published snapshot;
- Delivery plane не должен знать про внутренние candidate/review сущности.

### 5.4 Future Runtime Plane

Архитектуру runtime нужно учесть уже сейчас, даже если она не входит в первую поставку.

Целевой сценарий:

- teacher запускает урок для группы;
- создаётся live classroom session;
- teacher двигается по lesson flow;
- у student-экранов синхронно появляется текущий слайд;
- интерактивные шаги и опросы открываются по сигналу teacher;
- ответы учеников собираются внутри session-контекста.

Ключевое правило совместимости:

- runtime никогда не читает draft candidates;
- runtime работает только от `active published lesson snapshot`.

Это означает, что Beta уже сейчас должна проектировать published snapshot как runtime-ready контракт, а не только как review artifact.

## 6. Источники истины

### 6.1 Lesson source of truth

Правило для lesson detail:

1. если для урока есть active published version, UI и API показывают её;
2. если published version ещё нет, UI и API показывают baseline из pipeline files.

Следствие:

- пользователь никогда не должен видеть устаревший baseline поверх уже опубликованного состояния;
- все original values для новых кандидатов снимаются из current live state.

### 6.2 Image source of truth

Рекомендуемое каноническое правило:

- active published image assignment хранится в published snapshot;
- `scene.image_assets` и подобные представления являются derived view;
- candidate image files живут отдельно и становятся live только после publish.

### 6.3 Candidate source of truth

Для ревизии источником истины являются записи БД:

- text candidates;
- image candidates;
- review decisions;
- publish versions;
- audit events.

## 7. Роли и доступ

Beta опирается на продуктовую иерархию из ТЗ:

- `owner`
- `administrator`
- `revisioner`
- `teacher`
- `student`

### 7.1 Role model

Архитектурно важно разделять:

- базовую роль пользователя;
- активный режим интерфейса;
- точечные permission-флаги.

Поэтому модель должна быть такой:

- `user.role` или `user_roles` задаёт продуктовую принадлежность;
- `active_role_mode` живёт в session/UI и определяет текущий интерфейс;
- отдельная сущность permission управляет правом teacher редактировать и отправлять revision candidates.

### 7.2 Почему не переносим Alpha access model

В Alpha был сильный акцент на restricted reviewer access, scoped grants и token access.

Для Beta это избыточно, потому что:

- у нас уже есть явные продуктовые роли;
- revision workflow встроен в основной продукт;
- временные review-token сценарии не являются ядром MVP;
- они усложняют auth, audit и UI без пользы для первой фазы.

Поэтому в Beta:

- основной доступ только через обычные аккаунты;
- role-switch делается как явная UI/session-функция;
- teacher revision access контролируется отдельным permission, а не token grants.

### 7.3 Authentication architecture

В системе сразу нужно закладывать три способа авторизации:

1. login/password по email;
2. Google authorization;
3. authorization через собственный сервис `soroban.ua`.

Это должно быть не тремя параллельными системами пользователей, а одной identity model.

Но здесь есть важное бизнес-исключение:

- для student-сценария один и тот же email или один и тот же внешний login может соответствовать нескольким разным аккаунтам внутри продукта.

Причина:

- братья и сестры могут учиться с одного родительского устройства;
- у них может быть общий email;
- у них может быть один Google account;
- у них может быть один внешний login через `soroban.ua`.

Поэтому email и внешний provider identity нельзя считать глобально уникальным человеком внутри системы.

Базовый принцип:

- в системе есть login-уровень и profile-уровень;
- один login identity может быть связан с несколькими app accounts;
- роли, permissions, audit и session behavior привязаны к конкретному app account, а не только к способу входа.

### 7.4 Auth provider model

Для этого нужен отдельный слой внешних identity providers.

Рекомендуемая модель:

- `LoginIdentity`
- `User`
- `LoginIdentityAccountLink`
- `Session`

Минимальный смысл `LoginIdentity`:

- `id`
- `provider` (`credentials` | `google` | `soroban`)
- `provider_subject_id`
- `email`
- `email_verified`
- `created_at`
- `last_login_at`

Минимальный смысл `LoginIdentityAccountLink`:

- `login_identity_id`
- `user_id`
- `is_default`
- `created_at`

То есть:

- `LoginIdentity` отвечает на вопрос "кем пользователь вошёл";
- `User` отвечает на вопрос "в какой продуктовый аккаунт он вошёл";
- связь между ними может быть many-to-many или one-to-many, но для нашего сценария минимум нужен one-login-to-many-users.

Для credentials-login:

- пароль и хэш живут в app-owned данных;
- такой login identity имеет provider `credentials`;
- один email не обязан быть уникальным user identifier внутри продукта.

Для Google:

- app получает внешний identity через OAuth/OIDC;
- локально хранится provider identity и его связи с одним или несколькими `User`.

Для `soroban.ua`:

- Beta должна проектироваться как клиент внешнего identity provider;
- локально хранится связь между identity из `soroban.ua` и одним или несколькими нашими `User`;
- авторизационная логика `soroban.ua` не должна размазываться по домену приложения.

### 7.5 Account linking rules

Нужно сразу зафиксировать правила linking, иначе потом появятся дубли пользователей.

Рекомендуемые правила:

1. email не является уникальным ключом пользователя;
2. Google account не является уникальным ключом пользователя;
3. `soroban.ua` identity не является уникальным ключом пользователя;
4. после успешной аутентификации система должна определить список доступных `User`-аккаунтов для этого login identity;
5. если аккаунт один, вход продолжается автоматически;
6. если аккаунтов несколько, пользователь выбирает нужный профиль на account-picker экране;
7. создание или linking нового app account к существующему login identity должно быть явной и аудируемой операцией;
8. роли и permissions принадлежат конкретному `User` и никогда не шарятся автоматически между sibling-аккаунтами с общим логином.

### 7.5.1 Account picker requirement

Из этого следует обязательный UX-элемент:

- после Google / `soroban.ua` / credentials login может появляться account picker;
- пользователь выбирает конкретный профиль, например одного из детей;
- только после этого создаётся полная app session.

Это особенно важно для student runtime, потому что иначе ответы и progress будут записываться не в того ученика.

### 7.6 Session requirements

Независимо от способа входа, сессия должна давать один и тот же внутренний контракт:

- `login_identity_id`
- `user_id`
- `base_role`
- `available_roles`
- `active_role_mode`
- `auth_provider`

Это важно потому, что:

- UI role-switch не должен зависеть от способа входа;
- websocket-auth в будущем runtime тоже должен опираться на единый session contract;
- audit должен видеть не только `user_id`, но и способ входа.

### 7.7 Why this matters for runtime

Когда появится online classroom, teacher и students будут подключаться к websocket после обычной app-authentication.

Поэтому уже сейчас фиксируем:

- realtime connection использует ту же identity/session систему;
- пользователь, вошедший через Google, credentials или `soroban.ua`, сначала проходит login-identity слой, а затем выбирает конкретный внутренний `User`, если профилей несколько;
- runtime authorization проверяет роли и memberships, а не конкретный auth provider.

## 8. Доменная архитектура

### 8.1 Core aggregates

Минимальный набор доменных сущностей для Beta:

- `User`
- `Lesson`
- `Scene`
- `Step`
- `EditCandidate`
- `PublishVersion`
- `TeacherRevisionPermission`
- `AuditEvent`

### 8.2 Lesson aggregate

`Lesson` в приложении не должен быть копией сырого runtime JSON.

Нужна нормализованная query/domain модель:

- metadata
- localized titles
- supported languages
- scenes
- steps
- image assignments
- publish metadata
- pending counters

Это позволяет:

- не протаскивать сырой pipeline JSON в UI;
- отделить adapter layer от продуктового API;
- позже заменить источник baseline без переписывания фронта.

### 8.3 EditCandidate model

Beta лучше строить на одной общей сущности `EditCandidate` с типом, а не на множестве разрозненных механизмов.

Минимальные поля:

- `id`
- `lesson_id`
- `scene_id`
- `step_id` или другой `location_key`
- `field`
- `candidate_type` (`text` | `image`)
- `original_value`
- `proposed_value`
- `status`
- `author_user_id`
- `reviewed_by`
- `reviewed_at`
- `withdrawn_at`
- `publish_version_id`

Статусы:

- `pending`
- `accepted`
- `rejected`
- `withdrawn`
- `published`

Это проще и чище, чем отдельные legacy-модели Alpha со своими статусными вариациями.

### 8.4 PublishVersion model

`PublishVersion` это главный доменный результат системы.

Он должен хранить:

- `lesson_id`
- `version_number`
- `snapshot`
- `is_active`
- `published_by`
- `published_at`
- `description`

Принцип:

- publish не “применяет отдельные патчи на лету” при каждом чтении;
- publish материализует полный snapshot урока;
- rollback просто переключает active version.

Это резко упрощает чтение, тестирование и отладку.

## 9. Слои приложения

Рекомендуемая структура слоёв:

### 9.1 Presentation Layer

Технология:

- Next.js App Router
- React
- server-rendered pages там, где важны data fetching и auth
- client components только для интерактивных editor/review зон

Задача слоя:

- экранная композиция;
- role-aware navigation;
- forms;
- comparison blocks;
- publish/rollback interactions;
- status rendering.

### 9.2 Application Layer

Это orchestration слой use-case уровня.

Основные use cases:

- login
- switch active role
- list lessons
- get lesson detail
- create candidate
- withdraw candidate
- list pending candidates
- accept candidate
- reject candidate
- grant permission
- revoke permission
- publish lesson
- rollback version

Именно здесь должны жить транзакционные сценарии и permission checks.

### 9.3 Domain Layer

Содержит чистую бизнес-логику:

- статусные переходы кандидатов;
- правила publish;
- правила rollback;
- source-of-truth rules;
- language fallback rules;
- role visibility rules.

Доменные правила не должны зависеть от Next.js, Prisma или файловой системы.

### 9.4 Infrastructure Layer

Содержит адаптеры:

- Prisma repositories;
- auth/session adapter;
- lesson file adapter;
- assets adapter;
- object storage adapter;
- audit logger.

Правило:

- infra умеет читать и писать;
- domain не знает, где именно это хранится.

## 10. Хранение данных

### 10.1 PostgreSQL

PostgreSQL хранит всё приложение-собственное состояние:

- users;
- roles;
- permissions;
- edit candidates;
- publish versions;
- audit log;
- session-related server state, если понадобится.

### 10.2 Prisma

Prisma используется как единственный ORM и схема-контракт между domain/application и БД.

Почему оставляем Prisma:

- стек уже проверен в Alpha;
- удобно эволюционировать схему;
- хорошо ложится на транзакционные use cases;
- упрощает тесты и seed.

### 10.3 Object Storage

Для candidate image files нужен отдельный storage.

Рекомендуемый вариант:

- S3-compatible storage;
- в локальной и серверной среде через Docker;
- MinIO как дефолтная self-hosted реализация.

Почему не хранить файлы в БД:

- хуже эксплуатационно;
- сложнее версионировать и раздавать;
- нет пользы для MVP.

## 11. Future Runtime Architecture

### 11.1 Runtime responsibilities

Будущий runtime слой отвечает за:

- создание lesson session;
- привязку session к teacher и group;
- подключение student clients;
- broadcast текущего шага всем участникам;
- приём student responses;
- сохранение progress и результатов;
- reconnect/resume поведение при потере соединения.

Он не отвечает за:

- редактирование контента;
- review workflow;
- publish;
- rollback.

### 11.2 Runtime components

Рекомендуемая схема для следующей фазы:

```text
Teacher UI / Student UI
          |
          | WebSocket
          v
  Realtime Gateway
          |
          +--------------------+
          |                    |
          v                    v
  Session Orchestrator     Presence / Fanout
          |                    |
          +---------+----------+
                    |
                    v
          PostgreSQL + Redis
                    |
                    v
         Published Lesson Snapshot
```

Роли компонентов:

- `Realtime Gateway` держит websocket connections;
- `Session Orchestrator` валидирует команды teacher и обновляет session state;
- `Presence / Fanout` управляет комнатами, подключениями и доставкой событий;
- `PostgreSQL` хранит durable session state и результаты;
- `Redis` используется как ephemeral realtime layer, pub/sub и adapter для горизонтального масштабирования.

### 11.3 Почему WebSocket нужен

Для classroom runtime polling-подход будет слабым решением.

Нужны события низкой задержки:

- `session_started`
- `slide_changed`
- `step_opened`
- `poll_opened`
- `student_answer_submitted`
- `results_revealed`
- `session_paused`
- `session_finished`

Поэтому realtime transport надо закладывать как websocket-first архитектуру.

### 11.4 Runtime data model

Чтобы Beta не заблокировала runtime, дальше нужно предусмотреть следующие будущие сущности:

- `Group`
- `GroupMembership`
- `LessonAssignment`
- `LessonSession`
- `SessionParticipant`
- `SessionStepState`
- `StudentResponse`
- `SessionEvent`

Минимальный смысл:

- `Group` объединяет teacher и students;
- `LessonAssignment` определяет, какой lesson доступен группе;
- `LessonSession` это конкретный live запуск урока;
- `SessionStepState` хранит, какой шаг сейчас активен;
- `StudentResponse` хранит ответы;
- `SessionEvent` хранит хронологию realtime-команд и изменений.

### 11.5 Runtime source of truth

В runtime должны существовать два уровня состояния:

1. durable state в PostgreSQL;
2. transient realtime state в памяти процесса и Redis.

Правило:

- истина для восстановления после reconnect или рестарта это durable session state;
- websocket-сообщения являются транспортом, а не единственным носителем состояния.

Иначе после сбоя teacher и students потеряют синхронизацию.

### 11.6 Runtime lesson contract

Чтобы runtime потом подключился без болезненной переделки, `PublishVersion.snapshot` должен уже сейчас быть годным для исполнения урока.

Минимальные требования к snapshot:

- стабильный `lesson_id`;
- стабильные `scene_id` и `step_id`;
- порядок сцен и шагов;
- step type;
- audience metadata;
- локализованные тексты;
- image assignments;
- данные для poll/options, если шаг интерактивный;
- teacher-facing text;
- fallback language metadata.

Иначе позже придётся или ломать publish format, или строить отдельный runtime-export слой.

### 11.7 Teacher command model

Runtime должен быть authority-driven:

- teacher отправляет команду;
- backend валидирует допустимость перехода;
- backend обновляет session state;
- backend рассылает событие всем student clients.

Не должно быть так:

- teacher client локально решает, какой шаг активен;
- student clients сами догоняют состояние по косвенным признакам.

То есть источник истины для live flow должен быть серверным.

### 11.8 Suggested runtime events

Минимальный набор server events:

- `session.joined`
- `session.synced`
- `session.started`
- `lesson.slide.changed`
- `lesson.step.changed`
- `poll.opened`
- `poll.closed`
- `response.accepted`
- `results.published`
- `participant.joined`
- `participant.left`
- `session.ended`

Минимальный набор teacher commands:

- `session.start`
- `session.pause`
- `session.resume`
- `session.go_to_step`
- `poll.open`
- `poll.close`
- `results.show`
- `session.end`

### 11.9 Runtime security model

Для будущего realtime слоя уже сейчас стоит зафиксировать:

- websocket connection открывается только после обычной app-authentication;
- роль и membership проверяются сервером при join;
- teacher имеет права управления только своими session;
- student может только читать live state и отправлять allowed responses;
- все teacher commands проходят server-side authorization.

### 11.10 What Beta should do now for runtime compatibility

Уже на этапе Beta нужно не реализовывать runtime, а не сломать его будущее появление.

Значит, сейчас фиксируем:

1. published snapshot как runtime-ready контракт;
2. стабильные lesson/scene/step identifiers;
3. отсутствие зависимости runtime от draft/review таблиц;
4. разделение `published content state` и `live session state`;
5. будущую возможность добавить Redis и websocket gateway без переписывания revision domain.

## 12. Интеграция с локальным контентом

### 11.1 Lesson adapter

Нужен отдельный read-only adapter, который:

- читает runtime JSON;
- читает manifests и thumbnails;
- собирает нормализованный lesson read model;
- умеет наложить active published snapshot поверх baseline;
- умеет возвращать данные для dashboard, lesson detail и review.

### 11.2 Почему adapter обязателен

Если UI начнёт работать напрямую с `SERVER/*.json`, быстро появятся проблемы:

- pipeline-структура протечёт в интерфейс;
- станет трудно менять источник данных;
- published overlay logic будет размазана по коду;
- тестировать станет сложнее.

Поэтому файл-система должна быть скрыта за адаптером.

## 13. API Architecture

Первая версия API должна быть внутренней, прикладной и узкой.

Рекомендуемый набор модулей:

- `auth`
- `users`
- `lessons`
- `candidates`
- `revision`
- `permissions`
- `publishing`
- `audit`

Принципы API:

- API возвращает уже нормализованные продуктовые модели;
- API не отдаёт наружу сырой filesystem contract;
- write endpoints всегда проходят через application services;
- destructive или stateful actions должны быть идемпотентны там, где это возможно.

## 14. Publish / Rollback Architecture

### 13.1 Publish

Publish должен работать как явная транзакция:

1. берём current live lesson state;
2. применяем все accepted unpublished candidates;
3. строим полный snapshot;
4. создаём новую `PublishVersion`;
5. помечаем её active;
6. предыдущую active version делаем inactive;
7. связанные candidates помечаем published;
8. пишем audit event.

### 13.2 Rollback

Rollback должен быть отдельным use case:

1. выбирается предыдущая version;
2. она становится active;
3. текущая активная version становится inactive;
4. создаётся audit event rollback.

Важно:

- rollback не должен пересобирать урок из набора старых кандидатов;
- rollback должен работать через переключение уже материализованного snapshot.

## 15. Аудит и наблюдаемость

В Beta audit обязателен на уровне доменных событий.

Минимальный список событий:

- login success/failure
- role switch
- user created
- user deactivated
- permission granted/revoked
- candidate created
- candidate withdrawn
- candidate accepted/rejected
- publish created
- rollback executed

Рекомендуемое правило:

- audit event пишется через единый сервис;
- event содержит actor, action, target, timestamp и metadata;
- audit не должен зависеть от UI-формулировок.

## 16. Тестовая архитектура

Минимальная пирамида тестов для Beta:

- unit tests для domain rules;
- integration tests для application services и API;
- Playwright E2E для критических пользовательских flow.

Критические E2E:

1. owner создаёт teacher;
2. teacher с permission редактирует текст;
3. teacher меняет картинку;
4. administrator принимает или отклоняет candidate;
5. owner публикует новую версию;
6. lesson detail показывает published state;
7. owner делает rollback;
8. lesson detail показывает восстановленную версию.

## 17. Deployment Architecture

Для первой фазы достаточно self-hosted Docker deployment.

Рекомендуемый compose-набор:

- `app` — Next.js production container;
- `postgres` — основная БД;
- `minio` — object storage для candidate images;
- опционально `redis` только если позже действительно нужен background job слой.

Принципиальное решение для Beta MVP:

- не вводить Redis и worker заранее;
- добавить их только если появится подтверждённая потребность:
  - image regeneration queue
  - тяжёлые фоновые publish/export задачи

То есть в отличие от Alpha инфраструктура Beta должна стартовать минимальной.

## 18. Рекомендуемая структура каталогов

```text
BETTA_APP/
  docs/
  src/
    app/
    features/
      auth/
      users/
      lessons/
      revision/
      publishing/
      permissions/
    domain/
      lesson/
      candidate/
      publish/
      auth/
      audit/
    infrastructure/
      prisma/
      content-adapters/
      storage/
      auth/
    ui/
    shared/
  prisma/
  tests/
    unit/
    integration/
    e2e/
  infra/
    docker/
```

Идея:

- `features/` собирают use case вертикали;
- `domain/` хранит правила;
- `infrastructure/` держит внешние зависимости;
- `ui/` хранит переиспользуемые экранные компоненты.

## 19. Решения, которые фиксируем уже сейчас

Фиксируем как базу Beta:

1. стек: Next.js + React + TypeScript + Prisma + PostgreSQL + Docker;
2. published-first read model;
3. full snapshot publish model;
4. rollback через activation предыдущей published version;
5. read-only adapter к `SERVER/`, `ASSETS/`, `TOOLS/image_review/`;
6. обычные аккаунты вместо Alpha token/grant complexity;
7. отдельный permission-слой для teacher revision access;
8. S3-compatible storage для candidate images;
9. published snapshot проектируется как runtime-ready lesson contract;
10. будущий online classroom строится как server-authoritative websocket layer поверх published snapshots;
11. минимальная инфраструктура без преждевременного worker/queue слоя в MVP.

## 20. Открытые вопросы

Ниже вопросы, которые не блокируют архитектурный документ, но должны быть зафиксированы до реализации:

1. `administrator` или `owner` является основной approve-ролью в финальной версии MVP.
2. Нужна одна таблица `edit_candidates` или отдельные `text_candidates` и `image_candidates`.
3. Где именно хранить session-level active role mode: только в cookie/session или также в БД для аудита.
4. Нужен ли в первой версии history UI по всем candidate transitions или достаточно audit log + current status.
5. Будет ли image regeneration в MVP, и нужен ли из-за этого Redis/worker уже в первой поставке.
6. Будет ли одна активная `LessonSession` на группу и урок или разрешим несколько параллельных запусков.
7. Нужен ли teacher free navigation по шагам или только допустимые переходы по runtime graph.
8. Должен ли runtime хранить event log целиком или только materialized current state + results.

## 21. Следующий документ

Следующий логичный артефакт после этой архитектуры:

- `BETTA_APP/docs/UX_UI_WIREFRAMES.md`

После него:

- `BETTA_APP/docs/DOMAIN_MODEL.md`
- `BETTA_APP/docs/API_SPEC.md`
- `BETTA_APP/docs/IMPLEMENTATION_PLAN.md`
