# Pet Care Platform — Текстовые wireframes ключевых экранов

> Design Sprint 0, Шаг 6. Только описание структуры и состояний — без реализации.
> Обозначения: **W** = web (AppShell: sidebar ≥1024px / bottom-nav <768px), **M** = mobile (Expo, bottom tabs).
> Все размеры/цвета берутся из токенов (`--space-*`, `--color-*`), базовый шаг отступов — 4/8px, touch target ≥44px.

---

## Общие паттерны (для всех экранов)

**Состояния загрузки/ошибки/пустоты (единые компоненты):**
- `LoadingSkeleton`: карточки-скелетоны по форме будущего контента; показывать >300мс, до — ничего (избегать «мигания»).
- `EmptyState`: inline-SVG иллюстрация (placeholder-блок), заголовок (h3), 1 строка пояснения, primary-кнопка действия.
- `ErrorState`: danger-иконка, текст ошибки (с серверным сообщением `ApiErrorBody`), кнопка «Повторить» + secondary «Назад».
- `Toast`: bottom (M) / top-right (W), z-index `--z-toast`, автоскрытие 5с, дублируется в aria-live polite.

**Формы (общие правила):**
- Подпись поля над inputом (14px, `--color-text-secondary`); обязательные поля — метка «*» + подпись «Обязательное».
- Валидация: onBlur (field-level) + onSubmit (submit-level). Ошибка под полем, 13px, `--color-danger`, с aria-describedby; не полагаться только на цвет — плюс иконка.
- Кнопка submit блокируется на время запроса (spinner + disabled), защита от двойной отправки.
- Поля ввода дат/времени — нативные `<input type="date/time">` (W) и DateTimePicker-паттерн (M).

---

## 1. Login

**Цель:** безопасный вход в аккаунт; быстрый возврат к главной.
**Действие пользователя:** ввести email/пароль → «Войти» → попасть на Dashboard.

```
┌─────────────────────────────┐
│  [logo 🐾] PetCare          │  header (M: центр; W: card по центру экрана)
│                             │
│  Email                      │  input, type=email, autocomplete=email
│  ▸ ошибка: "Укажите email"  │
│  Пароль                     │  input password + toggle 👁 показа
│  ▸ ошибка: "Неверные данные"│  (server 401 → ErrorState над формой)
│  [ Войти ]                  │  button primary, full-width (M) / auto (W)
│  Нет аккаунта? Зарегистрироваться │ link
│  ▢ Запомнить меня           │ checkbox (W only)
└─────────────────────────────┘
```

- **Блоки сверху вниз:** логотип → заголовок «С возвращением» → форма (email, пароль, submit) → ссылка на Register.
- **Валидации:** email — формат; пароль — непустой; 401 → «Проверьте email и пароль» (без раскрытия существования аккаунта).
- **Состояния:** loading — spinner в кнопке; error — toast/banner; success — redirect `/`.
- **W/M:** M — полноэкранная форма, safe-area снизу; W — центрированная карточка max-width 420px поверх фона `--color-bg-page`.

## 2. Register

**Цель:** создать аккаунт владельца.
**Действие:** заполнить имя/email/пароль → принять оферту → «Создать аккаунт».

- **Блоки:** логотип → заголовок «Создать аккаунт» → поля: Имя (text), Email, Пароль (+toggle), Подтверждение пароля → checkbox «Согласен с правилами»* → [Создать аккаунт] → ссылка «Уже есть аккаунт? Войти».
- **Валидации:** имя ≥2 симв.; email формат; пароль ≥8 симв., подсказка-требования чек-листом в реальном времени; подтверждение = пароль; checkbox обязателен.
- **Ошибки:** 409 (email занят) → ошибка на поле Email; 400 field errors → маппинг `FieldError[]` на поля.
- **W/M:** идентичны Login; M — кнопка прилипает к нижнему safe-area.

## 3. Dashboard / Главная

**Цель:** «что сделать сегодня» + сводка здоровья питомцев.
**Действия:** отметить задачу выполненной; перейти к питомцу/запасам; добавить задачу.

- **Блоки сверху вниз:**
  1. Header: приветствие «Привет, {имя}» + дата + кнопка 🔔 уведомления (badge непрочитанных).
  2. **Сегодня** (секция): список `TaskItem` — иконка типа задачи (VACCINATION/VET/FOOD/GROOMING/MEDICATION/WALK/OTHER), название, привязанный питомец (Avatar+имя), срок (badge: просрочено=danger, сегодня=warning, позже=default), чекбокс выполнения.
  3. **Мои питомцы**: горизонтальный скролл `PetCard` (аватар/placeholder-блок, клич, вид, следующий визит).
  4. **Ближайший визит**: мини-карточка (дата, клиника, [Подробности]).
  5. **Корм на исходе**: 1–2 `FoodStockCard` с низким остатком + [Купить] → в Shopping list.
- **Кнопки:** FAB/[+ Новая задача] (primary, right-bottom M / top-right W); клик по карточкам — навигация.
- **Состояния:** loading — skeleton секций; empty (нет питомцев) — EmptyState «Добавьте первого питомца» [Добавить питомца]; error — ErrorState + Повторить.
- **W/M:** W — сетка 2 колонки (Сегодня | Питомцы+Визит), sidebar активен «Главная». M — одна колонка, скролл, bottom tab «Главная».

## 4. Pets list

**Цель:** все питомцы пользователя, быстрый вход в профиль.
**Действие:** открыть питомца; создать нового.

- **Блоки:** заголовок «Питомцы» + [＋ Добавить] → грид/список `PetCard`: аватар (photo или placeholder-блок с инициалами), клич, вид·порода, возраст, бейдж «N задач», последняя активность.
- **Сортировка (W):** по имени/ближайшей задаче. Поиск по кличу (≥5 питомцев).
- **Состояния:** skeleton карточек; empty — EmptyState с CTA; error — ErrorState.
- **W/M:** W — грид 3 колонки в content-area; M — 1 колонка, pull-to-refresh.

## 5. Pet profile

**Цель:** всё о питомце в одном месте.
**Действия:** смотреть историю, задачи, редактировать.

- **Блоки:** DetailHeader (← назад, имя, ⋮ меню: Редактировать/Удалить) → Шапка: аватар крупно, клич, вид, порода, дата рождения/возраст, вес, пол (Badge-параметры) → Табы/секции:
  1. **Обзор**: ближайшие задачи (TaskItem), текущий корм (FoodStockCard).
  2. **История здоровья**: `HealthTimelineItem` — вертикальная лента (меридиан слева): дата, тип (APPOINTMENT/RECORD badge), ветеринар/клиника, краткое описание, вложения (AttachmentDto — PDF/фото, ссылки).
  3. **Прививки**: статус-карточки (дата следующей, badge срока).
- **Кнопки:** [Записать визит] (primary), [Редактировать], [+ Задача].
- **Состояния:** loading skeleton шапки+ленты; удаление → Modal-подтверждение (danger); error — ErrorState.
- **W/M:** W — 2 колонки (обзор | timeline); M — табы Обзор/История, sticky-header с именем.

## 6. Create/Edit pet

**Цель:** завести карточку питомца.
**Действие:** заполнить анкету → Сохранить.

- **Поля:** Клич* (text ≤50) · Вид* (select: dog/cat/bird/… из `PetSpecies`) · Порода (text, optional) · Дата рождения (date, ≤ сегодня) · Пол (radio segmented) · Вес, кг (number, 0.1–200) · Фото (avatar upload — placeholder-зона «перетащите файл», для MVP — выбор из system-preset) · Примечания (TextArea ≤500).
- **Валидации:** клич обязателен; дата не в будущем; вес — число в диапазоне. 400 → подсветка полей.
- **Кнопки:** [Отмена] (ghost) + [Сохранить] (primary, sticky bottom M).
- **Состояния:** save-loading — disabled кнопки; unsaved-changes — Modal «Выйти без сохранения?» при уходе.
- **W/M:** W — форма в карточке 640px внутри AppShell; M — полноэкранный modal-stack с DetailHeader.

## 7. Tasks list

**Цель:** все напоминания (прививки, врач, корм, лечение…).
**Действия:** выполнить/отменить задачу, создать новую, фильтровать.

- **Блоки:** заголовок «Задачи» + фильтр-чипы (Все/Просроченные/Сегодня/На неделе; тип задачи; питомец) → группы-секции: Просроченные (danger-акцент), Сегодня, Позже → `TaskItem`: чекбокс-слева (done — зачёркнутый + opacity), иконка типа, название, питомец (Avatar sm), дата/повторность («каждые 30 дней» ↻), badge статуса PENDING/DONE.
- **Действия по свайпу (M):** ← Отложить, ✓ Выполнить. Долгое нажатие/⋮ (W): Редактировать/Удалить.
- **Кнопки:** FAB [+ Новая задача]; [Выполнить] inline.
- **Состояния:** skeleton списка; empty — «Задач нет» + CTA; error — ErrorState; complete → Toast «Готово ✓» + оптимистичное обновление (рекурентная задача пересоздаётся на сервере → refetch).
- **W/M:** W — таб-подобный список с bulk-действиями; M — один столбец + bottom sheet фильтров.

## 8. Create/Edit task

**Цель:** настроить напоминание.
**Поля:** Название* (text) · Тип* (select из `CareTaskType`) · Питомец* (select/picker c Avatar) · Дата* (date) · Время (time, optional) · Повторение (switch → select интервал `RecurrenceUnit`: день/неделя/месяц) · Заметка (TextArea) · Напоминание за (select: 1д/1нед/месяц).
**Валидации:** название ≥2; дата ≥ сегодня (для новых); при повторении ≥1.
**Кнопки:** [Отмена] · [Сохранить]; Delete (edit-mode, danger, Modal-подтверждение).
**Состояния:** loading/spinner submit; error banner 400/404.
**W/M:** W — центрированный Modal 560px; M — полноэкранный BottomSheet/stack-screen со sticky-save.

## 9. Veterinary history

**Цель:** полная мед. история питомца (визиты + записи).
**Действия:** просмотреть визит, прикрепить запись, добавить новый.

- **Блоки:** DetailHeader (←, «История: {питомец}») → фильтр по году/типу (APPOINTMENT/RECORD) → `HealthTimelineItem` лента (из `GET /api/v1/pets/{id}/history`, сортировка newest-first): узел даты, badge типа, заголовок (причина визита / тип записи), врач·клиника, заметка (2 строки + «ещё»), вложения (иконки 📎), статус визита (SCHEDULED=info, COMPLETED=success, CANCELLED=danger).
- **Кнопки:** [+ Визит] (primary), [+ Запись]; tap item → детали/редактирование.
- **Состояния:** skeleton ленты; empty — «История пуста, добавьте первый визит»; error — ErrorState.
- **W/M:** W — лента 720px + preview выбранного элемента справа; M — лента + tap→detail screen.

## 10. Create vet visit

**Цель:** записать визит/прививку к врачу.
**Поля:** Питомец* (readonly если из профиля) · Дата* (date, ≥ сегодня) · Время (time) · Причина* (text ≤200) · Клиника (text) · Врач (text) · Тип (select: плановый/прививка/осмотр/операция/экстренный) · Статус (select, edit-mode) · Заметка (TextArea) · Вложения (file placeholder-зона, ≤5 файлов).
**Валидации:** дата не в прошлом при создании; причина обязательна; конфликт даты — предупреждение info-banner.
**Кнопки:** [Отмена] · [Сохранить визит]; после сохранения — Toast + переход к истории.
**Состояния:** submit-loading; server errors → field mapping.
**W/M:** как Create/Edit task (Modal / fullscreen sheet).

## 11. Food products

**Цель:** склад кормов/товаров: что есть и когда кончится.
**Действия:** добавить продукт, отметить покупку, списать расход.

- **Блоки:** заголовок «Запасы» + [＋ Добавить товар] → фильтр категорий (`FoodCategory`: DRY/WET/TREAT/SUPPLEMENT/LITTER чипы) → список `FoodStockCard`: название, категория-badge, остаток (progress-bar: `StockUnit` PCS/KG/G, low <20% → warning/danger), расход/неделю, «хватит до {дата}», кнопки [− Списать] [+ Добавлено из магазина].
- **Кнопки:** [+ Товар] → форма (название*, бренд, категория*, упаковка/вес, периодичность покупки); swipe/decrement.
- **Состояния:** skeleton карточек; empty — «Список склада пуст» + CTA; error — ErrorState.
- **W/M:** W — грид 2–3 колонки; M — 1 колонка, pull-to-refresh.

## 12. Shopping list

**Цель:** список покупок, пополняемый вручную и из низких остатков.
**Действия:** добавить позицию, отметить купленным (списание со склада), очистить купленные.

- **Блоки:** заголовок «Купить» + счётчик «N позиций» → [＋ Добавить] → список `ShoppingListItem`: чекбокс, название, количество/размер, цена (optional), источник-badge («из запасов» if auto), дата добавления → footer: [Очистить купленные] (ghost, danger-text).
- **Быстрое действие:** из FoodStockCard «Закончился» → [+ В список] (Toast «Добавлено»).
- **Валидации (добавление):** название обязательно, qty ≥1 (inline input + stepper −/+).
- **Состояния:** skeleton; empty — EmptyState «Список пуст» + подсказка про запасы; purchase-toggle → optimistic update + Toast undo (5с).
- **W/M:** W — список + панель «часто покупаемое» справа; M — чекбокс-строки 48px, sticky-add внизу.

## 13. Profile / Settings

**Цель:** аккаунт, питомцы вне дома, выход.
**Блоки:** заголовок «Профиль» → карточка пользователя (Avatar, имя, email, [Редактировать имя]) → секции:
- **Уведомления** → переход на экран 14;
- **Аккаунт**: смена пароля (bottom sheet/modal: текущий, новый, подтверждение);
- **Устройства (push)**: список `DeviceDto` (маскированный token, дата) — удалить устройство;
- **Приложение**: версия, «О сервисе», тема (light/dark — future);
- [Выйти] (danger outline) → Modal-подтверждение.
**Состояния:** loading skeleton; logout-success → clear AuthContext → redirect /login.
**W/M:** W — секции в колонке 640px; M — grouped list (iOS-style) с chevron.

## 14. Notifications settings

**Цель:** управлять каналами и типами напоминаний.
**Блоки:** DetailHeader (← Настройки, «Уведомления») → секции:
1. **Каналы**: Switch Push (статус устройства), Switch Email (email подтверждён? badge).
2. **Типы событий** (checkbox-list): прививки, визиты к врачу, конец корма, лекарства, уход, прогулки.
3. **Когда напоминать**: select по умолчанию (за 1 день / 3 дня / неделю).
4. **Тихие часы**: Switch + два time-input (from/to).
**Действия:** каждый переключатель — мгновенный PATCH + Toast при успехе, rollback состояния при ошибке (error toast).
**Состояния:** loading — skeleton switches; offline/error — banner «Не сохранено, повторить?».
**W/M:** одинаково; W — inline в content, M — отдельный stack-экран.

---

## Матрица «экран → компоненты дизайн-системы»

| Экран | Компоненты |
|---|---|
| Login/Register | Input, Button, Checkbox, Toast, ErrorState |
| Dashboard | TaskItem, PetCard, FoodStockCard, Badge, Avatar, LoadingSkeleton, EmptyState |
| Pets list | PetCard, Button, LoadingSkeleton, EmptyState |
| Pet profile | Avatar, Badge, HealthTimelineItem, TaskItem, Card, Modal, DetailHeader |
| Create/Edit pet | Input, Select, TextArea, Switch, Button, Modal, Avatar-upload |
| Tasks | TaskItem, Badge, Checkbox, BottomSheet(фильтры), Toast, EmptyState |
| Create/Edit task | Input, Select, DateInput, Switch, Button, Modal |
| Vet history | HealthTimelineItem, Badge, Button, LoadingSkeleton |
| Create vet visit | Input, Select, TextArea, Button, file-placeholder |
| Food products | FoodStockCard, Badge, Button, ProgressBar, EmptyState |
| Shopping list | ShoppingListItem, Checkbox, Stepper, Toast(+undo), EmptyState |
| Profile | Card, Avatar, Button, Modal, List |
| Notifications | Switch, Checkbox, Select, Toast, ErrorBanner |

## Принципы соответствия WCAG AA (применимо ко всем экранам)
- Контраст текста ≥4.5:1 (все пары из токенов проверены: `--color-text-primary`/bg = 15.9:1, secondary = 8.4:1, teal-600 на белом = 4.8:1).
- Focus-visible ring на всех интерактивных; порядок обхода = визуальный порядок.
- Touch target ≥44×44; status передаётся текстом + иконкой, не только цветом.
- Формы: label↔input связаны, ошибки через aria-describedby, live-region для Toast.
