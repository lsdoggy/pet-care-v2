# API Platform Specification

## Purpose

Описать общие фактические контракты HTTP API, проверки доступности и выдачи файлов. Этот baseline не утверждает production-готовность конфигурации или закрытость файлов по ссылке.

## Requirements

### Requirement: Проверка доступности
Backend SHALL предоставлять публичный `GET /api/v1/health`, возвращающий JSON `{"status":"ok"}`. Эта проверка SHALL быть статическим ответом контроллера, а не проверкой состояния базы или внешних провайдеров.

#### Scenario: Запрос без токена
- **WHEN** клиент вызывает `/api/v1/health` без Authorization
- **THEN** возвращается успешный ответ со `status=ok`.

### Requirement: Stateless-защита API
Backend SHALL использовать stateless security без серверной HTTP-сессии и с отключённым CSRF. `/api/v1/auth/**` и health SHALL быть публичными; остальные запросы, кроме разрешённых статических файлов, SHALL требовать аутентификацию. Security entry point SHALL отвечать 401 при отсутствии аутентификации, не гарантируя JSON-формат advice для этого ответа.

#### Scenario: Защищённый запрос без сессии
- **WHEN** неаутентифицированный клиент запрашивает защищённый ресурс
- **THEN** Spring Security отклоняет запрос с 401.

### Requirement: Публичные загруженные файлы
Backend SHALL отдавать файлы из настроенного `app.upload.dir` (по умолчанию `uploads`) через `/files/uploads/**`, а из его подкаталога `records` — через `/files/records/**`. Эти URL SHALL быть доступны без JWT; проверка владельца при загрузке или привязке не превращает скачивание по URL в приватный ресурс.

#### Scenario: Доступ к известному URL вложения
- **WHEN** клиент без JWT запрашивает существующий файл через разрешённый статический URL
- **THEN** аутентификация не требуется для его получения.

### Requirement: Локальные CORS origins
Текущая конфигурация SHALL разрешать CORS для `http://localhost:5173` и `http://localhost:8081` на `/api/**` и `/files/**`, с методами GET, POST, PATCH, DELETE, OPTIONS и заголовками Authorization, Content-Type.

#### Scenario: Разрешённый origin
- **WHEN** браузер выполняет допустимый CORS-запрос из `http://localhost:5173`
- **THEN** применяется указанная CORS-конфигурация API/файлов.

### Requirement: Обрабатываемые ошибки API
Для исключений, явно перечисленных в GlobalExceptionHandler, backend SHALL возвращать поля `status`, `error`, `message`, `details`, `timestamp`; `details` SHALL содержать пары `field/message`, когда они предусмотрены обработчиком. Bean validation SHALL возвращать 400; конфликт email — 409; ошибки отсутствующего/чужого доменного ресурса с соответствующим обработчиком — 404. Это SHALL NOT трактоваться как гарантия одинакового JSON для всех framework/security ошибок.

#### Scenario: Ошибка Bean Validation
- **WHEN** DTO с `@Valid` не проходит ограничения полей
- **THEN** ответ 400 содержит `message=Validation failed` и список ошибок полей.

#### Scenario: Скрытие чужого доменного ресурса
- **WHEN** доменный сервис выбрасывает AccessDeniedForResourceException
- **THEN** возвращается 404, а не 403, без подтверждения существования чужого ресурса.

## Implementation references

- [Health](../../../services/backend/src/main/java/com/petcare/backend/HealthController.java)
- [Security и CORS](../../../services/backend/src/main/java/com/petcare/backend/config/SecurityConfig.java)
- [Статические файлы](../../../services/backend/src/main/java/com/petcare/backend/config/WebConfig.java)
- [Обработчики ошибок](../../../services/backend/src/main/java/com/petcare/backend/error/GlobalExceptionHandler.java)
