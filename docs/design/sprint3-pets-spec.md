# Design Sprint 3 — Модуль питомцев: спецификация

> Статус: Этап 3A (общие утилиты) реализован.
> Q1 = вариант A: backend расширяется опциональными полями `breed` и `weightKg`
> (миграция V10, nullable-колонки). Старые клиенты не ломаются: новые поля
> необязательны как в запросах, так и в ответах.
> Q2: все тексты форм, валидации и состояний — на русском языке.

---

## 1. Поля карточки/формы питомца

| Поле | Тип формы | Обязательность | Правила (клиент = зеркало backend) |
|---|---|---|---|
| Имя | text | да | непустое после trim, ≤ 50 символов (UI); backend допускает ≤ 100 — обратная совместимость сохранена |
| Вид | select | да | одно из: DOG, CAT, BIRD, HAMSTER, RABBIT, TURTLE, FISH, OTHER (enum `PetSpecies`) |
| Породa | text | нет | ≤ 80 символов; новое поле API `breed` (VARCHAR(80), nullable) |
| Дата рождения | date | нет | не в будущем; пустое значение допустимо |
| Вес, кг | number (step 0.1, inputMode decimal) | нет | > 0 и ≤ 200; запятая при вводе нормализуется в точку; новое поле API `weightKg` (NUMERIC(6,2), nullable) |
| Фото | file upload (существующий эндпоинт) | нет | без изменений: `POST /api/v1/pets/{id}/photo`; placeholder — inline SVG/инициалы, тяжёлые ассеты запрещены |

## 2. Отображение карточки (Web + Mobile)

Порядок информации: **фото/placeholder → имя → вид → порода → возраст → вес → следующая задача**.

*   Placeholder фото: блок с инициалами имени на `--color-primary-soft` (WCAG AA контраст текста ≥ 4.5:1).
*   Возраст: «1 год / 2 года / 5 лет», «< 1 месяца» — форматирование через общие утилиты (`petFormat`).
*   Следующая задача: ближайшая по `dueDate` активная забота (данные уже приходят с dashboard/tasks API — новых эндпоинтов не требуется). Если задач нет — «Задач пока нет».
*   Отсутствующие значения (breed/weight/birthDate) отображаются как «—», форма принимает пустые значения.

## 3. Валидация (Этап 3A)

Файлы:

*   Web:    `apps/web/src/lib/petValidation.ts`, `apps/web/src/lib/petFormat.ts`
*   Mobile: `apps/mobile/src/lib/petUtils.ts` (зеркало, platform-isolated)

Контракт:

```ts
type PetFieldName = 'name' | 'species' | 'breed' | 'birthDate' | 'weightKg'
type PetFieldErrors = Partial<Record<PetFieldName, string>>

validatePetForm(values: PetFormValues): PetFieldErrors   // плоский объект под aria-describedby
isPetFormValid(errors): boolean
```

Правила запуска: `onBlur` по полю + `onSubmit` (вся форма). Ошибки выводятся под
полем: красный текст `--color-danger` + иконка, `aria-invalid="true"`,
`aria-describedby="<field>-error"`. Тексты ошибок — русские, конкретные
(«Укажите имя питомца.», «Дата рождения не может быть в будущем.»).

## 4. Состояния списка

| Состояние | Web | Mobile |
|---|---|---|
| Загрузка | Skeleton-карточки (уже есть `DashboardSkeleton`) | ActivityIndicator |
| Пусто | Empty state: иллюстрация-inline SVG, текст «Пока нет питомцев», CTA «Добавить питомца» | тот же текст/CTA |
| Ошибка сети | баннер + кнопка «Повторить» | аналогично |

## 5. Формы: модальное окно vs экран

*   **Web:** существующая модалка `PetFormModal` (Этап 3C переводится на CSS-классы токенов, добавляются поля «Порода», «Вес», русские ошибки, focus-trap, `role="dialog"`, Esc-закрытие).
*   **Mobile:** полноэкранный `PetFormScreen` в bottom-sheet-стиле (скруглённые верхние углы, drag-indicator) — подтверждение владельца на этапе 3D; кнопки ≥ 44px (`layout.minTouchTarget`).
*   **Удаление:** Web — доступный `ConfirmDialog` (фокус на «Отмена», Enter = отмена, Danger-кнопка требует клика); Mobile — `Alert.alert` (нативное подтверждение). Удаление мягкое (backend `deleted=true`) — поведение не меняется.

## 6. API-контракт (для Этапа 3B, обратная совместимость)

*   `POST /api/v1/pets` body: `{ name*, species*, birthDate?, breed?, weightKg? }`
*   `PATCH /api/v1/pets/{id}` body: все поля опциональны, `null` = «оставить как есть» (PATCH-семантика сохранена).
*   Ответ `PetDto`: добавлены `breed: string | null`, `weightKg: number | null`.
*   Серверные ошибки 400 (FutureBirthDate, Bean Validation) маппятся в русские сообщения на клиенте (маппинг по образцу Sprint 1).

## 7. Дизайн-токены и доступность

*   Web: только CSS-переменные `tokens.css` (`--color-*`, `--space-*`, `--radius-*`); новый файл `apps/web/src/styles/pets.css` (Этап 3C).
*   Mobile: только `src/theme/tokens.ts`; хардкод hex запрещён.
*   WCAG AA: контраст ≥ 4.5:1, видимый focus-ring, touch target ≥ 44px, семантические роли, ошибки связаны с полями.

## 8. Этапы

1.  **3A** ✅ — спецификация + утилиты валидации/форматирования (web + mobile).
2.  **3B** — backend: миграция V10 + Entity/DTO/Service (опциональные поля, валидация веса).
3.  **3C** — web: список/карточки, empty state, `PetFormModal`, `ConfirmDialog`, `pets.css`.
4.  **3D** — mobile: список/карточки, empty state, bottom-sheet форма, удаление с подтверждением.
5.  **3E** — сборка/проверки, финальный отчёт.
