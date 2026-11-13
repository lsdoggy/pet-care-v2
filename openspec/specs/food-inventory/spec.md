# Food Inventory Specification

## Purpose

Зафиксировать baseline фактически реализованного backend-каталога запасов pet-care-v2: персональные продукты, целочисленный остаток, порог пополнения и упрощённую связь с завершением кормления. Контракт основан на контроллере, сервисе, DTO, сущности, миграции V5 и интеграционных тестах FoodShoppingFlowTest; не предполагает полноценный складской учёт, конвертацию единиц или отдельный API расходования.

Источники реализации: [FoodProductController](../../../services/backend/src/main/java/com/petcare/backend/food/FoodProductController.java), [FoodProductService](../../../services/backend/src/main/java/com/petcare/backend/food/FoodProductService.java), [CreateFoodProductRequest](../../../services/backend/src/main/java/com/petcare/backend/food/dto/CreateFoodProductRequest.java), [UpdateFoodProductRequest](../../../services/backend/src/main/java/com/petcare/backend/food/dto/UpdateFoodProductRequest.java), [CareTaskService](../../../services/backend/src/main/java/com/petcare/backend/task/CareTaskService.java), [миграция V5](../../../services/backend/src/main/resources/db/migration/V5__create_food_shopping_tables.sql), [FoodShoppingFlowTest](../../../services/backend/src/test/java/com/petcare/backend/FoodShoppingFlowTest.java).

## Requirements

### Requirement: Персональный каталог и ownership

Backend SHALL предоставлять аутентифицированному пользователю операции GET/POST `/api/v1/food-products` и GET/PATCH/DELETE `/api/v1/food-products/{id}`, определяя владельца по текущему пользователю, а не по полю запроса.

#### Scenario: Получение своих запасов
- **WHEN** пользователь запрашивает список продуктов
- **THEN** возвращаются только его продукты, упорядоченные по имени по возрастанию; DTO содержит id, name, brand, category, packageSizeGrams, dailyPortionGrams, stockQuantity, reorderThreshold, unit, notes, lowStock, createdAt и updatedAt.

#### Scenario: Чужой или отсутствующий продукт
- **WHEN** пользователь читает, изменяет или удаляет id, не принадлежащий ему либо отсутствующий
- **THEN** поиск по id и ownerId возвращает ошибку 404, не предоставляя доступ к чужой записи.

#### Scenario: Отсутствие аутентификации
- **WHEN** запрос к каталогу не аутентифицирован
- **THEN** security layer возвращает 401.

### Requirement: Создание и ограничения полей

Backend SHALL проверять создание DTO-валидацией: обязательные name длиной 1–150, category из DRY/WET/TREAT/SUPPLEMENT/LITTER и unit из PCS/KG/G; необязательные brand до 150 символов, notes до 2000, packageSizeGrams 1–1000000, dailyPortionGrams 0–100000, stockQuantity и reorderThreshold 0–1000000.

#### Scenario: Создание продукта
- **WHEN** переданы допустимые обязательные поля без остатка и порога
- **THEN** POST возвращает 201, владелец берётся из аутентификации, stockQuantity и reorderThreshold равны 0, имя обрезается по краям, пустые brand и notes сохраняются как null.

#### Scenario: Некорректные числовые поля
- **WHEN** передан отрицательный stockQuantity либо значение вне границ DTO
- **THEN** backend отклоняет запрос с 400 и ошибками валидации, не создавая продукт.

#### Scenario: Пробельное имя при создании
- **WHEN** name состоит только из пробелов и его исходная длина находится в диапазоне 1–150
- **THEN** DTO не отклоняет его как blank: сервис выполняет trim и может сохранить пустое имя; проверка NotBlank в этой реализации отсутствует.

### Requirement: Частичное изменение и расчёт lowStock

Backend SHALL трактовать null-поля PATCH как сохранение текущего значения и вычислять lowStock как `stockQuantity <= reorderThreshold` без дополнительных прогнозов расхода.

#### Scenario: Изменение остатка до порога
- **WHEN** PATCH устанавливает stockQuantity равным reorderThreshold либо ниже него
- **THEN** ответ 200 содержит lowStock=true; само изменение продукта не создаёт строку списка покупок автоматически.

#### Scenario: Частичное изменение текстов
- **WHEN** PATCH содержит пустой brand или notes и не содержит других полей
- **THEN** соответствующий текст очищается в null, остальные значения сохраняются; пустое либо пробельное name сервис не применяет, но пустая строка name нарушает минимальную длину DTO.

#### Scenario: Невозможность очистить размер упаковки через null
- **WHEN** PATCH передаёт packageSizeGrams или dailyPortionGrams как null
- **THEN** прежнее числовое значение сохраняется, а не очищается.

### Requirement: Целочисленный stock и consume при завершении кормления

Backend SHALL расходовать запас при первом завершении задачи типа FOOD через `/api/v1/tasks/{id}/complete`, если её title после trim точно совпадает с именем продукта того же владельца без учёта регистра. Это связь по имени, а не по petId или явному productId.

#### Scenario: Найден продукт с порцией
- **WHEN** завершается FOOD-задача с совпадающим именем, у первого найденного продукта dailyPortionGrams положителен
- **THEN** его stockQuantity уменьшается на это целое число с ограничением снизу 0; завершение задачи и изменение остатка выполняются в одной сервисной транзакции.

#### Scenario: Нет совпадения или другой тип задачи
- **WHEN** завершается задача не FOOD либо совпадающий продукт владельца отсутствует
- **THEN** завершение не меняет запасы.

#### Scenario: Отсутствующая порция и неоднозначное имя
- **WHEN** существует несколько продуктов владельца с одинаковым именем либо у найденного продукта порция равна null или 0
- **THEN** используется только первый найденный продукт без гарантированного выбора между дублями; при null/0 расход не производится, но проверка низкого остатка всё равно выполняется.

#### Scenario: Повторное завершение
- **WHEN** `/complete` вызывается для уже DONE-задачи
- **THEN** запас повторно не списывается; прямой PATCH статуса задачи не выполняет consume-логику `/complete`.

#### Scenario: Единицы не конвертируются
- **WHEN** unit продукта равен KG или PCS, а dailyPortionGrams положителен
- **THEN** реализация вычитает dailyPortionGrams непосредственно из stockQuantity как целое число, без пересчёта граммов в килограммы, штуки или упаковки; packageSizeGrams не участвует в расчёте.

### Requirement: Низкий остаток и предложения пополнения

Backend SHALL предоставлять GET `/api/v1/shopping-list/suggestions` и отличать предложения после CRUD продукта от автодобавления при завершении FOOD-задачи.

#### Scenario: Предложение без открытой покупки
- **WHEN** продукт владельца имеет lowStock=true и для его productId нет открытой строки списка покупок
- **THEN** он включается в suggestions, отсортированные по имени; купленная строка не исключает его из предложений, а custom-строка с таким же именем сама по себе не считается связанной открытой строкой.

#### Scenario: Автодобавление после кормления
- **WHEN** после обработки FOOD-задачи остаток низкий и отсутствуют как открытая строка с этим productId, так и открытая строка владельца с совпадающим без учёта регистра именем
- **THEN** создаётся открытая связанная покупка с quantity=1 и unit продукта.

#### Scenario: Защита от последовательного дублирования
- **WHEN** последующая FOOD-задача приводит к низкому остатку, но открытая связанная либо одноимённая строка уже существует
- **THEN** новая строка не создаётся; это сервисная проверка, а не уникальное ограничение базы для конкурентных запросов.

### Requirement: Удаление продукта без удаления покупок

Backend SHALL при DELETE продукта обнулять ссылки productId во всех его строках списка покупок и удалять сам продукт, сохраняя открытые строки и историю покупок.

#### Scenario: Удаление связанного продукта
- **WHEN** владелец удаляет продукт, на который ссылаются покупки
- **THEN** ответ равен 204, строки покупок сохраняют имя, количество, единицу и состояние, но становятся несвязанными; последующий GET продукта возвращает 404.
