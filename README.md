# pet-care-v2
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
