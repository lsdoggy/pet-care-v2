# Authentication Specification

## Purpose

Зафиксировать текущие серверные контракты регистрации, входа и доступа по JWT в pet-care-v2, включая фактические ограничения валидации и формат ошибок.

## Requirements

### Requirement: Регистрация пользователя

Система SHALL предоставлять публичный `POST /api/v1/auth/register`, сохранять пароль в виде BCrypt-хеша и при успехе возвращать HTTP 201 с `accessToken`, `tokenType: Bearer` и `user`.

#### Scenario: Регистрация с необязательным профилем
- **WHEN** переданы допустимые email, password и необязательные firstName и phone
- **THEN** email сохраняется после trim и приведения к нижнему регистру; firstName обрезается по краям, а отсутствующее или пробельное имя становится null; из phone удаляются пробелы, скобки и дефисы.
- **THEN** ответ user содержит id, email, firstName, phone, pushNotificationsEnabled, emailNotificationsEnabled и createdAt, но не пароль или его хеш.

#### Scenario: Повторный email
- **WHEN** регистрируется email, уже существующий без учета регистра
- **THEN** система возвращает HTTP 409 с полями status, error, message, details и timestamp.

### Requirement: Серверная валидация учетных данных

Система SHALL валидировать регистрационный email как непустой email длиной не более 255 символов, password как непробельную строку длиной 8–72, firstName длиной не более 80 и необязательный phone по шаблону `^\+?[0-9 \-()]{6,20}$` с пределом 20 символов.

#### Scenario: Ошибка Bean Validation
- **WHEN** регистрационное поле нарушает указанные ограничения
- **THEN** возвращается HTTP 400, message `Validation failed` и массив details с field и message; ограничения применяются до нормализации полей.

#### Scenario: Отсутствие дополнительных правил сложности
- **WHEN** пароль регистрации состоит из 8–72 непробельных символов, но не содержит специальных символов, цифр или разных регистров
- **THEN** серверная валидация не отклоняет его из-за отсутствия таких классов символов.

### Requirement: Вход и единая ошибка неверных учетных данных

Система SHALL предоставлять публичный `POST /api/v1/auth/login`, проверять email без учета регистра после trim и пароль через BCrypt и возвращать HTTP 200 с тем же форматом AuthResponse, что при регистрации.

#### Scenario: Неизвестный email или неверный пароль
- **WHEN** email не найден либо пароль не совпадает
- **THEN** возвращается HTTP 401 с message `Invalid email or password` и пустым details без различения этих причин.

#### Scenario: Валидация запроса входа
- **WHEN** email отсутствует, пуст, не является email или длиннее 255 символов либо password отсутствует или состоит только из пробельных символов
- **THEN** возвращается HTTP 400 с ошибками полей; ограничение длины 8–72 для входа не применяется.

### Requirement: Stateless-доступ по JWT

Система SHALL выпускать подписанный JWT с subject=email, claim uid, issuedAt и expiration; срок жизни определяется app.jwt.expiration и в текущей конфигурации равен 15 минутам. Защищенные запросы MUST использовать заголовок `Authorization: Bearer <token>` с указанным регистром префикса.

#### Scenario: Доступ к текущему пользователю
- **WHEN** действительный токен передан в `GET /api/v1/users/me`
- **THEN** возвращается HTTP 200 с профилем пользователя, найденного по email из subject, без парольного хеша.

#### Scenario: Отсутствующий, испорченный или просроченный токен
- **WHEN** защищенный маршрут вызывается без действительной аутентификации
- **THEN** возвращается HTTP 401; фильтр JWT очищает контекст при ошибке разбора, а единый JSON ApiError для этого ответа фильтра не гарантируется.

#### Scenario: Публичные маршруты
- **WHEN** запрашивается `/api/v1/auth/**`, `/api/v1/health`, `/files/uploads/**` или `/files/records/**`
- **THEN** JWT не требуется, в том числе для скачивания существующего файла по известному URL.

### Requirement: Редактирование профиля аккаунта

Backend SHALL предоставлять авторизованный PATCH `/api/v1/users/me` для изменения необязательных `firstName` и `phone` текущего пользователя и возвращать обновлённый UserDto.

#### Scenario: Очистка и сохранение полей профиля
- **WHEN** клиент отправляет пустую строку либо опускает одно из полей
- **THEN** пустое значение очищает поле, а отсутствие поля или явный null сохраняет предыдущее значение. При сохранении имени убираются внешние пробелы, а из телефона удаляются пробелы, скобки и дефисы.

### Requirement: Деактивация и восстановление аккаунта

Backend SHALL предоставлять авторизованный POST `/api/v1/users/me/deactivate` и публичный POST `/api/v1/auth/restore-account`. При деактивации данные аккаунта SHALL сохраняться.

#### Scenario: Деактивация с письмом восстановления
- **WHEN** настроен HTTPS-адрес восстановления и отправка письма успешна
- **THEN** деактивация возвращает 204, ранее выданные JWT перестают давать доступ, а вход отклоняется как неверные учётные данные.

#### Scenario: Ссылка восстановления недоступна
- **WHEN** адрес отсутствует или некорректен либо отправитель возвращает ошибку доставки
- **THEN** API возвращает 503 и аккаунт остаётся активным.

#### Scenario: Восстановление по одноразовому токену
- **WHEN** клиент передаёт действующий токен восстановления в JSON-поле `token`
- **THEN** API возвращает 204 и разрешает новый вход. Повторный либо недействительный токен возвращает 400, а старые JWT остаются недействительными.

## Implementation references

- [AuthController](../../../services/backend/src/main/java/com/petcare/backend/auth/AuthController.java), [UserController](../../../services/backend/src/main/java/com/petcare/backend/user/UserController.java), [UserService](../../../services/backend/src/main/java/com/petcare/backend/user/UserService.java).
- [RegisterRequest](../../../services/backend/src/main/java/com/petcare/backend/user/dto/RegisterRequest.java), [LoginRequest](../../../services/backend/src/main/java/com/petcare/backend/user/dto/LoginRequest.java), [AuthResponse](../../../services/backend/src/main/java/com/petcare/backend/user/dto/AuthResponse.java), [UserDto](../../../services/backend/src/main/java/com/petcare/backend/user/dto/UserDto.java).
- [SecurityConfig](../../../services/backend/src/main/java/com/petcare/backend/config/SecurityConfig.java), [JwtAuthFilter](../../../services/backend/src/main/java/com/petcare/backend/security/JwtAuthFilter.java), [JwtService](../../../services/backend/src/main/java/com/petcare/backend/security/JwtService.java), [GlobalExceptionHandler](../../../services/backend/src/main/java/com/petcare/backend/error/GlobalExceptionHandler.java).
- [AuthFlowTest](../../../services/backend/src/test/java/com/petcare/backend/AuthFlowTest.java), [application.properties](../../../services/backend/src/main/resources/application.properties).
