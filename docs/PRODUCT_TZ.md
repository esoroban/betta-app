# BETTA_APP — Полное Техническое Задание

## 1. Цель

Создать новое приложение с нуля, без наследования старой сложной архитектуры, для управления уроками, редактурой, ревизиями и публикацией.

Ключевой принцип:

- сначала проектируем продукт и UX/UI;
- потом фиксируем доменную модель;
- потом проектируем API и storage;
- только потом переходим к реализации.

---

## 2. Продуктовая рамка

### 2.1 Что это за продукт

BETTA_APP — это веб-приложение для трех основных сценариев:

1. администратор/владелец управляет пользователями и правами;
2. преподаватель редактирует уроки и отправляет изменения на ревизию;
3. владелец просматривает изменения, принимает или отклоняет их и публикует новую версию урока.

### 2.3 Определение MVP

MVP BETTA_APP не включает проведение урока.

Первая цель продукта:

- дать revision-oriented ролям возможность подготовить уроки;
- дать administrator возможность одобрить изменения;
- дать owner возможность опубликовать итоговую версию;
- получить published lesson state, который считается готовым к последующему runtime/player слою.

Иными словами:

- BETTA_APP в MVP не запускает урок;
- BETTA_APP в MVP готовит урок к запуску в будущем runtime.

### 2.2 Что не входит в первую фазу

Следующие блоки не включать в первую реализацию ядра:

- classroom/player/runtime проведения урока;
- сложная массовая или полностью автоматическая генерация картинок;
- автоматическая генерация всех переводов на лету;
- любая legacy-совместимость со старым review/reviewer/grants/tokens слоем.

Уточнение:

- базовый ручной overlay-редактор для нескольких отдельных текстовых элементов входит в MVP;
- не входит только advanced overlay tooling сверх ручного редактора.
- controlled generation картинки как fallback-действие редактора входит в MVP, но не является основным путем редактирования.

### 2.4 Что является результатом MVP

Результат MVP:

1. урок можно открыть и отредактировать;
2. изменения можно отправить на ревизию;
3. изменения можно проверить и одобрить;
4. owner может опубликовать новую версию;
5. published snapshot урока становится каноническим результатом;
6. этот published snapshot считается готовым входом для отдельного runtime/player продукта.

---

## 3. Продуктовые роли

Приложение строится вокруг основной иерархии ролей и отдельной ревизионной ветки.

Основная вертикаль:

1. `owner`
2. `administrator`
3. `teacher`
4. `student`

Отдельная боковая роль:

- `revisioner`

### 3.1 Общий принцип иерархии

Каждая роль:

- имеет собственный интерфейс;
- может провалиться в интерфейс любой нижестоящей роли;
- может вернуться обратно в свой базовый интерфейс;
- может создавать пользователей только по правилам своей ветки;
- не может создавать пользователей своей роли или вышестоящих ролей.

### 3.2 Правило impersonation / role switch

Нужен явный механизм переключения режима просмотра:

- `owner` может войти в режим:
  - `administrator`
  - `revisioner`
  - `teacher`
  - `student`
- `administrator` может войти в режим:
  - `teacher`
  - `student`
- `revisioner` может войти в режим:
  - `teacher`
  - `student`
- `teacher` может войти в режим:
  - `student`
- `student` не имеет вложенных режимов

Ключевой UX-принцип:

- это не скрытая магия;
- текущий активный режим должен быть всегда явно виден в UI;
- возврат в исходную роль должен быть доступен в один клик.

### 3.3 Owner

Это верхняя роль системы.

Права:

- полный доступ ко всем разделам;
- создание `administrator`, `revisioner`, `teacher`, `student`;
- просмотр всех уроков, ревизий, публикаций и rollback history;
- публикация и откат;
- переключение в любой нижний режим.

Интерфейс owner:

- глобальная панель управления;
- доступ ко всем урокам;
- revision oversight;
- управление пользователями и ролями;
- publish / rollback / audit visibility.

### 3.4 Administrator

Это роль операционного управления пользователями и структурой доступа.

Права:

- создание `teacher`, `student`;
- управление пользователями своего уровня и ниже;
- просмотр административных списков и статусов;
- review and approval of lesson changes;
- accept / reject candidates in revision flow;
- переключение в режим `teacher`, `student`.

Ограничения:

- не может выполнять owner-only системные действия;
- не может публиковать;
- не может откатывать published versions.

Интерфейс administrator:

- users management;
- role assignment;
- activation/deactivation users;
- revision approval workspace;
- operational health / simple audit visibility.

### 3.5 Revisioner

Это роль подготовительного контентного анализа и работы ниже уровня администратора.

Права:

- просмотр revision-related данных в пределах своей зоны;
- редактирование уроков в рамках revision workflow;
- участие в подготовке revision flow;
- переключение в режим `teacher` и `student`.

Ограничения:

- не создает пользователей;
- не управляет административной вертикалью;
- не принимает финальные решения по approve/reject;
- не публикует;
- не откатывает.

Интерфейс revisioner:

- revision-oriented monitoring / support workspace;
- доступ к lesson detail с edit affordances;
- доступ к lesson context для подготовки;
- просмотр candidate history;
- без final approval controls;
- без publish controls.

### 3.6 Teacher

Это роль редактора уроков.

Права:

- создание `student`;
- просмотр доступных уроков;
- редактирование разрешенных полей урока;
- отправка изменений на ревизию;
- просмотр своих pending edits;
- withdraw своих pending edits;
- переключение в режим `student`.

Интерфейс teacher:

- lessons dashboard;
- lesson detail;
- edit affordances;
- my edits panel;
- статусы отправленных изменений.

### 3.7 Student

Это нижняя продуктовая роль.

Права:

- просмотр назначенного или доступного учебного контента в student-mode;
- без прав на редактирование и ревизию.

Интерфейс student:

- только учебное/потребительское представление урока;
- без редакторских и административных controls.

---

## 4. UX/UI Foundation

Это главный раздел первой итерации. Пока он не утвержден, код не пишется.

### 4.0 Канонический локальный референс

Для MVP не нужно выдумывать review UX с нуля.

Канонический локальный референс:

- [SERVER/review.html](/Users/iuriinovosolov/Documents/SylaSlova_only_online/SERVER/review.html)
- [SERVER/review_panel.js](/Users/iuriinovosolov/Documents/SylaSlova_only_online/SERVER/review_panel.js)
- [SERVER/classroom.css](/Users/iuriinovosolov/Documents/SylaSlova_only_online/SERVER/classroom.css)
- [SERVER/classroom.js](/Users/iuriinovosolov/Documents/SylaSlova_only_online/SERVER/classroom.js)

Это означает:

- BETTA_APP review-экран должен как минимум повторить продуктовую логику и wireframe существующего review mode;
- существующие уроки, картинки и review-данные не являются абстрактным примером, а служат реальным исходным материалом для MVP;
- UX новой системы должен быть спроектирован так, чтобы пользователь узнавал существующий review workflow, но в более чистом и системном приложении.

### 4.0.1 Что именно берем из локального референса

Из существующего review wireframe нужно унаследовать минимум следующие блоки:

1. визуальный lesson/scene preview;
2. текущий image asset indicator;
3. brief panel;
4. approved / regen / save / revert controls;
5. image picker ribbon;
6. image catalog / browsing section;
7. step/scene context;
8. teacher-facing contextual text рядом с визуальной частью урока.

### 4.0.2 Что не копируем буквально

Не требуется один-в-один переносить:

- старую HTML-структуру;
- старые DOM-id;
- старую техническую архитектуру;
- legacy JS без адаптации.

Нужно перенести:

- продуктовую структуру экрана;
- иерархию смысловых блоков;
- ключевые пользовательские действия;
- понятную связь между уроком, сценой, картинкой и brief.

### 4.1 UX принципы

1. Один экран — одна главная задача.
2. Никаких скрытых режимов и внутренних терминов.
3. Все действия с последствиями должны быть визуально понятны:
   - pending
   - accepted
   - rejected / kept current
   - published
   - rolled back
4. Пользователь всегда должен понимать:
   - что он редактирует;
   - в каком уроке он находится;
   - опубликовано ли текущее состояние;
   - есть ли непубликованные изменения.
5. Нельзя смешивать язык интерфейса и язык контента молча:
   - fallback должен быть явным.
6. Primary surface должен показывать урок так, как его реально видит роль:
   - lesson-first, а не CRUD-first.
7. Edit mode открывается только по явному действию:
   - верхняя action strip;
   - локальный карандаш;
   - side drawer / editor tray.
8. Опрос, overlay и визуальные слои должны редактироваться в контексте слайда, а не как оторванные формы под ним.

### 4.2 Визуальная стратегия

Продукт должен выглядеть как рабочий редактор, а не как временная админка.

Требования:

- светлый интерфейс как базовый режим;
- чистая типографика;
- высокий контраст для состояний;
- минимум декоративного шума;
- акцент на:
  - структуре урока,
  - статусах изменений,
  - понятных CTA.

### 4.3 Основные состояния интерфейса

Для всех ключевых экранов должны быть предусмотрены:

- loading;
- empty;
- error;
- success;
- no permission;
- no data;
- pending changes;
- published state;
- fallback language state.

---

## 5. Информационная архитектура

### 5.1 Верхний уровень навигации

Обязательные разделы:

1. `Lessons`
2. `Revision`
3. `Admin`
4. `Profile / Session`

### 5.2 Правила видимости

- `Lessons` — owner, administrator, revisioner, teacher;
- `Revision` — owner и revisioner как базовые роли; teacher может видеть только свой ограниченный revision-related слой, если он предусмотрен;
- `Admin` — owner и administrator;
- `Profile / Session` — все авторизованные пользователи.

Дополнительно:

- должен существовать глобальный role-switch control;
- в нем пользователь видит:
  - свою базовую роль;
  - доступные нижние режимы;
  - активный текущий режим;
  - действие возврата в базовый режим.

### 5.3 Хлебные крошки / контекст

На экранах уроков и ревизий всегда должен быть виден контекст:

- lesson title;
- lesson id;
- scene title;
- selected language;
- published status/version.

---

## 6. Ключевые экраны

## 6.1 Login

Цель:

- простой и надежный вход.

Состав:

- email;
- password;
- show/hide password;
- remember me;
- login button;
- error state.

Требования:

- без лишних элементов;
- понятное сообщение об ошибке;
- защита от частых попыток входа.

## 6.2 Lessons Dashboard

Цель:

- быстро найти нужный урок.

Карточка урока должна содержать:

- thumbnail;
- localized lesson title;
- lesson id;
- количество сцен;
- количество шагов;
- supported languages;
- published indicator;
- indicator pending changes, если они есть.

Действия:

- открыть урок;
- для owner: перейти в revision, если у урока есть pending changes.

## 6.3 Lesson Detail

Цель:

- читать урок;
- для teacher с permission — редактировать поля;
- для owner — видеть опубликованное состояние.

Структура:

1. Header:
   - title;
   - lesson id;
   - publish status;
   - current language;
   - fallback badges.
2. Scene list sidebar:
   - scene title;
   - steps count;
   - image count;
   - brief status.
3. Main content:
   - scene preview;
   - question / poll on slide, если шаг является опросным;
   - overlay layers on slide;
   - teacher-facing text рядом со слайдом;
   - scene brief;
   - image assets;
   - my edits panel.

Редактируемые поля первой версии:

- step prompt;
- step explanation;
- teacher-facing text field, если оно реально используется;
- image assignment / image replacement;
- scene brief или image prompt field, если это выбранный продуктовый источник.

Для image assignment / replacement в MVP нужно поддержать:

- выбор из текущей lesson ribbon;
- выбор из cross-lesson image browser;
- fallback generation from editor-authored prompt.

Требование:

- страница урока должна показывать published-first состояние;
- если published version есть, пользователь видит именно ее.

Дополнительное требование:

- primary teacher / revisioner view должен быть lesson-first;
- question / poll по умолчанию отображается внутри окна слайда;
- overlay отображается как набор отдельных элементов поверх сцены;
- teacher text живет рядом со слайдом как companion block.

### 6.3.1 Teacher / Revisioner action strip

В верхней части lesson surface должна быть явная action strip. Базовый набор действий:

- `Редактировать картинку`
- `Редактировать бриф`
- `Редактировать опрос`
- `Редактировать оверлей`
- `Редактировать учительскую подсказку`

Принцип:

- в elevated review mode действия видимы полностью;
- в teacher mode показываются только разрешенные действия;
- в student mode action strip скрывается.

### 6.3.1a Image edit flow priority

Редактирование картинки должно идти по трем путям, в строгом порядке удобства:

1. **Быстрый выбор из ленты текущего урока**
   - выбрать картинку из ribbon текущего урока;
   - это основной и самый легкий путь.

2. **Выбор из глобального браузера картинок**
   - открыть browser с миниатюрами, сгруппированными по урокам;
   - порядок уроков: первый урок сверху, последний снизу;
   - внутри каждого урока — лента / grid его картинок;
   - ниже всех уроков — отдельная секция:
     - неиспользуемые, но ранее сгенерированные картинки.

3. **Крайняя мера: свой prompt**
   - редактор пишет prompt на своем языке;
   - нажимает `Перевести и сгенерировать`;
   - prompt переводится на английский;
   - по API запускается генерация картинки;
   - генерация и preview новой картинки можно делать без final approval;
   - если результат устраивает, редактор уже выбирает его как candidate image.

Продуктовый принцип:

- генерация не должна быть основным путем;
- сначала пользователь должен попробовать локальную ribbon и глобальный browser;
- prompt generation — только fallback.

### 6.3.1b Image generation UX

Так как генерация картинки ресурсоемкая, image editing mode должен открываться не маленьким drawer, а почти полноэкранным editor surface, который визуально перекрывает базовый экран.

В нем должны быть видны одновременно:

- текущая выбранная картинка;
- candidate images;
- browser по урокам;
- секция неиспользуемых ранее сгенерированных картинок;
- current prompt;
- new prompt;
- кнопка `Перевести и сгенерировать`.

### 6.3.2 Overlay editing MVP

В MVP overlay editor должен поддерживать:

- несколько отдельных overlay-элементов на одной сцене;
- добавление нового overlay;
- удаление overlay;
- выбор активного overlay;
- редактирование текста;
- цвет текста;
- размер текста;
- выбор font family;
- фон-плашка on/off;
- цвет фона;
- позиционирование drag-and-drop прямо на preview;
- автоматический размер блока по содержимому текста.

## 6.4 Revision Dashboard

Цель:

- owner управляет учителями и очередью изменений.

Состав:

- список teachers;
- permission state;
- pending count;
- grant/revoke action;
- link to teacher drilldown.

Структура teacher row:

- name;
- email;
- role chip;
- permission chip;
- pending count chip;
- primary action button.

## 6.5 Teacher Drilldown

Цель:

- owner видит, в каких уроках у конкретного учителя есть pending changes.

Состав:

- teacher header;
- lessons with pending changes;
- localized lesson title;
- lesson id;
- pending count per lesson.

## 6.6 Lesson Review

Цель:

- owner review конкретного урока.

Состав:

1. Header:
   - localized lesson title;
   - lesson id;
   - pending count;
   - publish action.
2. Changed locations list:
   - grouped by scene;
   - grouped by field.
3. Comparison blocks:
   - current value;
   - proposed value(s);
   - accept candidate;
   - keep current.
4. Publish panel:
   - accepted unpublished items;
   - publish button;
   - result state.

UX-reference requirement:

- этот экран должен проектироваться на базе существующего локального review wireframe из `SERVER/review.html`;
- новая версия может быть визуально чище и технологически современной, но не должна потерять основные рабочие элементы текущего review experience.

## 6.7 Admin

Цель:

- owner управляет пользователями.

Первая версия должна уметь:

- создать user;
- выбрать роль через dropdown;
- видеть список users;
- видеть localized role chips;
- при необходимости deactivate user.

Создание пользователя:

- email;
- display name;
- password;
- single-select role:
  - teacher
  - student

---

## 7. User Flows

## 7.1 Owner basic flow

1. log in;
2. open admin;
3. create administrator / revisioner / teacher / student;
4. switch into lower-role modes when needed;
5. open revision dashboard;
6. monitor pending changes;
7. publish approved changes;
8. rollback if needed.
9. supervise the whole system.

Owner does not perform routine approval as the main operational role.
Approval belongs to `administrator`.

## 7.2 Administrator flow

1. log in;
2. manage users of lower roles;
3. activate/deactivate users;
4. assign operational access;
5. open revision queue;
6. review pending changes;
7. accept / reject candidates;
8. switch into teacher / student mode if needed.

## 7.3 Revisioner flow

1. log in;
2. open lessons prepared for revision work;
3. edit lesson content;
4. submit changes into revision flow;
5. inspect revision-related content and queues;
6. prepare or triage content for administrator review;
7. switch into teacher or student mode if contextual verification is needed.

Revisioner does not create users, does not approve, and does not publish.

## 7.4 Teacher edit flow

1. log in;
2. open lessons dashboard;
3. open lesson;
4. if permission active, see edit affordances;
5. edit text or image;
6. submit candidate;
7. see pending badge;
8. optionally withdraw before publish.

## 7.5 Publish flow

1. teacher and/or revisioner submits edits;
2. administrator reviews and accepts/rejects;
3. owner sees publish-ready state;
4. owner publishes new version;
5. lesson page immediately reflects published snapshot.

## 7.6 Rollback flow

1. owner opens version history or rollback action;
2. owner selects previous version;
3. owner confirms rollback;
4. lesson page returns to the prior published state.

---

## 8. Language Model

### 8.1 Interface language

Поддерживаемые языки UI:

- EN
- RU
- UK

### 8.2 Content language rules

Для каждого поля действует правило:

1. выбранный язык;
2. fallback to canonical language;
3. fallback badge visible.

На primary lesson screen должен быть явный language switch кодами языка:

- `EN`
- `RU`
- `UK`

### 8.3 What must be localized

Обязательно локализуются:

- lesson title;
- scene title;
- step labels;
- step type labels;
- audience labels;
- role labels;
- action labels;
- system statuses.

### 8.4 What may remain source-only in v1

Если некоторых переводов реально нет, это должно быть явно помечено:

- scene brief / image prompt source;
- internal generation prompt text;
- legacy imported fields.

---

## 9. Доменная модель

### 9.1 Lesson

Содержит:

- lesson_id;
- localized title;
- supported languages;
- scenes;
- steps;
- image mapping;
- publish metadata.

### 9.2 Scene

Содержит:

- scene_id;
- localized title;
- step_ids;
- brief;
- image-related metadata.

### 9.3 Step

Содержит:

- step_id;
- scene_id;
- step_type;
- audience;
- localized text fields;
- options / answers where relevant;
- image assignment where relevant.

### 9.4 EditCandidate

Содержит:

- location;
- field;
- candidate type;
- original value;
- proposed value;
- author;
- status;
- publish linkage.

### 9.5 PublishVersion

Содержит:

- lesson_id;
- version number;
- active flag;
- snapshot;
- published_by;
- published_at;
- description.

### 9.6 TeacherRevisionPermission

Содержит:

- user_id;
- is_active;
- granted_by;
- granted_at;
- revoked_at.

---

## 10. Источники истины

### 10.1 Lesson text

Published source of truth:

- active published snapshot.

Fallback:

- pipeline baseline only if lesson was never published.

### 10.2 Lesson images

Нужно закрепить один source of truth.

Рекомендуемое правило:

- canonical published assignment of image = `step_image_map`
- `scene.image_assets` = derived view

### 10.2.1 Pipeline boundary guarantees

Инварианты:

- pipeline files в `SERVER/` и `ASSETS/` остаются read-only baseline;
- lesson edits не мутируют pipeline напрямую;
- publish формирует materialized immutable snapshot;
- rollback переключает active published version, а не пытается переписать baseline-файлы.

### 10.4 Источники данных для MVP

Для MVP BETTA_APP должен опираться на уже существующие локальные данные проекта:

- уроки и runtime-структура: `SERVER/lesson_*_runtime.json`
- статические картинки и thumbnails: `ASSETS/`
- brief / image-review data: `TOOLS/image_review/`

Принцип:

- сначала используем существующий контентный слой как источник данных;
- не создаем новый пустой контентный мир параллельно старому;
- BETTA_APP должен уметь работать поверх реального имеющегося набора уроков и картинок.

### 10.3 Candidate originals

`originalText` и `originalAssetPath` должны сниматься из текущего live/published state, а не из устаревшего baseline, если published version уже существует.

---

## 11. API Surface

Первая версия должна покрыть:

- auth;
- lessons list;
- lesson detail;
- create text candidate;
- create image candidate;
- withdraw candidate;
- grant permission;
- revoke permission;
- list teachers with permission state;
- list teacher pending lessons;
- list lesson pending candidates;
- accept candidate;
- keep current / reject;
- publish lesson;
- rollback version;
- get publish status/history.

Дополнительно обязательно:

- login rate-limit;
- explicit 401 vs 403 behavior;
- deterministic API error shape;
- version history / rollback target selection.

---

## 12. Non-Functional Requirements

### 12.1 Reliability

- deterministic publish flow;
- no hidden divergence between displayed lesson and published snapshot;
- rollback must be explicit and traceable.
- published lesson page must reflect active published snapshot immediately after publish;
- lesson page must return to the previous published snapshot after rollback.

### 12.2 Auditability

- login audit;
- candidate created;
- candidate accepted;
- candidate rejected / kept current;
- candidate withdrawn;
- permission granted/revoked;
- publish created;
- rollback executed.

### 12.3 Testability

Обязательно:

- unit tests for domain services;
- integration tests for API routes;
- Playwright E2E for critical user flows.

Критические E2E flows, которые нельзя потерять:

1. login → dashboard → lesson list;
2. teacher / revisioner edits lesson content;
3. administrator approves or rejects;
4. owner publishes approved state;
5. lesson screen reflects published snapshot;
6. owner rolls back;
7. lesson screen reflects restored snapshot;
8. unauthorized actions receive correct denial.

---

## 13. Первая реализационная фаза

### Phase A — UX/UI Freeze

Сначала утвердить:

- navigation;
- screen list;
- wireframes;
- status model;
- role model;
- language behavior;
- publish/rollback UX.

### Phase B — Domain Freeze

После UX freeze:

- data model;
- source-of-truth rules;
- publish model;
- candidate model.

### Phase C — Implementation

Порядок:

1. auth + user management;
2. lessons dashboard + lesson detail published-first;
3. teacher edit flow;
4. owner revision flow;
5. publish + rollback;
6. tests;
7. docker/deploy.

---

## 14. Acceptance Criteria

BETTA_APP считается готовым к первой приемке, если:

1. owner может создать teacher;
2. owner может выдать revision permission;
3. teacher может изменить текст;
4. teacher может изменить картинку;
5. administrator может принять или отклонить changes;
6. owner может publish;
7. lesson page показывает published result;
8. owner может rollback;
9. lesson page показывает restored result;
10. неавторизованный пользователь получает 401 там, где требуется login;
11. авторизованный, но неразрешенный пользователь получает 403 на forbidden actions;
12. UI не теряет пользователя в статусах и языках.

---

## 15. Прямой следующий шаг

Следующий рабочий артефакт после этого ТЗ:

- `BETTA_APP/docs/UX_UI_WIREFRAMES.md`

В нем надо зафиксировать:

- экран за экраном;
- блок за блоком;
- CTA;
- состояния;
- test ids / selectors для будущих E2E.
