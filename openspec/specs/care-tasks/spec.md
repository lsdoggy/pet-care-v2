# Care Tasks Specification

## Purpose

Зафиксировать реализованный API задач ухода, включая владение, различия POST и PATCH, повторение и связь выполнения кормления с запасами.

## Requirements

### Requirement: Изолированный список и доступ к задачам

Система SHALL требовать JWT для `/api/v1/tasks`, возвращать только задачи текущего ownerId в `GET /api/v1/tasks` по dueAt по возрастанию и предоставлять чтение по `GET /api/v1/tasks/{id}`.

#### Scenario: Список ближайших задач
- **WHEN** вызывается `GET /api/v1/tasks/upcoming`
- **THEN** возвращаются все собственные PENDING-задачи по dueAt по возрастанию, включая просроченные; дополнительного фильтра dueAt >= now нет.

#### Scenario: Чужая или отсутствующая задача
- **WHEN** выполняется GET, PATCH, DELETE либо complete для чужого или отсутствующего id
- **THEN** возвращается HTTP 404 с полями status, error, message, details и timestamp; без действительного JWT возвращается HTTP 401.

#### Scenario: Задача удаленного питомца
- **WHEN** профиль связанного питомца мягко удален
- **THEN** задача остается доступной владельцу: проверка задачи использует ее ownerId, а не активность питомца; одиночный ответ использует petName `Unknown pet`, тогда как списки могут сохранять имя из строки питомца.

### Requirement: Создание задачи

Система SHALL создавать задачу через `POST /api/v1/tasks` с HTTP 201 и статусом PENDING только для существующего неудаленного питомца текущего владельца.

#### Scenario: Допустимые поля
- **WHEN** переданы petId, title длиной 1–150, type из VACCINATION, VET, FOOD, GROOMING, MEDICATION, WALK, OTHER и dueAt строго в будущем
- **THEN** создается задача с ownerId текущего пользователя, title после trim, моментом dueAt и необязательным recurrenceRule; ответ включает идентификаторы, petName, title, type, dueAt, status, recurrenceRule и временные метки.

#### Scenario: Ошибка создания
- **WHEN** обязательное поле отсутствует, title пуст или длиннее 150, dueAt не в будущем либо recurrenceRule не соответствует формату API
- **THEN** возвращается HTTP 400 с message `Validation failed` и details по полям; чужой, удаленный или отсутствующий petId дает HTTP 404.

#### Scenario: Пробельный title
- **WHEN** title состоит только из пробелов и проходит предел длины
- **THEN** POST сохраняет пустой title после trim, поскольку NotBlank не применяется.

### Requirement: PATCH и удаление задачи

Система SHALL предоставлять `PATCH /api/v1/tasks/{id}` с HTTP 200, сохраняя поля при отсутствии или null; изменяемые поля SHALL ограничиваться title, type, dueAt, status и recurrenceRule, без смены petId.

#### Scenario: Обновление срока и статуса
- **WHEN** PATCH задает dueAt в прошлом или status PENDING либо DONE
- **THEN** обновление допускается: Future-валидация срока применяется только при POST, а изменение status через PATCH не создает повтор и не списывает корм.

#### Scenario: Пустое или пробельное название
- **WHEN** PATCH содержит title `""` либо непустую пробельную строку допустимой длины
- **THEN** пустая строка отклоняется HTTP 400, пробельная строка оставляет название прежним, а другое допустимое название сохраняется после trim.

#### Scenario: Удаление
- **WHEN** владелец вызывает `DELETE /api/v1/tasks/{id}`
- **THEN** задача физически удаляется с HTTP 204, а последующий доступ возвращает HTTP 404.

### Requirement: Формат повторения

Система SHALL принимать в HTTP POST и PATCH null, пустую строку либо recurrenceRule вида `UNIT:N`, где UNIT — DAILY, WEEKLY, MONTHLY или YEARLY без учета регистра, а N — 1–9999 без ведущих нулей; длина поля ограничена 50 символами.

#### Scenario: Нормализация и очистка
- **WHEN** передано `monthly:1` или пустая строка
- **THEN** сохраняется соответственно `MONTHLY:1` или null; PATCH с null оставляет правило прежним.

#### Scenario: Пробелы и некорректное правило
- **WHEN** HTTP-запрос содержит пробельную строку, внешние пробелы вокруг правила, N=0, отрицательный N, ведущий ноль или неизвестную единицу
- **THEN** Bean Validation возвращает HTTP 400 с ошибкой recurrenceRule, даже хотя внутренние функции нормализации и расчета умеют trim.

### Requirement: Завершение и создание следующего повторения

Система SHALL обрабатывать `POST /api/v1/tasks/{id}/complete` транзакционно, переводить еще не завершенную задачу в DONE и при наличии правила создавать ровно одну следующую PENDING-задачу в рамках этого последовательного вызова.

#### Scenario: Задача с повторением
- **WHEN** завершается PENDING-задача с правилом
- **THEN** возвращается HTTP 200 с новой задачей с другим id и прежними petId, ownerId, title, type и recurrenceRule; dueAt вычисляется от исходного dueAt, а не времени завершения, прибавлением N дней, недель, календарных месяцев или лет в UTC.

#### Scenario: Без повторения и повторный вызов
- **WHEN** завершается задача без правила либо complete повторяется для уже DONE-задачи
- **THEN** возвращается сама DONE-задача; повторный последовательный вызов не создает новую задачу и не повторяет списание корма. Повторный вызов исходного recurring-id возвращает исходную DONE-задачу, а не ранее созданный повтор.

### Requirement: Выполнение кормления

Система SHALL при первом complete задачи FOOD искать продукт того же владельца с точным совпадением названия без учета регистра после trim и использовать первый найденный продукт.

#### Scenario: Найден продукт
- **WHEN** продукт имеет положительный dailyPortionGrams
- **THEN** stockQuantity уменьшается на это числовое значение с нижним пределом ноль без конвертации единиц; если остаток <= reorderThreshold и нет открытой позиции ни для этого продукта, ни с тем же именем, создается открытая связанная покупка количеством 1.

#### Scenario: Нет продукта или порции
- **WHEN** совпадений нет, тип задачи не FOOD или dailyPortionGrams отсутствует либо равен нулю
- **THEN** списание не выполняется; для найденного продукта проверка низкого остатка и автодобавление покупки выполняются даже без положительной порции.

## Implementation references

- [CareTaskController](../../../services/backend/src/main/java/com/petcare/backend/task/CareTaskController.java), [CareTaskService](../../../services/backend/src/main/java/com/petcare/backend/task/CareTaskService.java), [CareTaskEntity](../../../services/backend/src/main/java/com/petcare/backend/task/CareTaskEntity.java).
- [CreateTaskRequest](../../../services/backend/src/main/java/com/petcare/backend/task/dto/CreateTaskRequest.java), [UpdateTaskRequest](../../../services/backend/src/main/java/com/petcare/backend/task/dto/UpdateTaskRequest.java), [CareTaskDto](../../../services/backend/src/main/java/com/petcare/backend/task/dto/CareTaskDto.java).
- [CareTaskFlowTest](../../../services/backend/src/test/java/com/petcare/backend/CareTaskFlowTest.java), [CareTaskRecurrenceTest](../../../services/backend/src/test/java/com/petcare/backend/task/CareTaskRecurrenceTest.java), [FoodShoppingFlowTest](../../../services/backend/src/test/java/com/petcare/backend/FoodShoppingFlowTest.java).
