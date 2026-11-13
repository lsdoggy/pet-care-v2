# Shopping List Specification

## Purpose

Зафиксировать baseline фактического backend списка покупок pet-care-v2: персональный чек-лист, связанные и произвольные позиции, последовательную дедупликацию, подтверждение покупки и явное пополнение запаса. Основание: контроллер, сервис, DTO, миграция V5 и интеграционные тесты FoodShoppingFlowTest. Прогнозирование расхода, автоматическая конвертация единиц и конкурентная exactly-once обработка не реализованы.

Источники реализации: [ShoppingListController](../../../services/backend/src/main/java/com/petcare/backend/shopping/ShoppingListController.java), [ShoppingListService](../../../services/backend/src/main/java/com/petcare/backend/shopping/ShoppingListService.java), [CreateShoppingItemRequest](../../../services/backend/src/main/java/com/petcare/backend/shopping/dto/CreateShoppingItemRequest.java), [PurchaseItemRequest](../../../services/backend/src/main/java/com/petcare/backend/shopping/dto/PurchaseItemRequest.java), [FoodProductService](../../../services/backend/src/main/java/com/petcare/backend/food/FoodProductService.java), [миграция V5](../../../services/backend/src/main/resources/db/migration/V5__create_food_shopping_tables.sql), [FoodShoppingFlowTest](../../../services/backend/src/test/java/com/petcare/backend/FoodShoppingFlowTest.java).

## Requirements

### Requirement: Ownership и операции чек-листа

Backend SHALL предоставлять аутентифицированному пользователю GET/POST `/api/v1/shopping-list/items` и GET/PATCH/DELETE `/api/v1/shopping-list/items/{id}` только для его строк, определяя ownerId из аутентификации.

#### Scenario: Список покупок владельца
- **WHEN** пользователь запрашивает список
- **THEN** возвращаются только его строки: сначала открытые, затем купленные, внутри групп по createdAt по возрастанию; DTO содержит id, productId, customName, quantity, unit, isPurchased, purchasedAt, createdAt и updatedAt.

#### Scenario: Доступ к чужой строке
- **WHEN** пользователь запрашивает, изменяет, удаляет или покупает чужую либо отсутствующую строку
- **THEN** поиск по id и ownerId возвращает 404 без изменения данных.

#### Scenario: Запрос без аутентификации
- **WHEN** неаутентифицированный клиент обращается к API списка покупок
- **THEN** security layer возвращает 401.

### Requirement: Два режима создания

Backend SHALL создавать связанную позицию при ненулевом productId и произвольную позицию при отсутствии productId и наличии непустого customName; количество по умолчанию равно 1.

#### Scenario: Связанная позиция
- **WHEN** POST содержит productId собственного продукта и открытого дубля нет
- **THEN** ответ 201 содержит productId, обрезанное имя продукта как customName, quantity из запроса либо 1 и unit из запроса либо продукта; переданный customName не заменяет имя продукта.

#### Scenario: Чужой продукт
- **WHEN** productId относится к продукту другого пользователя либо отсутствует
- **THEN** запрос возвращает 404 и не создаёт позицию.

#### Scenario: Произвольная позиция
- **WHEN** productId не передан, а customName непустой
- **THEN** создаётся несвязанная открытая строка с trim имени и unit из запроса либо PCS; одинаковые customName не дедуплицируются.

#### Scenario: Недопустимые поля
- **WHEN** отсутствуют оба способа задания позиции, customName в произвольном режиме blank, quantity вне 1–999 либо customName нарушает длину 1–150
- **THEN** backend возвращает 400; допустимые единицы — PCS, KG и G.

### Requirement: Дедупликация связанных открытых покупок

Backend SHALL при последовательном повторном создании связанной позиции возвращать уже существующую открытую строку того же владельца и productId, не увеличивая количество и не меняя её поля.

#### Scenario: Повторное добавление продукта
- **WHEN** POST повторяется с productId, для которого уже имеется открытая строка, даже с другим quantity или unit
- **THEN** возвращаются существующие id и поля, HTTP-статус остаётся 201.

#### Scenario: Только купленные позиции
- **WHEN** для продукта есть только ранее купленные строки
- **THEN** новый POST создаёт новую открытую строку, сохраняя историю.

#### Scenario: Конкурентные добавления
- **WHEN** несколько запросов одновременно проходят проверку отсутствия открытой строки
- **THEN** baseline не гарантирует отсутствие дублей: миграция V5 не содержит уникального ограничения на открытую пару ownerId/productId, а сервис не применяет блокировку этой проверки.

### Requirement: Частичное редактирование и удаление

Backend SHALL через PATCH менять только customName, quantity и unit, оставляя null-поля неизменными; productId и состояние покупки через этот DTO не редактируются.

#### Scenario: Изменение открытой или купленной строки
- **WHEN** владелец передаёт допустимые поля PATCH
- **THEN** ответ 200 отражает изменения, непереданные поля сохраняются; сервис допускает редактирование и купленной строки, пробельное customName игнорируется.

#### Scenario: Удаление строки
- **WHEN** владелец удаляет собственную открытую или купленную строку
- **THEN** ответ равен 204, строка удаляется без обратного изменения остатка продукта.

### Requirement: Purchase и атомарное пополнение stock

Backend SHALL обрабатывать POST `/api/v1/shopping-list/items/{id}/purchase` одной сервисной транзакцией: впервые выставлять isPurchased=true и purchasedAt, а запас связанного продукта увеличивать только при явном addStockQuantity.

#### Scenario: Покупка с пополнением
- **WHEN** открытая связанная позиция покупается с addStockQuantity в диапазоне 1–1000000
- **THEN** ответ 200 содержит купленную строку с purchasedAt, а stockQuantity продукта увеличивается ровно на addStockQuantity; quantity покупки, её unit и packageSizeGrams продукта не участвуют в пересчёте.

#### Scenario: Покупка без тела
- **WHEN** позиция покупается без тела запроса либо без addStockQuantity
- **THEN** она отмечается купленной без изменения stock; это разрешено и для произвольной позиции.

#### Scenario: Пополнение несвязанной позиции
- **WHEN** для позиции без productId передан положительный addStockQuantity
- **THEN** запрос возвращает 400, позиция остаётся открытой, остатки не меняются; это условие проверяется и при повторном запросе к уже купленной несвязанной позиции.

#### Scenario: Валидация пополнения
- **WHEN** addStockQuantity равен 0, отрицателен или превышает 1000000
- **THEN** DTO-валидация отклоняет запрос с 400.

#### Scenario: Последовательная повторная покупка
- **WHEN** уже купленная связанная позиция повторно отправляется в purchase
- **THEN** исходный purchasedAt сохраняется и stock повторно не увеличивается; это не гарантия конкурентной идемпотентности при одновременных транзакциях.

#### Scenario: Отказ до подтверждения
- **WHEN** сервис не может загрузить связанный продукт владельца перед выставлением флага покупки
- **THEN** выбрасывается ошибка, и транзакция не фиксирует ни подтверждение покупки, ни пополнение.

### Requirement: Связь с каталогом и низким остатком

Backend SHALL выдавать GET `/api/v1/shopping-list/suggestions` как выборку низкоостаточных продуктов владельца без открытой связанной покупки и сохранять строки при удалении продукта.

#### Scenario: Добавление из предложения
- **WHEN** у продукта stockQuantity <= reorderThreshold и нет открытой строки с его productId
- **THEN** продукт присутствует в suggestions; создание связанной открытой строки убирает его из предложений, но чтение suggestions само по себе ничего не создаёт.

#### Scenario: Автодобавление из кормления
- **WHEN** завершение FOOD-задачи по точному безрегистровому совпадению имени приводит к низкому остатку, а открытая связанная либо одноимённая строка владельца отсутствует
- **THEN** создаётся связанная открытая строка с quantity=1 и unit продукта; эта проверка имени шире дедупликации ручного POST по productId.

#### Scenario: Удаление продукта
- **WHEN** продукт удаляется из каталога
- **THEN** у всех ссылающихся строк productId становится null, а customName и история покупки сохраняются; последующее пополнение stock через такую строку невозможно.
