# pet-care-v2

Google Calendar: [добавление событий из мобильного приложения](docs/google-calendar.md).
## Быстрый старт

Подробная инструкция по локальному запуску через VS Code: [SETUP-VSCODE.md](SETUP-VSCODE.md)

```bash
# Backend  -> http://localhost:8080/api/v1/health
cd services/backend && ./mvnw spring-boot:run

# Web      -> http://localhost:5173
cd apps/web && npm install && npm run dev

# Mobile   -> Expo Go 58 (QR-код в терминале)
cd apps/mobile && npm install && npx expo start

# PostgreSQL 17 (миграции Flyway применяются автоматически при старте backend)
cd infra && docker compose up -d
```

## Язык приложения

На сайте язык выбирается переключателем и сохраняется в браузере. Мобильное
приложение использует русский при основном языке телефона `ru`, английский —
при любом другом языке. Новые напоминания об уходе и низком остатке корма
переводятся в ленте обоих клиентов. Ранее сохранённые уведомления отображаются
с исходным текстом. Внешние напоминания об уходе и запасах (push и email) приходят на русском.

## VPS для Android-пилота

### 1. DNS и сервер

На Linux VPS установите Docker Engine с плагином Compose и включите автозапуск Docker.
Направьте A-запись домена API на публичный IPv4 VPS. Добавляйте AAAA только при рабочем публичном IPv6.
Откройте входящие TCP 80 и 443 и оставьте доступ к SSH для администратора. Caddy сам получит
и обновит сертификат и перенаправит HTTP на HTTPS. Проверьте на VPS исходящий доступ к реестру
образов, репозиториям Maven и центру сертификации. [Документация Caddy](https://caddyserver.com/docs/automatic-https)

### 2. Секреты и запуск

Клонируйте репозиторий на VPS и переключитесь на ревизию для пилота. Из корня репозитория:

```bash
cd infra
# Выполните один раз при создании окружения.
(
  umask 077
  set -o noclobber
  printf 'API_DOMAIN=%s\nDB_PASSWORD=%s\nJWT_SECRET=%s\n' \
    api.example.com "$(openssl rand -hex 32)" "$(openssl rand -base64 32)" > .env
)
# Замените api.example.com в .env на свой домен.
docker compose --env-file .env -f compose.vps.yml config --quiet
docker compose --env-file .env -f compose.vps.yml up -d --build --wait
docker compose --env-file .env -f compose.vps.yml ps
curl --fail https://api.example.com/api/v1/health
```

Ожидаемый ответ — `{"status":"ok"}`. При обновлении кода сначала сделайте резервную копию,
затем повторите `up -d --build --wait`. Для диагностики выполните
`docker compose --env-file .env -f compose.vps.yml logs --tail=100`.
Храните `.env` с правами 0600 и сохраните его в защищённом хранилище.
Пароль PostgreSQL задаётся при инициализации тома. Для его смены измените пароль роли в БД,
обновите `.env` и пересоздайте контейнеры.

PostgreSQL и Spring доступны внутри Compose, наружу опубликован Caddy. Тома хранят БД,
файлы приложения (включая фото и медицинские вложения) и сертификаты.
Для штатной остановки используйте `stop`. Команда `down -v` удаляет тома и данные.
Создайте пять отдельных тестовых аккаунтов через приложение. Регистрация доступна по публичному API,
а медицинские вложения открываются по прямой ссылке без входа. Используйте синтетические данные и вложения.
Для просмотра фото питомца требуется JWT владельца. Обновите клиенты вместе с backend,
поскольку старые клиенты загружают фото без заголовка Authorization.
Для APK-пилота Expo Push отключён в VPS-конфигурации. Для push в самостоятельном Android APK
понадобится отдельная настройка FCM.

### 3. Резервное копирование

Создайте закрытый каталог резервных копий и вручную проверьте первый запуск под пользователем,
у которого есть доступ к Docker. Затем добавьте команду в его `crontab -e`.

```bash
install -d -m 700 "$HOME/petcare-backups"
./backup-postgres.sh "$HOME/petcare-backups"
```

```cron
0 3 * * * /absolute/path/to/pet-care-v2/infra/backup-postgres.sh "$HOME/petcare-backups"
```

Скрипт сохраняет дамп в формате PostgreSQL custom и удаляет дампы старше 14 суток
после успешной записи нового. Сохраняйте копии вне VPS в закрытом хранилище.
Дамп содержит ссылки на вложения. Для согласованной копии БД и файлов остановите backend,
снимите дамп и архив тома `petcare-vps_uploads`, затем снова запустите backend.

Пробное восстановление выполните в отдельную пустую базу в контейнере PostgreSQL.
Команды выполняются из `infra`. Подставьте путь к выбранному дампу.

```bash
docker compose --env-file .env -f compose.vps.yml exec -T postgres \
  createdb -U petcare petcare_restore
docker compose --env-file .env -f compose.vps.yml exec -T postgres \
  pg_restore --exit-on-error -U petcare -d petcare_restore < /path/to/petcare.dump
docker compose --env-file .env -f compose.vps.yml exec -T postgres \
  psql -U petcare -d petcare_restore -c 'SELECT count(*) FROM flyway_schema_history;'
```

### 4. Android APK

После проверки HTTPS откройте `apps/mobile`. Профиль `preview` формирует APK
для установки на Android без Google Play и Metro. Выбран идентификатор `com.lsdoggy.petcare`.

```bash
npm ci
npx eas-cli login
npx eas-cli init
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL \
  --value https://api.example.com --visibility plaintext
npx eas-cli build --platform android --profile preview
```

Привяжите приложение к своему проекту Expo и используйте один и тот же ключ подписи для обновлений.
Укажите HTTPS-адрес без завершающего слеша и без `/api/v1`, который клиент добавляет сам.
Адрес встраивается в APK, поэтому после его изменения потребуется новая сборка.
В `EXPO_PUBLIC_*` передавайте только публичные значения.
Проверьте на Android через мобильную сеть вход, загрузку и открытие тестового вложения,
а после пересоздания контейнера backend повторно откройте тот же файл.
[Инструкция Expo по сборке APK](https://docs.expo.dev/build-reference/apk/)

## Sprint 3 — Care Tasks

### Модель данных (Flyway `V3__create_care_tasks_table.sql`)

Таблица `care_tasks`: `id`, `pet_id` (FK → pets), `owner_id` (FK → users, денормализация для быстрых выборок),
`title`, `type`, `due_at (TIMESTAMPTZ, UTC)`, `status`, `recurrence_rule (nullable)`, `created_at`, `updated_at`.

Индексы:
- `idx_care_tasks_upcoming (owner_id, status, due_at)` — покрывает `GET /tasks/upcoming` (фильтр + сортировка);
- `idx_care_tasks_pet (pet_id)` — выборки задач питомца.

Enum'ы:
- `type`: `VACCINATION | VET | FOOD | GROOMING | MEDICATION | WALK | OTHER`
- `status`: `PENDING | DONE`

### REST API (все эндпоинты требуют `Authorization: Bearer <JWT>`, базовый путь `/api/v1`)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/tasks` | Все задачи текущего пользователя (по due_at) |
| GET | `/tasks/upcoming` | Только `PENDING`, сортировка `due_at ASC` |
| GET | `/tasks/{id}` | Одна задача (404 для чужих/несуществующих) |
| POST | `/tasks` | Создание (`@Valid`: title 1–150, type, petId, dueAt — будущее время в UTC) |
| PATCH | `/tasks/{id}` | Частичное обновление (PATCH-семантика, null = без изменений) |
| DELETE | `/tasks/{id}` | Удаление задачи |
| POST | `/tasks/{id}/complete` | Отметка «выполнено» |

### Recurrence rule

Формат: `UNIT:N`, где `UNIT ∈ {DAILY, WEEKLY, MONTHLY, YEARLY}` (регистронезависимо), `N` — целое > 0.
Примеры: `MONTHLY:1`, `WEEKLY:2`, `DAILY:3`. Пустая строка в PATCH очищает правило.

Логика `POST /tasks/{id}/complete`:
1. Задача переходит в `DONE`.
2. Если есть `recurrence_rule` — создаётся **новая** `PENDING`-задача с тем же.pet/type/title и `due_at + интервал`
   (сдвиг выполняется в UTC; `MONTHLY/YEARLY` — календарные, поэтому через `ZonedDateTime`).
3. Ответ эндпоинта — новая recurring-задача (или завершённая, если правила нет). Повторный вызов идемпотентен.

Некорректное правило → `400 Bad Request` с JSON-описанием поля `recurrenceRule` (GlobalExceptionHandler).

### Клиенты

- **Web** (`apps/web`): на главной странице блок «Ближайшие события» (`UpcomingTasksCard`) с чекбоксами выполнения
  и формой создания задачи (`TaskFormModal`: выбор питомца, тип, дата). Даты хранятся в UTC, отображаются в локальном часовом поясе браузера.
- **Mobile** (`apps/mobile`): Tab Bar (Home / Tasks). Вкладка Tasks показывает upcoming-список;
  выполнение — кнопка ✓ (свайпы не вводили, чтобы не добавлять нативные gesture-библиотеки в этот спринт).

### Проверка

```bash
cd services/backend && ./mvnw test        # 27 tests (auth, pets, tasks CRUD/upcoming/recurrence)
cd apps/web && npx tsc --noEmit           # типы OK
cd apps/mobile && npx tsc --noEmit        # типы OK
```

curl-пример создания повторяющейся задачи:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}' | jq -r .accessToken)

curl -s -X POST http://localhost:8080/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"petId":1,"title":"Rabies vaccine","type":"VACCINATION",
       "dueAt":"2026-12-15T10:00:00Z","recurrenceRule":"MONTHLY:1"}'
```

## Sprint 4 — Veterinary Appointments & Records

### Модель данных (Flyway `V4__create_vet_tables.sql`)

- **`veterinary_appointments`**: `id`, `pet_id` (FK → pets), `owner_id` (денормализация для проверки прав),
  `clinic_name`, `doctor_name`, `scheduled_at (TIMESTAMPTZ, UTC)`, `duration_minutes (CHECK 5–480)`,
  `status (SCHEDULED | COMPLETED | CANCELLED)`, `address`, `cost (>= 0)`, `currency (ISO-4217)`, `notes`, необязательное поле `reason` (Flyway V11).
- **`veterinary_records`**: `id`, `appointment_id` (nullable FK → veterinary_appointments, связь визит→запись необязательна),
  `pet_id`, `owner_id`, `visit_date (DATE)`, `diagnosis_text`, `recommendations_text`, `prescriptions_text`,
  `attachments_jsonb JSONB DEFAULT '[]'` — список `{url, name, type, size}`.

Индексы: `idx_vet_appt_pet (pet_id, scheduled_at DESC)`, `idx_vet_rec_pet (pet_id, visit_date DESC)` — под историю питомца;
индексы по `owner_id` и `appointment_id`.

Вложения хранятся на локальной файловой системе в `./uploads/records/` (директория в .gitignore),
отдаются как статика Spring по URL `/files/records/<uuid>.<ext>` (разрешены pdf/jpg/jpeg/png/webp, максимум 10 МБ).

### REST API (базовый путь `/api/v1`, пользовательские методы требуют `Authorization: Bearer <JWT>`, входные данные валидируются через `@Valid`)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/appointments` | Мои appointments (ближайшие сверху) |
| POST | `/appointments` | Создание визита (`CreateAppointmentRequest`) |
| PATCH | `/appointments/{id}` | Частичное обновление, включая status |
| DELETE | `/appointments/{id}` | Удаление; у связанных records обнуляется `appointment_id` |
| GET | `/records` | Мои мед. записи (свежие сверху) |
| POST | `/records` | Создание записи (`appointmentId` опционально, проверяется тот же pet/owner) |
| PATCH | `/records/{id}` | Частичное обновление |
| DELETE | `/records/{id}` | Удаление записи + её файлов с диска (best-effort) |
| POST | `/records/{id}/attachments` | multipart `file` → дописывает вложение в `attachments_jsonb` |
| GET | `/pets/{petId}/history` | Объединённая хронология (визиты + записи), newest first |

Ошибки — единый JSON от GlobalExceptionHandler (`{status, error, message, details[], timestamp}`);
чужие ресурсы возвращают 404 (без утечки существования).

### Приём записи от ветклиники
[Руководство для интеграторов 1С](docs/clinic-1c-integration.md) содержит поля запроса, пример отправки и порядок сверки после ошибок.

`POST /api/v1/vetinfo` принимает JSON по HTTPS с заголовками
`Authorization: Bearer <токен клиники>` и `Content-Type: application/json`.

Для подключения оператор задаёт переменные окружения
`PETCARE_VETINFO_TOKEN` (случайный секрет длиной от 32 символов),
`PETCARE_VETINFO_PET_ID` и `PETCARE_VETINFO_CLINIC_NAME`.
Конфигурация поддерживает одну пару «клиника — питомец» на экземпляр приложения.
Для отзыва доступа оператор удаляет или меняет токен и перезапускает backend.
Токен даёт доступ только к отправке визита, а питомца и название клиники сервер
берёт из конфигурации.

```json
{
  "scheduledAt": "2026-12-10T11:30:00+03:00",
  "durationMinutes": 30,
  "doctorName": "Анна Иванова",
  "address": "ул. Лесная, 10",
  "reason": "Плановый осмотр",
  "notes": "Принести ветеринарный паспорт"
}
```

Обязательно только `scheduledAt` с часовым смещением или `Z`. Длительность по
умолчанию составляет 30 минут. При наличии цены можно передать `cost`
(неотрицательное число) и `currency` (трёхбуквенный код, например `RUB`).
Успешный ответ — HTTP 201 и JSON вида `{"appointmentId": 123}`. Визит появится
в истории со статусом `SCHEDULED`. Каждый принятый POST создаёт отдельный визит.

### Клиенты

- **Web** (`apps/web`): на странице питомца (`/pets/:id`) вкладки «Profile» / «Health History».
  Таймлайн событий (иконки визит/запись, чипы вложений со ссылками на `/files/records/...`),
  модалки `AppointmentFormModal` и `RecordFormModal` (прикрепление файла — после создания записи).
- **Mobile** (`apps/mobile`): экран питомца → «🩺 Health history» (`PetHistoryScreen`, FlatList-таймлайн,
  pull-to-refresh, удаление свайп-альтернативой — кнопкой Delete). Формы `AppointmentFormScreen` и
  `RecordFormScreen`; фото выбираются через `expo-image-picker`, PDF — через `expo-document-picker`.

### Проверка

```bash
cd services/backend && ./mvnw test        # 34 теста: auth, pets, tasks CRUD/upcoming/recurrence + VetFlowTest (CRUD, ownership 404, history merge, upload)
cd apps/web && npx tsc --noEmit           # типы OK
cd apps/mobile && npx tsc --noEmit        # типы OK
```

> **Примечание по фиксу тестов (Sprint 4).** Изначально `./mvnw test` падал с `Failed to load ApplicationContext`:
> Hibernate `ddl-auto=validate` не совмещал типы колонок V4-миграции с маппингом сущностей (`CHAR(3)` vs `VARCHAR(3)` для `currency`; `SqlTypes.JSON` vs TEXT для `attachments_jsonb`), а также Jackson 2 (`com.fasterxml.jackson`) приходил только транзитивно через `jjwt-impl (runtime)`.
> Исправлено без изменения схемы: в `VetAppointmentEntity.currency` добавлен `columnDefinition = "char(3)"`, из `VetRecordEntity.attachmentsJson` убран `@JdbcTypeCode(SqlTypes.JSON)` (сериализация — в `RecordDto`), в `pom.xml` явно добавлен GA-артефакт `com.fasterxml.jackson.core:jackson-databind` (версию контролирует BOM Boot 4.0.x). Колонка в миграции остаётся TEXT — JSON-валидность обеспечивает сервисный слой.

curl-примеры:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}' | jq -r .accessToken)

# Создать визит
curl -s -X POST http://localhost:8080/api/v1/appointments \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"petId":1,"clinicName":"CityVet","doctorName":"Dr. Who",
       "scheduledAt":"2026-11-10T09:30:00Z","durationMinutes":30,
       "cost":45.50,"currency":"USD"}'

# Создать запись, связанную с визитом
curl -s -X POST http://localhost:8080/api/v1/records \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"petId":1,"appointmentId":1,"visitDate":"2026-11-10",
       "diagnosisText":"Healthy","prescriptionsText":"None"}'

# Прикрепить PDF к записи
curl -s -X POST http://localhost:8080/api/v1/records/1/attachments \
  -H "Authorization: Bearer $TOKEN" -F "file=@blood-test.pdf"

# История питомца
curl -s http://localhost:8080/api/v1/pets/1/history -H "Authorization: Bearer $TOKEN"
```

### Ручная проверка ветеринарной истории

1. На тестовом питомце создайте визит с причиной и без стоимости. Откройте историю и проверьте дату, клинику и причину.
2. Из карточки визита добавьте медицинскую запись. На web перетащите PDF в форму. В Expo на Android и iOS проверьте выбор PDF из файлов и фото из галереи.
3. Удалите выбранный файл из формы, прикрепите его снова и сохраните запись. Откройте вложение из карточки визита.
4. Для проверки повторной отправки прервите соединение во время загрузки вложения после создания записи. Восстановите соединение, повторите сохранение и убедитесь, что в истории одна запись.

## Sprint 5 — Food Products & Shopping List

### Модель данных (Flyway `V5__create_food_shopping_tables.sql`)

**`food_products`** (запасы корма/наполнителя): `id`, `owner_id` (FK → users, денормализация как в прошлых спринтах),
`name`, `brand`, `category` (`DRY | WET | TREAT | SUPPLEMENT | LITTER`, хранится UPPERCASE с CHECK-констрейнтом),
`package_size_grams`, `daily_portion_grams`, `stock_quantity (>= 0)`, `reorder_threshold (>= 0)`,
`unit` (`PCS | KG | G`), `notes`, `created_at`, `updated_at`.

**`shopping_list_items`**: `id`, `owner_id`, `product_id` (nullable FK → food_products, `ON DELETE SET NULL` —
удаление товара из каталога не уничтожает строки списка), `custom_name`, `quantity (1..999)`, `unit`,
`is_purchased`, `purchased_at` + CHECK-констрейнт согласованности (`is_purchased ⇔ purchased_at IS NOT NULL`).

Индексы: `idx_food_products_owner (owner_id, name)`,
`idx_shopping_items_owner (owner_id, is_purchased, created_at)` (покрывает чек-лист), `idx_shopping_items_product`.

### REST API (все эндпоинты требуют `Authorization: Bearer <JWT>`, базовый путь `/api/v1`)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/food-products` | Мои запасы (по name) |
| GET | `/food-products/{id}` | Один продукт (404 для чужих/несуществующих) |
| POST | `/food-products` | Создание (`@Valid`: name 1–150, category, unit, лимиты граммов/стока) |
| PATCH | `/food-products/{id}` | Частичное обновление (в т.ч. `stockQuantity`); null = без изменений |
| DELETE | `/food-products/{id}` | Удаление; связанные позиции списка получают `product_id = NULL` |
| GET | `/shopping-list/items` | Чек-лист: открытые сверху, купленные ниже (по created_at) |
| GET | `/shopping-list/items/{id}` | Одна позиция |
| POST | `/shopping-list/items` | Два режима: **linked** (`productId` — кнопка «Add to Shopping List», дедупликация по открытым позициям) и **custom** (`customName` — быстрый ввод на mobile) |
| PATCH | `/shopping-list/items/{id}` | Частичное обновление (quantity/unit/name) |
| DELETE | `/shopping-list/items/{id}` | Удаление позиции |
| POST | `/shopping-list/items/{id}/purchase` | Отметка «Куплено» (идемпотентна) |
| GET | `/shopping-list/suggestions` | Продукты с низким стоком (`stock <= threshold`), для которых нет открытых позиций |

### Логика покупки (`ShoppingListService.purchaseItem`, `@Transactional`)

1. Валидация владельца (чужая позиция → 404).
2. Идемпотентность: повторная покупка не меняет `purchased_at`.
3. `is_purchased = true`, `purchased_at = now()`.
4. Опционально `addStockQuantity > 0` → пополнение `stock_quantity` связанного продукта **в той же транзакции**
   (две таблицы обновляются атомарно). Для custom-позиции (без `product_id`) это поле → `400 Bad Request`
   (решение №2 из плана).

### Упрощённая привязка кормления (решение №3 из плана)

При `POST /tasks/{id}/complete` для задачи типа `FOOD`: если название задачи совпадает (case-insensitive, trim)
с продуктом пользователя, сток уменьшается на `daily_portion_grams`; если остаток опустился до `reorder_threshold`
и для продукта ещё нет открытой позиции — она создаётся автоматически. Сложная эвристика намеренно не вводилась (MVP).

### Клиенты

- **Web** (`apps/web`): навигация Home / Stock («Запасы») / Shopping («Купить»).
  `StockPage` — карточки продуктов с прогресс-баром остатка (`stock / reorder target`), кнопки ±, модалка
  `ProductFormModal`, удаление и «Add to Shopping List». `ShoppingListPage` — чек-лист с чекбоксами покупки
  (+ опциональное пополнение стока linked-позиций), ручное добавление custom-товаров, баннер подсказок из `/suggestions`.
- **Mobile** (`apps/mobile`): Tab Bar Home / Tasks / Buy / Stock. `ShoppingScreen` — быстрый ввод одной строкой
  (custom mode) и чек-лист с галочкой «Куплено»; `StockScreen` — список запасов, управление количеством,
  создание/удаление продуктов.

### Проверка

```bash
cd services/backend && ./mvnw test        # 44 теста: предыдущие спринты + FoodShoppingFlowTest (CRUD, purchase+restock atomicity, 400 для custom restock, dedup, suggestions, FOOD-task linkage, ownership isolation)
cd apps/web && npx tsc --noEmit && npm run build   # типы OK, сборка OK
cd apps/mobile && npx tsc --noEmit        # типы OK
```

curl-примеры:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}' | jq -r .accessToken)

# Создать продукт (запас)
curl -s -X POST http://localhost:8080/api/v1/food-products \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Royal Canin Adult","brand":"Royal Canin","category":"DRY",
       "packageSizeGrams":4000,"dailyPortionGrams":200,
       "stockQuantity":2,"reorderThreshold":1,"unit":"PCS"}'

# Добавить в список покупок (linked mode, идемпотентно)
curl -s -X POST http://localhost:8080/api/v1/shopping-list/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"productId":1}'

# Купить + пополнить сток (одна транзакция)
curl -s -X POST http://localhost:8080/api/v1/shopping-list/items/1/purchase \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"addStockQuantity":1}'

# Быстрый custom-товар
curl -s -X POST http://localhost:8080/api/v1/shopping-list/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"customName":"Домашний корм","quantity":1,"unit":"KG"}'

# Подсказки низкого стока
curl -s http://localhost:8080/api/v1/shopping-list/suggestions -H "Authorization: Bearer $TOKEN"
```

## Database-specific Flyway migrations

Shared migrations are loaded from `db/migration`; database-specific variants are
loaded from `db/vendor/{vendor}` (`postgresql` for local development, `h2` for tests).
V10 has separate variants because H2 requires one `ADD COLUMN` per statement.
The PostgreSQL V10 contents are unchanged, so existing database checksums remain valid.
Run backend checks with `cd services/backend && ./mvnw clean test`;
Flyway stays enabled and Hibernate validates the migrated test schema.

### Напоминания о задачах ухода

В профиле web и mobile можно отдельно включить напоминания за день, за час
и о просроченных задачах. Напоминания за час включены по умолчанию, остальные
нужно включить в профиле. Планировщик отправляет каждое напоминание один раз
на срок задачи. После переноса срока напоминания планируются заново.

Уведомления о низком остатке корма включаются отдельно. Они отправляются через
включённые каналы, когда остаток впервые достигает порога закупки после
ручного изменения или списания при кормлении.

### Деактивация и восстановление аккаунта

Укажите HTTPS-адрес веб-страницы восстановления в `APP_ACCOUNT_RECOVERY_PAGE`
(например, `https://petcare.example/restore-account`) и настройте SMTP.
Деактивация сохраняет данные, завершает текущие сессии и приостанавливает
уведомления. Если отправить письмо не удалось, аккаунт остаётся активным.
Для восстановления откройте одноразовую ссылку из письма и подтвердите
действие на веб-странице, затем войдите с прежним паролем.
