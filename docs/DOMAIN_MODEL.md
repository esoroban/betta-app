# BETTA_APP Domain Model

## 1. Назначение документа

Этот документ фиксирует доменную модель BETTA_APP на уровне сущностей, связей и правил.

Это не код и не финальная SQL-схема.
Это продуктово-архитектурный контракт, на который потом будут опираться:

- Prisma schema;
- API spec;
- UX/UI flows;
- audit model;
- future runtime layer.

## 2. Главный принцип модели

BETTA_APP делится на четыре логические зоны данных:

1. identity and login layer;
2. product account and access layer;
3. revision and publishing layer;
4. future runtime layer.

Ключевое правило:

- revision и runtime не смешиваются;
- published snapshot является мостом между ними.

## 3. Identity And Login Layer

### 3.1 Зачем нужен отдельный login layer

В нашей системе один email, один Google account или один `soroban.ua` login не гарантирует одного пользователя.

Причина:

- у нескольких детей может быть общий email;
- у нескольких детей может быть один Google account;
- у нескольких детей может быть один внешний login.

Поэтому доменная модель должна разделять:

- кем человек вошёл;
- в какой именно продуктовый аккаунт он вошёл.

### 3.2 LoginIdentity

`LoginIdentity` описывает внешний способ входа.

Поля:

- `id`
- `provider`
- `provider_subject_id`
- `email`
- `email_verified`
- `display_hint`
- `created_at`
- `last_login_at`
- `is_active`

Пояснения:

- `provider` принимает значения `credentials`, `google`, `soroban`;
- `provider_subject_id` это внешний стабильный идентификатор у провайдера;
- `email` может совпадать у нескольких разных app accounts;
- `display_hint` нужен для понятного выбора в account picker, если один login связан с несколькими профилями.

### 3.3 CredentialsSecret

Для провайдера `credentials` пароль не должен лежать прямо в `LoginIdentity`.

Отдельная сущность:

- `login_identity_id`
- `password_hash`
- `password_updated_at`

Это позволяет:

- не смешивать локальные пароли с OAuth/OIDC-провайдерами;
- сохранить чистую provider-agnostic модель.

### 3.4 LoginIdentityAccountLink

`LoginIdentityAccountLink` связывает login identity с конкретным продуктовым аккаунтом.

Поля:

- `id`
- `login_identity_id`
- `user_id`
- `is_default`
- `link_reason`
- `created_at`
- `created_by`

Ключевой смысл:

- один `LoginIdentity` может вести в несколько `User`;
- один `User` потенциально тоже может иметь несколько login identities;
- именно эта связь делает account picker возможным.

### 3.5 AppSession

`AppSession` описывает уже внутреннюю сессию после выбора профиля.

Поля:

- `id`
- `login_identity_id`
- `user_id`
- `auth_provider`
- `base_role`
- `active_role_mode`
- `created_at`
- `last_seen_at`
- `expires_at`
- `ip_address`
- `user_agent`
- `is_revoked`

Важно:

- полная app session создаётся только после выбора конкретного `user_id`;
- если на login identity ровно один аккаунт, account picker можно пропустить;
- если аккаунтов несколько, session создаётся только после явного выбора.

## 4. Product Account And Access Layer

### 4.1 User

`User` это не способ входа, а конкретный продуктовый аккаунт.

Поля:

- `id`
- `display_name`
- `base_role`
- `status`
- `preferred_ui_language`
- `created_at`
- `created_by`
- `deactivated_at`

Пояснения:

- `base_role` это главная роль аккаунта;
- `status` обычно `active` или `inactive`;
- для student-сценариев именно `User` является носителем прогресса, ответов и membership.

### 4.2 UserRole

Если мы оставляем множественные роли, нужен отдельный слой `UserRole`.

Поля:

- `id`
- `user_id`
- `role`
- `granted_by`
- `granted_at`

Роли:

- `owner`
- `administrator`
- `revisioner`
- `teacher`
- `student`

Правило:

- одна базовая роль указывается в `User.base_role`;
- дополнительные роли, если они разрешены продуктом, хранятся в `UserRole`.

### 4.3 ActiveRoleMode

Это не отдельная таблица, а session-level понятие.

Допустимые режимы:

- `owner`
- `administrator`
- `revisioner`
- `teacher`
- `student`

Правило:

- пользователь видит UI не только по своей базовой роли;
- текущий экранный режим определяется `AppSession.active_role_mode`.

### 4.4 TeacherRevisionPermission

`TeacherRevisionPermission` отделяет право учителя редактировать уроки от самой роли teacher.

Поля:

- `id`
- `user_id`
- `scope_type`
- `scope_value`
- `is_active`
- `granted_by`
- `granted_at`
- `revoked_at`
- `revoked_by`

На первой версии допустимы варианты:

- глобальное право на revision;
- право на конкретные lessons;
- право на определённую группу уроков позже.

### 4.5 AuditEvent

`AuditEvent` фиксирует значимые действия.

Поля:

- `id`
- `actor_user_id`
- `login_identity_id`
- `action_type`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

Примеры событий:

- login success/failure;
- account linked;
- role switched;
- candidate created;
- candidate accepted;
- publish created;
- rollback executed.

## 5. Content Read Model

### 5.1 Почему это отдельный слой

`Lesson`, `Scene`, `Step` в BETTA_APP не обязаны один-в-один совпадать с raw runtime JSON.

Нужна нормализованная доменная read model, которую UI и API получают через adapter.

### 5.2 Lesson

`Lesson` это каноническая lesson-модель внутри приложения.

Поля:

- `lesson_id`
- `title_localized`
- `canonical_title`
- `supported_languages`
- `thumbnail_asset`
- `published_version_id`
- `published_version_number`
- `has_pending_changes`
- `scene_count`
- `step_count`

### 5.3 Scene

Поля:

- `scene_id`
- `lesson_id`
- `title_localized`
- `sort_order`
- `brief_source`
- `brief_localized`
- `image_metadata`

### 5.4 Step

Поля:

- `step_id`
- `lesson_id`
- `scene_id`
- `sort_order`
- `step_type`
- `audience`
- `localized_fields`
- `answer_payload`
- `image_assignment`
- `teacher_text`

### 5.5 ImageAssignment

Для первой версии полезно мыслить image mapping как отдельную концепцию, даже если физически она живёт внутри snapshot.

Поля:

- `lesson_id`
- `scene_id`
- `step_id`
- `asset_key`
- `asset_path`
- `thumbnail_path`
- `source_type`

## 6. Revision And Publishing Layer

### 6.1 Общий принцип

Revision layer не редактирует published snapshot напрямую.

Она работает через candidates:

- кто-то предлагает изменение;
- кто-то принимает или отклоняет;
- owner публикует;
- publish создаёт новый материализованный snapshot.

### 6.2 EditCandidate

`EditCandidate` это главная сущность ревизии.

Поля:

- `id`
- `lesson_id`
- `scene_id`
- `step_id`
- `location_key`
- `field`
- `candidate_type`
- `original_value`
- `proposed_value`
- `language_code`
- `status`
- `author_user_id`
- `created_at`
- `updated_at`
- `reviewed_by`
- `reviewed_at`
- `review_note`
- `withdrawn_at`
- `publish_version_id`

`candidate_type`:

- `text`
- `image`
- позже возможно `brief`

`status`:

- `pending`
- `accepted`
- `rejected`
- `withdrawn`
- `published`

### 6.3 CandidateReviewDecision

Если захотим более подробную историю review-переходов, можно ввести отдельную сущность.

Поля:

- `id`
- `candidate_id`
- `decision`
- `decided_by`
- `decided_at`
- `note`

Где `decision`:

- `accept`
- `reject`
- `withdraw`

На MVP это может быть и не отдельная таблица, а просто audit trail плюс поля в `EditCandidate`.

### 6.4 CandidateAttachment

Для image-кандидатов может понадобиться отдельная attachment-модель.

Поля:

- `id`
- `candidate_id`
- `storage_path`
- `mime_type`
- `width`
- `height`
- `metadata`

### 6.5 PublishVersion

`PublishVersion` это главный доменный результат системы.

Поля:

- `id`
- `lesson_id`
- `version_number`
- `snapshot`
- `description`
- `is_active`
- `published_by`
- `published_at`

Правило:

- snapshot хранит полное состояние урока, готовое к чтению и future runtime;
- publish не собирает состояние на лету при каждом запросе;
- rollback работает через переключение active version.

### 6.6 PublishVersionItem

Если нужно сохранить явную связь между версией и опубликованными candidates, используется `PublishVersionItem`.

Поля:

- `id`
- `publish_version_id`
- `candidate_id`
- `item_type`
- `item_snapshot`

Смысл:

- помогает видеть, какие именно изменения вошли в publish;
- упрощает аудит и version history UI.

### 6.7 RollbackEvent

Rollback можно хранить как audit event, но доменно полезно выделять его явно.

Поля:

- `id`
- `lesson_id`
- `from_publish_version_id`
- `to_publish_version_id`
- `executed_by`
- `executed_at`
- `reason`

## 7. Published Snapshot Contract

### 7.1 Почему это важно

Published snapshot это не только результат review.
Это будущий контракт для online runtime.

### 7.2 Что snapshot обязан содержать

Минимально:

- `lesson_id`
- `version_number`
- `supported_languages`
- список сцен в порядке;
- список шагов в порядке;
- `scene_id`
- `step_id`
- `step_type`
- `audience`
- локализованные тексты;
- image assignments;
- teacher-facing text;
- option/poll data там, где шаг интерактивный;
- fallback metadata.

### 7.3 Что snapshot не должен содержать

Не должен содержать:

- draft candidates;
- review notes;
- reviewer-only служебные поля;
- внутренние статусы ревизии.

Runtime должен читать только готовое опубликованное состояние.

## 8. Future Runtime Layer

### 8.1 Задача runtime-слоя

Runtime слой управляет живым уроком:

- teacher запускает session;
- students подключаются;
- teacher двигает lesson flow;
- students получают синхронный контент;
- ответы записываются на конкретных студентов.

### 8.2 Group

`Group` описывает учебную группу.

Поля:

- `id`
- `title`
- `status`
- `created_at`
- `created_by`

### 8.3 GroupMembership

`GroupMembership` связывает пользователя с группой.

Поля:

- `id`
- `group_id`
- `user_id`
- `membership_role`
- `created_at`
- `created_by`

`membership_role`:

- `teacher`
- `student`

### 8.4 LessonAssignment

`LessonAssignment` определяет, какой урок назначен группе.

Поля:

- `id`
- `group_id`
- `lesson_id`
- `assigned_by`
- `assigned_at`
- `status`

### 8.5 LessonSession

`LessonSession` это конкретный live запуск урока.

Поля:

- `id`
- `group_id`
- `lesson_id`
- `publish_version_id`
- `teacher_user_id`
- `status`
- `started_at`
- `ended_at`
- `current_scene_id`
- `current_step_id`

`status`:

- `created`
- `live`
- `paused`
- `ended`

### 8.6 SessionParticipant

`SessionParticipant` отражает присутствие конкретного пользователя в live session.

Поля:

- `id`
- `lesson_session_id`
- `user_id`
- `participant_role`
- `joined_at`
- `left_at`
- `connection_state`

### 8.7 SessionStepState

`SessionStepState` хранит текущее и историческое состояние шага внутри session.

Поля:

- `id`
- `lesson_session_id`
- `scene_id`
- `step_id`
- `status`
- `opened_at`
- `closed_at`
- `revealed_at`

`status`:

- `queued`
- `active`
- `closed`
- `revealed`

### 8.8 StudentResponse

`StudentResponse` хранит ответ конкретного студента.

Поля:

- `id`
- `lesson_session_id`
- `step_id`
- `user_id`
- `response_payload`
- `submitted_at`
- `is_final`

### 8.9 SessionEvent

`SessionEvent` это server-side хронология realtime-команд.

Поля:

- `id`
- `lesson_session_id`
- `event_type`
- `actor_user_id`
- `payload`
- `created_at`

Примеры:

- `session.started`
- `lesson.step.changed`
- `poll.opened`
- `response.accepted`
- `results.published`
- `session.ended`

## 9. Ключевые связи

### 9.1 Identity to account

- один `LoginIdentity` может быть связан с несколькими `User`;
- один `User` может быть связан с одним или несколькими `LoginIdentity`.

### 9.2 User to roles

- один `User` имеет одну базовую роль;
- при необходимости может иметь несколько ролей через `UserRole`.

### 9.3 User to permission

- один `User` типа teacher может иметь ноль или более `TeacherRevisionPermission`.

### 9.4 Lesson to revision

- один `Lesson` имеет ноль или более `EditCandidate`;
- один `EditCandidate` относится к одной конкретной точке урока.

### 9.5 Lesson to publish

- один `Lesson` имеет ноль или более `PublishVersion`;
- в каждый момент времени только одна версия активна.

### 9.6 Runtime relations

- один `Group` имеет много `GroupMembership`;
- один `Group` имеет много `LessonAssignment`;
- один `LessonSession` относится к одной группе, одному teacher и одной published version;
- один `StudentResponse` всегда принадлежит конкретному `LessonSession`, `Step` и `User`.

## 10. Бизнес-правила

### 10.1 Login rules

- email не уникален как пользователь;
- Google identity не уникален как пользователь;
- `soroban.ua` identity не уникален как пользователь;
- после логина может потребоваться выбор профиля.

### 10.2 Revision rules

- teacher не может редактировать без active revision permission;
- revisioner может редактировать в рамках revision workflow;
- administrator принимает или отклоняет candidates;
- owner публикует и откатывает.

### 10.3 Publish rules

- publish работает только с accepted unpublished candidates;
- результат publish это новый полный snapshot;
- lesson detail всегда читает active published version, если она существует.

### 10.4 Runtime rules

- runtime никогда не читает draft или pending changes;
- runtime работает только на active published version;
- teacher commands валидируются сервером;
- student response принадлежит конкретному student-account, а не просто login identity.

## 11. Вопросы, которые ещё нужно добить

1. Оставляем ли множественные роли через `UserRole` или фиксируем одну базовую роль на пользователя без мульти-ролевости.
2. Делаем ли `EditCandidate` одной общей таблицей или делим на `TextCandidate` и `ImageCandidate`.
3. Нужен ли отдельный `CandidateReviewDecision`, или достаточно `EditCandidate + AuditEvent`.
4. Нужен ли `TeacherRevisionPermission` только на пользователя или сразу делаем scope по lesson/group.
5. Должен ли `LoginIdentityAccountLink` быть many-to-many с обеих сторон, или на первом этапе достаточно one-login-to-many-users.
6. Нужен ли runtime event sourcing целиком или только materialized session state плюс журнал событий.

## 12. Следующий документ

Следующий логичный артефакт:

- `BETTA_APP/docs/API_SPEC.md`

В нём нужно зафиксировать:

- auth flows;
- account picker flow;
- lesson read endpoints;
- candidate endpoints;
- revision endpoints;
- publish/rollback endpoints;
- future runtime endpoints и websocket event contract.

