# BETTA_APP — UX/UI Wireframes

Этот документ фиксирует экранный пакет BETTA_APP: каждый экран, его блоки, CTA, состояния и test selectors.

Опорные источники:
- `BETTA_APP/docs/PRODUCT_TZ.md`
- `BETTA_APP/docs/ARCHITECTURE.md`
- `BETTA_APP/docs/DOMAIN_MODEL.md`
- `BETTA_APP/experiments/teacher_step_mock/`
- `BETTA_APP/experiments/review_revisioner_mock/`

---

## 0. Design Language

### 0.1 Layout Shell

Все экраны вложены в единый shell:

```
┌─────────────────────────────────────────────────┐
│ Topbar                                          │
│  Logo · Nav · Role Switch · Lang Switch · User  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Page Content                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

Topbar фиксирован на всех экранах. Содержимое Page Content меняется.

### 0.2 Topbar

| Зона | Содержимое | Видимость |
|---|---|---|
| Logo | SylaSlova Beta | всегда |
| Nav tabs | Lessons · Revision · Admin · Profile | по правилам 5.2 из ТЗ |
| Role switch | chip с `base_role` + dropdown доступных режимов + текущий `active_role_mode` | всегда для ролей выше student |
| Lang switch | `EN` · `RU` · `UK` — три кнопки-кода | всегда |
| User menu | display_name · Logout | всегда |

Test selectors:
- `data-testid="topbar"`
- `data-testid="nav-lessons"` / `nav-revision"` / `nav-admin"` / `nav-profile"`
- `data-testid="role-switch"`
- `data-testid="role-switch-option-{role}"`
- `data-testid="lang-switch"`
- `data-testid="lang-btn-{EN|RU|UK}"`
- `data-testid="user-menu"`
- `data-testid="logout-btn"`

### 0.3 Role Switch Widget

```
┌──────────────────────────┐
│ 🔵 Owner (base)         │
│ ─────────────────────── │
│ ☐ Administrator          │
│ ☐ Revisioner             │
│ ☐ Teacher                │
│ ☐ Student                │
│ ─────────────────────── │
│ Active: Owner ✓          │
│ [Return to Owner]        │
└──────────────────────────┘
```

Принцип:
- показывает базовую роль как заголовок;
- доступные нижние режимы как список;
- текущий активный режим выделен;
- кнопка возврата в базовый режим, если активный отличается от базового.

### 0.4 Context Pills

На lesson-related экранах под topbar появляется строка контекста:

```
[ Lesson 10A ] [ Scene sc1 ] [ Step sc1_3 ] [ EN ] [ Teacher mode ]
```

Каждый pill — chip с текстом. Pill `EN` отражает выбранный content language.
Если контент показан в fallback-языке, рядом с pill `EN` появляется badge `⚠ fallback`.

Test selectors:
- `data-testid="context-pills"`
- `data-testid="context-pill-lesson"`
- `data-testid="context-pill-scene"`
- `data-testid="context-pill-lang"`
- `data-testid="context-pill-role"`
- `data-testid="fallback-badge"`

### 0.5 Базовые компоненты

| Компонент | Описание | Test selector pattern |
|---|---|---|
| Card | Блок с заголовком и содержимым, лёгкая тень | `data-testid="{name}-card"` |
| Chip / Pill | Маленький rounded badge, цветовой код по статусу | `data-testid="chip-{type}"` |
| Ghost Button | Прозрачная кнопка с border | `data-testid="btn-{action}"` |
| Primary Button | Accent-цвет, белый текст | `data-testid="btn-{action}"` |
| Drawer | Боковая панель справа, выдвигается по действию | `data-testid="editor-drawer"` |
| Full-screen Editor | Оверлей на весь экран (для image edit) | `data-testid="fullscreen-editor"` |
| Action Strip | Горизонтальная полоса кнопок-действий | `data-testid="action-strip"` |
| Status Pill | Цветной pill со статусом: pending / accepted / rejected / published | `data-testid="status-{status}"` |
| Thumbnail | Квадратная миниатюра картинки | `data-testid="thumb-{id}"` |
| Ribbon | Горизонтальная лента миниатюр | `data-testid="ribbon-{context}"` |

### 0.6 Цветовые коды статусов

| Статус | Цвет фона | Цвет текста |
|---|---|---|
| published | `#e8f5e9` green-50 | `#2e7d32` green-800 |
| accepted | `#e3f2fd` blue-50 | `#1565c0` blue-800 |
| pending | `#fff8e1` amber-50 | `#f57f17` amber-900 |
| rejected | `#fce4ec` red-50 | `#c62828` red-800 |
| withdrawn | `#f5f5f5` grey-100 | `#616161` grey-700 |
| no permission | `#f5f5f5` grey-100 | `#9e9e9e` grey-500 |

### 0.7 Состояния страниц

Каждый экран должен обрабатывать:

| Состояние | Поведение |
|---|---|
| loading | Skeleton placeholder |
| empty | Иллюстрация + текст «Нет данных» |
| error | Красный banner с сообщением, кнопка retry |
| no permission | Серый блок «Нет доступа к этому разделу» |
| success | Зелёный toast, автоскрытие |
| fallback language | Желтый badge рядом с содержимым |

---

## 1. Login

### 1.1 Wireframe

```
┌─────────────────────────────────────────┐
│            SylaSlova Beta               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Email                            │  │
│  │  [________________________]       │  │
│  │                                   │  │
│  │  Password              [👁]       │  │
│  │  [________________________]       │  │
│  │                                   │  │
│  │  ☐ Remember me                    │  │
│  │                                   │  │
│  │  [ Login ]                        │  │
│  │                                   │  │
│  │  ── or ──                         │  │
│  │                                   │  │
│  │  [ Sign in with Google ]          │  │
│  │  [ Sign in via Soroban.ua ]       │  │
│  │                                   │  │
│  │  ⚠ error message area             │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### 1.2 Элементы

| Элемент | Test selector |
|---|---|
| Email input | `data-testid="login-email"` |
| Password input | `data-testid="login-password"` |
| Show/hide toggle | `data-testid="login-password-toggle"` |
| Remember me | `data-testid="login-remember"` |
| Login button | `data-testid="login-submit"` |
| Google button | `data-testid="login-google"` |
| Soroban button | `data-testid="login-soroban"` |
| Error message | `data-testid="login-error"` |

### 1.3 Состояния

- idle — форма пуста;
- submitting — кнопка disabled, spinner;
- error — красный текст под формой;
- rate-limited — «Слишком много попыток, подождите N секунд»;
- success → redirect to dashboard или account picker.

### 1.4 Account Picker

Появляется, если один `LoginIdentity` связан с несколькими `User`.

```
┌─────────────────────────────────────────┐
│  Выберите профиль                       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 Иван Новоселов  [Teacher]   │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 Маша Новоселова  [Student]  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 Петя Новоселов   [Student]  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Выйти]                               │
└─────────────────────────────────────────┘
```

| Элемент | Test selector |
|---|---|
| Picker container | `data-testid="account-picker"` |
| Profile row | `data-testid="account-picker-row-{userId}"` |
| Profile name | `data-testid="account-picker-name-{userId}"` |
| Profile role chip | `data-testid="account-picker-role-{userId}"` |
| Logout button | `data-testid="account-picker-logout"` |

---

## 2. Lessons Dashboard

### 2.1 Wireframe

```
┌─────────────────────────────────────────────────────┐
│ Topbar [Lessons ●] [Revision] [Admin] [Profile]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Lessons                               [Search ___] │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ thumb    │  │ thumb    │  │ thumb    │          │
│  │          │  │          │  │          │          │
│  │ 1A       │  │ 1B       │  │ 2A       │          │
│  │ Lesson 1A│  │ Lesson 1B│  │ Lesson 2A│          │
│  │ 4 scenes │  │ 3 scenes │  │ 5 scenes │          │
│  │ EN RU UK │  │ EN RU    │  │ EN RU UK │          │
│  │ 🟢 pub  │  │ ⏳ pend  │  │ 🟢 pub  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ...                   │
│  │ 2B       │  │ 3A       │                        │
│  └──────────┘  └──────────┘                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Lesson Card

| Поле | Описание |
|---|---|
| Thumbnail | Из `ASSETS/<id>/<id>_thumbnail.png` |
| Lesson ID | `1A`, `2B`, `10A`... |
| Title | Localized lesson title в текущем content language |
| Scene count | Количество сцен |
| Step count | Количество шагов |
| Languages | Chips поддерживаемых языков |
| Published indicator | 🟢 chip если published, пусто если нет |
| Pending indicator | ⏳ chip с числом pending changes, если есть |

### 2.3 Действия

| Действие | Роль | Поведение |
|---|---|---|
| Click card | все | открывает Lesson Detail |
| Pending badge click | owner, administrator | открывает Lesson Review |

### 2.4 Test selectors

| Элемент | Test selector |
|---|---|
| Dashboard container | `data-testid="lessons-dashboard"` |
| Search input | `data-testid="lessons-search"` |
| Lesson card | `data-testid="lesson-card-{id}"` |
| Thumbnail | `data-testid="lesson-thumb-{id}"` |
| Title | `data-testid="lesson-title-{id}"` |
| Published chip | `data-testid="lesson-published-{id}"` |
| Pending chip | `data-testid="lesson-pending-{id}"` |
| Languages | `data-testid="lesson-langs-{id}"` |

---

## 3. Lesson Detail (Primary Screen)

Это канонический экран продукта. Он lesson-first, role-aware, published-first.
Наследует UX из `teacher_step_mock` и `review_revisioner_mock`.

### 3.1 Wireframe — Read Mode

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar                                                       │
├─────────────────────────────────────────────────────────────┤
│ Context Pills: [ 10A ] [ sc1 ] [ EN ] [ Teacher ] [ 🟢 v3 ]│
├─────────────────────────────────────────────────────────────┤
│ Action Strip (role-dependent):                               │
│ [Ред. картинку] [Ред. бриф] [Ред. опрос] [Ред. оверлей]   │
│ [Ред. учительскую подсказку]                                 │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│  Scene Sidebar       │  Main Content Area                   │
│                      │                                      │
│  ┌────────────────┐  │  ┌──────────────────────────────┐   │
│  │ sc1 ● active  │  │  │ Scene Preview                 │   │
│  │ 3 steps       │  │  │                               │   │
│  │ 2 images      │  │  │  ┌─────────────────────────┐  │   │
│  ├────────────────┤  │  │  │ overlay: "Scary chain"  │  │   │
│  │ sc2           │  │  │  │                         │  │   │
│  │ 4 steps       │  │  │  │   ┌──────────────────┐  │  │   │
│  │ 3 images      │  │  │  │   │ Poll:            │  │  │   │
│  ├────────────────┤  │  │  │   │ "If you don't..."│  │  │   │
│  │ sc3           │  │  │  │   │ ○ Scary chain    │  │  │   │
│  │ 2 steps       │  │  │  │   │ ○ Real warning   │  │  │   │
│  │ 1 image       │  │  │  │   └──────────────────┘  │  │   │
│  └────────────────┘  │  │  └─────────────────────────┘  │   │
│                      │  └──────────────────────────────┘   │
│                      │                                      │
│                      │  ┌──────────────────────────────┐   │
│                      │  │ Teacher Text            [✎]  │   │
│                      │  │ Let's start with scary...    │   │
│                      │  └──────────────────────────────┘   │
│                      │                                      │
│                      │  ┌──────────────────────────────┐   │
│                      │  │ Image Ribbon            [✎]  │   │
│                      │  │ [thumb] [thumb] [thumb]       │   │
│                      │  └──────────────────────────────┘   │
│                      │                                      │
│                      │  ┌──────────────────────────────┐   │
│                      │  │ Brief                   [✎]  │   │
│                      │  │ School warmup scene...       │   │
│                      │  └──────────────────────────────┘   │
│                      │                                      │
│                      │  ┌──────────────────────────────┐   │
│                      │  │ Step Controls                │   │
│                      │  │ [Back] [Reveal] [Next →]     │   │
│                      │  └──────────────────────────────┘   │
│                      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### 3.2 Scene Sidebar

| Элемент | Описание |
|---|---|
| Scene row | Название сцены, число шагов, число картинок |
| Active scene | Подсвечена, bullet marker |
| Brief status chip | Есть/нет brief |
| Pending chip | Если в сцене есть pending changes |

Test selectors:
- `data-testid="scene-sidebar"`
- `data-testid="scene-row-{sceneId}"` 
- `data-testid="scene-row-active"`

### 3.3 Preview Stage

Главная визуальная зона. Показывает сцену так, как её видит пользователь.

5-слойная DOM-структура (снизу вверх):
1. Background image — `ASSETS/<id>/<scene>_bg.png`
2. Dynamic objects — `ASSETS/<id>/<scene>_obj_*.png`
3. Overlay layer — множественные overlay-элементы поверх сцены
4. Poll on slide — вопрос и варианты ответа
5. Teacher controls — не рендерятся в student mode

Test selectors:
- `data-testid="preview-stage"`
- `data-testid="preview-bg"`
- `data-testid="overlay-layer"`
- `data-testid="overlay-item-{index}"`
- `data-testid="poll-on-slide"`
- `data-testid="poll-question"`
- `data-testid="poll-option-{index}"`

### 3.4 Teacher Text Card

Companion block рядом со сценой. Показывает текст для учителя.

Test selectors:
- `data-testid="teacher-text-card"`
- `data-testid="teacher-text-content"`
- `data-testid="teacher-text-edit-btn"`

### 3.5 Image Ribbon

Горизонтальная лента миниатюр текущей сцены. Текущая картинка подсвечена.

Test selectors:
- `data-testid="image-ribbon"`
- `data-testid="ribbon-thumb-{index}"`
- `data-testid="ribbon-thumb-current"`

### 3.6 Brief Card

Текст brief-а для текущей сцены. Источник: `TOOLS/image_review/<id>_briefs.json`.

Test selectors:
- `data-testid="brief-card"`
- `data-testid="brief-content"`
- `data-testid="brief-edit-btn"`

### 3.7 Step Controls

| Кнопка | Действие |
|---|---|
| Back | Предыдущий шаг |
| Reveal | Показать ответ / explanation |
| Show explanation | Показать объяснение |
| Next | Следующий шаг |

Test selectors:
- `data-testid="step-controls"`
- `data-testid="btn-back"`
- `data-testid="btn-reveal"`
- `data-testid="btn-next"`

### 3.8 Action Strip (role-dependent)

Горизонтальная полоса кнопок-действий под context pills.

| Действие | Видимость |
|---|---|
| Редактировать картинку | teacher (с permission), revisioner, administrator, owner |
| Редактировать бриф | teacher (с permission), revisioner, administrator, owner |
| Редактировать опрос | teacher (с permission), revisioner, administrator, owner |
| Редактировать оверлей | teacher (с permission), revisioner, administrator, owner |
| Редактировать учительскую подсказку | teacher (с permission), revisioner, administrator, owner |

В student mode — action strip полностью скрыт.
В teacher mode без permission — скрыт.

Test selectors:
- `data-testid="action-strip"`
- `data-testid="action-edit-image"`
- `data-testid="action-edit-brief"`
- `data-testid="action-edit-question"`
- `data-testid="action-edit-overlay"`
- `data-testid="action-edit-teacher"`

### 3.9 Published-First поведение

- Если у урока есть active published version, Lesson Detail показывает её.
- Если published version нет, показывается baseline из pipeline.
- Published version chip в context pills: `🟢 v3` или `— no published`.
- Если есть pending changes, добавляется pill `⏳ 5 pending`.

---

## 4. Editor Drawers

### 4.1 Teacher Text Editor (Drawer)

Открывается из action strip или из карандаша на teacher text card.
Side drawer справа.

```
┌──────────────────────────────┐
│ Edit Mode            [×]     │
│ Редактирование teacher text  │
├──────────────────────────────┤
│ Старый текст:                │
│ ┌──────────────────────────┐ │
│ │ Let's start with scary...│ │
│ └──────────────────────────┘ │
│                              │
│ Новый текст:                 │
│ ┌──────────────────────────┐ │
│ │ [textarea]               │ │
│ └──────────────────────────┘ │
│                              │
│ [Cancel]  [Save draft]       │
└──────────────────────────────┘
```

Test selectors:
- `data-testid="editor-drawer"`
- `data-testid="drawer-title"`
- `data-testid="drawer-close"`
- `data-testid="editor-teacher"`
- `data-testid="editor-teacher-old"`
- `data-testid="editor-teacher-new"`
- `data-testid="btn-cancel-teacher"`
- `data-testid="btn-save-teacher"`

### 4.2 Question / Poll Editor (Drawer)

```
┌──────────────────────────────┐
│ Edit Mode            [×]     │
│ Редактирование опроса        │
├──────────────────────────────┤
│ Старый вопрос:               │
│ ┌──────────────────────────┐ │
│ │ "If you don't learn..."  │ │
│ └──────────────────────────┘ │
│                              │
│ Новый вопрос:                │
│ ┌──────────────────────────┐ │
│ │ [textarea]               │ │
│ └──────────────────────────┘ │
│                              │
│ Варианты ответа:             │
│ [Scary chain        ]        │
│ [Real warning       ]        │
│ [+ Add option]               │
│                              │
│ Explanation after reveal:    │
│ ┌──────────────────────────┐ │
│ │ [textarea]               │ │
│ └──────────────────────────┘ │
│                              │
│ [Cancel]  [Save draft]       │
└──────────────────────────────┘
```

Test selectors:
- `data-testid="editor-question"`
- `data-testid="editor-question-old"`
- `data-testid="editor-question-new"`
- `data-testid="editor-question-option-{index}"`
- `data-testid="btn-add-option"`
- `data-testid="editor-question-explanation"`
- `data-testid="btn-cancel-question"`
- `data-testid="btn-save-question"`

### 4.3 Brief Editor (Drawer)

Структура аналогична teacher text: старый brief, новый brief, cancel/save.

Test selectors:
- `data-testid="editor-brief"`
- `data-testid="editor-brief-old"`
- `data-testid="editor-brief-new"`
- `data-testid="btn-cancel-brief"`
- `data-testid="btn-save-brief"`

### 4.4 Overlay Editor (Drawer)

Поддерживает множественные overlay-элементы.

```
┌──────────────────────────────┐
│ Edit Mode            [×]     │
│ Редактирование оверлея       │
├──────────────────────────────┤
│ Overlay items:               │
│ ┌────────────────────┐       │
│ │ ● "Scary chain..." │       │
│ │   "Or actual risk" │       │
│ └────────────────────┘       │
│ [+ Add overlay] [Remove]     │
│                              │
│ Overlay text:                │
│ ┌──────────────────────────┐ │
│ │ [textarea]               │ │
│ └──────────────────────────┘ │
│                              │
│ Position / style:            │
│ Drag on preview to position  │
│ Opacity  [=======|====]      │
│ Font size[=======|====]      │
│ Text clr [█ #fff]            │
│ BG color [█ #0d1524]         │
│ ☑ Show background plate      │
│ Font     [Inter ▾]           │
│                              │
│ [Cancel]  [Save draft]       │
└──────────────────────────────┘
```

Поведение:
- Список overlay-элементов вверху;
- Выбранный overlay подсвечен;
- Drag-and-drop позиционирование на preview stage;
- Автоматический размер блока по содержимому текста.

Test selectors:
- `data-testid="editor-overlay"`
- `data-testid="overlay-item-list"`
- `data-testid="overlay-item-{index}"`
- `data-testid="overlay-item-active"`
- `data-testid="btn-add-overlay"`
- `data-testid="btn-remove-overlay"`
- `data-testid="overlay-text-input"`
- `data-testid="overlay-opacity"`
- `data-testid="overlay-fontsize"`
- `data-testid="overlay-color"`
- `data-testid="overlay-bg-color"`
- `data-testid="overlay-bg-toggle"`
- `data-testid="overlay-font-family"`
- `data-testid="btn-cancel-overlay"`
- `data-testid="btn-save-overlay"`

### 4.5 Image Editor (Full-Screen)

Не drawer, а почти полноэкранный editor surface, перекрывающий базовый экран.
Наследует layout из `review_revisioner_mock` image editor.

```
┌─────────────────────────────────────────────────────────────┐
│ Image Editor                                         [×]    │
├────────────────────────────────────┬────────────────────────┤
│                                    │                        │
│  1. Лента текущего урока           │  Current selected      │
│  [thumb] [thumb●] [thumb] [thumb]  │  ┌──────────────────┐  │
│                                    │  │                  │  │
│  2. Browser по урокам              │  │   hero image     │  │
│  ┌──────────────────────────────┐  │  │                  │  │
│  │ Lesson 1A                   │  │  └──────────────────┘  │
│  │ [t] [t] [t]                 │  │                        │
│  ├──────────────────────────────┤  │  Candidate images      │
│  │ Lesson 1B                   │  │  [cand] [cand] [cand]  │
│  │ [t] [t] [t]                 │  │  [cand]                │
│  ├──────────────────────────────┤  │                        │
│  │ Lesson 2A                   │  │  Decision:             │
│  │ [t] [t]                     │  │  [Regen]               │
│  ├──────────────────────────────┤  │  [Keep current]        │
│  │ Unused generated            │  │  [Save image draft]    │
│  │ [t] [t] [t] [t]            │  │                        │
│  └──────────────────────────────┘  │                        │
│                                    │                        │
│  3. Свой prompt (fallback)         │                        │
│  Current prompt:                   │                        │
│  "School assembly, students..."    │                        │
│  New prompt:                       │                        │
│  [textarea                    ]    │                        │
│  [Перевести и сгенерировать]       │                        │
│  [Оставить текущую]                │                        │
│                                    │                        │
└────────────────────────────────────┴────────────────────────┘
```

Три пути выбора картинки (в порядке приоритета):
1. Быстрый выбор из ленты текущего урока;
2. Выбор из глобального browser (уроки сверху вниз, unused внизу);
3. Свой prompt → перевод → генерация (fallback).

Test selectors:
- `data-testid="image-editor"`
- `data-testid="image-editor-close"`
- `data-testid="image-lesson-ribbon"`
- `data-testid="image-browser"`
- `data-testid="image-browser-lesson-{id}"`
- `data-testid="image-browser-unused"`
- `data-testid="image-current-prompt"`
- `data-testid="image-new-prompt"`
- `data-testid="btn-translate-generate"`
- `data-testid="btn-keep-current-image"`
- `data-testid="image-hero"`
- `data-testid="image-candidate-{index}"`
- `data-testid="btn-regen"`
- `data-testid="btn-save-image"`

---

## 5. Revision Dashboard

Видимость: owner, administrator.
Для revisioner: урезанный read-only вариант без approve/reject.

### 5.1 Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ Topbar  [Lessons] [Revision ●] [Admin] [Profile]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Revision Dashboard                                     │
│                                                         │
│  Teachers with Revision Access                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Name         │ Email      │ Role  │ Perm │ Pend │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ Иван Иванов │ i@i.com   │ Teacher│ ✅   │ 3   │    │
│  │              │           │       │      │ [→] │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ Мария Петр. │ m@p.com   │ Teacher│ ❌   │ 0   │    │
│  │              │           │       │[Grant]│     │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ Олег Сидор. │ o@s.com   │ Revis.│ —    │ 5   │    │
│  │              │           │       │      │ [→] │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Teacher Row

| Поле | Описание |
|---|---|
| Name | `display_name` |
| Email | login email |
| Role chip | `Teacher` / `Revisioner` |
| Permission chip | ✅ active / ❌ inactive / — not applicable |
| Pending count | Число pending changes |
| Primary action | `[→]` переход в teacher drilldown / `[Grant]` если нет permission |

### 5.3 Действия

| Действие | Роль | Test selector |
|---|---|---|
| Grant permission | owner, administrator | `data-testid="btn-grant-{userId}"` |
| Revoke permission | owner, administrator | `data-testid="btn-revoke-{userId}"` |
| Go to drilldown | owner, administrator | `data-testid="btn-drilldown-{userId}"` |

### 5.4 Test selectors

- `data-testid="revision-dashboard"`
- `data-testid="teacher-row-{userId}"`
- `data-testid="teacher-name-{userId}"`
- `data-testid="teacher-role-{userId}"`
- `data-testid="teacher-perm-{userId}"`
- `data-testid="teacher-pending-{userId}"`

---

## 6. Teacher Drilldown

Цель: owner / administrator видит, в каких уроках у конкретного учителя / ревизионера есть pending changes.

### 6.1 Wireframe

```
┌─────────────────────────────────────────────────┐
│ ← Back to Revision Dashboard                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Иван Иванов · Teacher · ✅ Revision active     │
│                                                 │
│  Lessons with pending changes:                  │
│                                                 │
│  ┌──────────┬───────────────────┬────────┐      │
│  │ Lesson   │ Title             │ Pending│      │
│  ├──────────┼───────────────────┼────────┤      │
│  │ 1A       │ Scary Chains      │ 2      │      │
│  │          │                   │ [Review]│     │
│  ├──────────┼───────────────────┼────────┤      │
│  │ 3B       │ Source Check       │ 1      │      │
│  │          │                   │ [Review]│     │
│  └──────────┴───────────────────┴────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 Test selectors

- `data-testid="teacher-drilldown"`
- `data-testid="drilldown-teacher-name"`
- `data-testid="drilldown-teacher-role"`
- `data-testid="drilldown-teacher-perm"`
- `data-testid="drilldown-lesson-{lessonId}"`
- `data-testid="drilldown-pending-{lessonId}"`
- `data-testid="btn-review-{lessonId}"`
- `data-testid="btn-back-to-revision"`

---

## 7. Lesson Review

Цель: administrator review + owner publish конкретного урока.
UX-референс: `SERVER/review.html`.

### 7.1 Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                                       │
├─────────────────────────────────────────────────────────────┤
│ Context: [ 10A ] [ Lesson Review ] [ ⏳ 5 pending ]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────── Scene sc1 ──────────────────────────────────┐   │
│  │                                                      │   │
│  │  Location: sc1 / step sc1_3 / teacher_text           │   │
│  │  ┌────────────────────┬────────────────────┐         │   │
│  │  │ Current            │ Proposed           │         │   │
│  │  │ "Let's start..."   │ "Ask the class..." │         │   │
│  │  └────────────────────┴────────────────────┘         │   │
│  │  Author: Иван Иванов · Teacher                       │   │
│  │  Status: ⏳ pending                                   │   │
│  │  [Accept]  [Keep current]                             │   │
│  │                                                      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  Location: sc1 / image assignment                    │   │
│  │  ┌────────────────────┬────────────────────┐         │   │
│  │  │ Current image      │ Proposed image     │         │   │
│  │  │ [thumbnail]        │ [thumbnail]        │         │   │
│  │  └────────────────────┴────────────────────┘         │   │
│  │  Author: Олег Сидоров · Revisioner                   │   │
│  │  Status: ⏳ pending                                   │   │
│  │  [Accept]  [Keep current]                             │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────── Scene sc2 ──────────────────────────────────┐   │
│  │  ...                                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Publish Panel                                         │ │
│  │                                                       │ │
│  │ Accepted unpublished: 3                               │ │
│  │ Rejected: 1                                           │ │
│  │ Still pending: 1                                      │ │
│  │                                                       │ │
│  │ [Publish v4]                    (owner only)          │ │
│  │                                                       │ │
│  │ Status: Ready to publish / Not ready                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Comparison Block

Каждый pending candidate отображается как comparison:

| Поле | Описание |
|---|---|
| Location | scene / step / field |
| Current value | Текст или thumbnail |
| Proposed value | Текст или thumbnail |
| Author | display_name + role chip |
| Status | pending / accepted / rejected / withdrawn |
| Accept button | administrator, owner |
| Keep current button | administrator, owner |

Для revisioner: comparison blocks видимы, но без accept/reject кнопок.

### 7.3 Publish Panel

Видимость: owner only.

| Элемент | Описание |
|---|---|
| Accepted count | Число accepted unpublished candidates |
| Rejected count | Число rejected candidates |
| Pending count | Число оставшихся pending |
| Publish button | Активна только если accepted > 0 |
| Status label | Ready / Not ready |

После publish: success toast, candidates помечены `published`, version number увеличен.

### 7.4 Test selectors

- `data-testid="lesson-review"`
- `data-testid="review-scene-{sceneId}"`
- `data-testid="review-candidate-{candidateId}"`
- `data-testid="review-current-{candidateId}"`
- `data-testid="review-proposed-{candidateId}"`
- `data-testid="review-author-{candidateId}"`
- `data-testid="review-status-{candidateId}"`
- `data-testid="btn-accept-{candidateId}"`
- `data-testid="btn-reject-{candidateId}"`
- `data-testid="publish-panel"`
- `data-testid="publish-accepted-count"`
- `data-testid="publish-pending-count"`
- `data-testid="btn-publish"`
- `data-testid="publish-status"`

---

## 8. Version History / Rollback

Видимость: owner only.
Доступен из Lesson Detail или Lesson Review.

### 8.1 Wireframe

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Lesson 10A                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Version History · Lesson 10A                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ v3 · 🟢 ACTIVE                               │  │
│  │ Published by: Owner · 2026-04-02 14:30        │  │
│  │ Changes: 4 accepted candidates                │  │
│  │ Description: "Fixed sc1 teacher text + image" │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ v2                                            │  │
│  │ Published by: Owner · 2026-03-28 10:15        │  │
│  │ Changes: 2 accepted candidates                │  │
│  │ [Rollback to v2]                              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ v1                                            │  │
│  │ Published by: Owner · 2026-03-20 09:00        │  │
│  │ Changes: initial publish                      │  │
│  │ [Rollback to v1]                              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Rollback confirmation:                             │
│  ┌───────────────────────────────────────────────┐  │
│  │ ⚠ Вы уверены? Lesson 10A вернётся к v2.     │  │
│  │ [Cancel]  [Confirm rollback]                  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 8.2 Test selectors

- `data-testid="version-history"`
- `data-testid="version-{number}"`
- `data-testid="version-active"`
- `data-testid="version-published-by-{number}"`
- `data-testid="btn-rollback-{number}"`
- `data-testid="rollback-confirm"`
- `data-testid="btn-rollback-cancel"`
- `data-testid="btn-rollback-execute"`

---

## 9. Admin — User Management

Видимость: owner, administrator.

### 9.1 Wireframe

```
┌─────────────────────────────────────────────────────┐
│ Topbar  [Lessons] [Revision] [Admin ●] [Profile]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Users                                [+ Create]    │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Name       │ Email    │ Role      │ Status  │   │
│  ├──────────────────────────────────────────────┤   │
│  │ Admin A    │ a@a.com  │ Admin     │ 🟢 active│  │
│  ├──────────────────────────────────────────────┤   │
│  │ Teacher B  │ b@b.com  │ Teacher   │ 🟢 active│  │
│  ├──────────────────────────────────────────────┤   │
│  │ Student C  │ c@c.com  │ Student   │ ⚫ inactive│ │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9.2 Create User Modal

```
┌────────────────────────────────────┐
│ Create User                  [×]   │
├────────────────────────────────────┤
│ Email:                             │
│ [________________________]         │
│                                    │
│ Display name:                      │
│ [________________________]         │
│                                    │
│ Password:                          │
│ [________________________]         │
│                                    │
│ Role:                              │
│ [Teacher ▾]                        │
│  - Administrator (owner only)      │
│  - Revisioner (owner only)         │
│  - Teacher                         │
│  - Student                         │
│                                    │
│ [Cancel]  [Create]                 │
└────────────────────────────────────┘
```

Правила создания:
- owner может создать: administrator, revisioner, teacher, student;
- administrator может создать: teacher, student;
- teacher может создать: student;
- никто не может создать роль равную или выше своей.

### 9.3 Test selectors

- `data-testid="admin-users"`
- `data-testid="btn-create-user"`
- `data-testid="user-row-{userId}"`
- `data-testid="user-name-{userId}"`
- `data-testid="user-role-{userId}"`
- `data-testid="user-status-{userId}"`
- `data-testid="btn-deactivate-{userId}"`
- `data-testid="create-user-modal"`
- `data-testid="create-email"`
- `data-testid="create-name"`
- `data-testid="create-password"`
- `data-testid="create-role"`
- `data-testid="btn-create-submit"`
- `data-testid="btn-create-cancel"`

---

## 10. Profile / Session

### 10.1 Wireframe

```
┌─────────────────────────────────────────────────────┐
│ Topbar  [Lessons] [Revision] [Admin] [Profile ●]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Profile                                            │
│                                                     │
│  Display name: Иван Иванов                          │
│  Email: ivan@example.com                            │
│  Base role: Owner                                   │
│  Active mode: Teacher                               │
│  Auth provider: Google                              │
│  UI language: [EN ▾]                                │
│                                                     │
│  Linked accounts:                                   │
│  - ivan@example.com (credentials)                   │
│  - ivan@gmail.com (Google)                          │
│                                                     │
│  [Change password]  [Logout]                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 10.2 Test selectors

- `data-testid="profile-page"`
- `data-testid="profile-name"`
- `data-testid="profile-email"`
- `data-testid="profile-role"`
- `data-testid="profile-active-mode"`
- `data-testid="profile-provider"`
- `data-testid="profile-ui-lang"`
- `data-testid="profile-linked-accounts"`
- `data-testid="btn-change-password"`
- `data-testid="btn-logout"`

---

## 11. Экранная карта (Screen Map)

```
Login
  ├── Account Picker (если >1 профиль)
  └── Lessons Dashboard
        ├── Lesson Detail
        │     ├── [Editor Drawers: teacher, question, brief, overlay]
        │     ├── [Image Editor: fullscreen]
        │     └── Version History / Rollback (owner)
        ├── Lesson Review (via pending badge)
        │     └── Publish Panel (owner)
        └── (via nav)
              ├── Revision Dashboard
              │     └── Teacher Drilldown
              │           └── Lesson Review
              ├── Admin — User Management
              │     └── Create User Modal
              └── Profile / Session
```

### 11.1 Навигация по ролям

| Роль | Lessons | Revision | Admin | Profile |
|---|---|---|---|---|
| owner | ✅ | ✅ | ✅ | ✅ |
| administrator | ✅ | ✅ (approve) | ✅ | ✅ |
| revisioner | ✅ | ✅ (read-only) | ❌ | ✅ |
| teacher | ✅ | ❌ (only my edits) | ❌ | ✅ |
| student | ✅ (lesson view only) | ❌ | ❌ | ✅ |

---

## 12. Критические E2E Flows (wireframe-aligned)

Эти flows отражают цепочки экранов для обязательных E2E-тестов из ТЗ.

### Flow 1: Login → Dashboard → Lesson
```
Login → Lessons Dashboard → click lesson card → Lesson Detail
```
Test: `e2e/login-to-lesson.spec.ts`

### Flow 2: Teacher edits lesson content
```
Lesson Detail → action strip → editor drawer → save draft → pending badge appears
```
Test: `e2e/teacher-edit.spec.ts`

### Flow 3: Administrator approves/rejects
```
Revision Dashboard → teacher drilldown → Lesson Review → accept/reject candidates
```
Test: `e2e/admin-review.spec.ts`

### Flow 4: Owner publishes
```
Lesson Review → publish panel → publish → Lesson Detail shows published state
```
Test: `e2e/owner-publish.spec.ts`

### Flow 5: Published lesson reflects snapshot
```
Lesson Detail → verify published version chip → verify content matches snapshot
```
Test: `e2e/published-state.spec.ts`

### Flow 6: Owner rollback
```
Lesson Detail → Version History → select previous → confirm rollback → verify restored state
```
Test: `e2e/owner-rollback.spec.ts`

### Flow 7: Unauthorized access denied
```
Attempt admin page as teacher → 403 → attempt revision action as student → 403
```
Test: `e2e/access-denied.spec.ts`

### Flow 8: Role switch
```
Topbar → role switch → select lower role → UI adapts → return to base role
```
Test: `e2e/role-switch.spec.ts`

---

## 13. Открытые вопросы UX

1. Нужен ли teacher отдельный экран «My Edits» со списком всех pending candidates, или достаточно inline-badge на Lesson Detail?
2. Нужна ли revisioner-у отдельная revision-навигация или хватает Lesson Detail с action strip?
3. Должен ли administrator видеть pending candidates прямо на Lessons Dashboard или только через Revision Dashboard → drilldown?
4. Как выглядит mobile/tablet адаптация? Sidebar collapse? Drawer вместо sidebar?
5. Нужен ли drag-and-drop для reorder overlay items или достаточно add/remove?

---

## 14. Следующий документ

После утверждения wireframes:

- `BETTA_APP/docs/DESIGN_SYSTEM.md` — компоненты, размеры, состояния, tokens
- `BETTA_APP/docs/API_SPEC.md` — endpoint-by-endpoint spec
- `BETTA_APP/docs/IMPLEMENTATION_PLAN.md` — порядок реализации
