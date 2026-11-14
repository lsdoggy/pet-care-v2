# Veterinary Care Specification

## Purpose

Описать baseline ветеринарных визитов, медицинских записей, объединенной истории и локальных вложений по текущим серверным контрактам.

## Requirements

### Requirement: Владение и аутентификация

Система SHALL требовать JWT для `/api/v1/appointments`, `/api/v1/records` и `/api/v1/pets/{petId}/history`, проверять владельца одиночных визитов и записей по их ownerId и создавать их только для собственного неудаленного питомца.

#### Scenario: Чужой или отсутствующий ресурс
- **WHEN** выполняется чтение, изменение, удаление либо загрузка вложения для чужого или отсутствующего ресурса
- **THEN** возвращается HTTP 404 с status, error, message, details и timestamp вместо 403; запрос без действительной аутентификации получает HTTP 401.

#### Scenario: Мягко удаленный питомец
- **WHEN** питомец мягко удален после создания визитов и записей
- **THEN** сами визиты и записи остаются в списках и доступны своему владельцу по id, но история питомца и создание новых ресурсов для этого petId возвращают HTTP 404.

### Requirement: Списки и чтение

Система SHALL предоставлять `GET /api/v1/appointments` только для текущего владельца по scheduledAt по возрастанию и `GET /api/v1/records` по visitDate по убыванию, а также одиночные GET по соответствующему `/{id}`.

#### Scenario: Все статусы визитов
- **WHEN** у владельца есть прошедшие и будущие визиты со статусами SCHEDULED, COMPLETED и CANCELLED
- **THEN** список содержит их без фильтра по времени или статусу; ответы визитов и записей содержат petId, petName, id, предметные поля и createdAt/updatedAt.

### Requirement: Создание и валидация визита

Система SHALL предоставлять `POST /api/v1/appointments` с HTTP 201, требуя petId, clinicName длиной 1–150 и scheduledAt; при отсутствии durationMinutes и status SHALL использовать 30 и SCHEDULED.

#### Scenario: Необязательные поля визита
- **WHEN** переданы doctorName, address, notes, durationMinutes, cost, currency или status
- **THEN** doctorName ограничивается 150 символами, address — 255, notes — 2000, durationMinutes — 5–480, cost — от 0 до 99999999.99 включительно; status допускает SCHEDULED, COMPLETED, CANCELLED.
- **THEN** currency проверяется только как три латинские буквы и переводится в верхний регистр, без проверки реестра ISO-4217; doctorName, address и notes обрезаются по краям, пустые и пробельные значения становятся null.

#### Scenario: Дата и пробельная клиника
- **WHEN** scheduledAt находится в прошлом или clinicName состоит только из пробелов допустимой длины
- **THEN** дата допускается без требования будущего, а clinicName сохраняется пустым после trim, поскольку NotBlank не применяется.

#### Scenario: Нарушение ограничений
- **WHEN** отсутствуют обязательные поля или нарушены указанные ограничения
- **THEN** возвращается HTTP 400 с message `Validation failed` и массивом details с field и message.

### Requirement: Частичное изменение визита

Система SHALL предоставлять `PATCH /api/v1/appointments/{id}` с HTTP 200 и теми же ограничениями необязательных полей; отсутствие и null SHALL означать сохранение значения, а petId не является изменяемым полем.

#### Scenario: Очистка текста и неизменяемые null
- **WHEN** doctorName, address или notes переданы пустыми либо пробельными строками
- **THEN** они очищаются до null; cost, currency и durationMinutes нельзя очистить передачей null.

#### Scenario: Имя клиники и статус
- **WHEN** передан clinicName `""`, пробельный clinicName допустимой длины или допустимый status
- **THEN** пустая строка отклоняется HTTP 400, пробельная строка оставляет clinicName прежним, а status меняется без ограничений переходов между тремя значениями и без автоматического создания медицинской записи.

### Requirement: Создание и связь медицинской записи

Система SHALL предоставлять `POST /api/v1/records` с HTTP 201, обязательными petId и visitDate не позднее текущей даты, необязательными appointmentId и текстами diagnosisText, recommendationsText, prescriptionsText длиной не более 4000 каждый.

#### Scenario: Запись без визита
- **WHEN** appointmentId отсутствует
- **THEN** создается самостоятельная запись с пустым массивом attachments; тексты обрезаются по краям, пустые и пробельные строки становятся null.

#### Scenario: Проверка связи
- **WHEN** appointmentId указан
- **THEN** визит должен существовать и принадлежать тому же владельцу и тому же питомцу; чужой, отсутствующий визит или визит другого собственного питомца дает HTTP 404, а статус визита и соответствие дат не ограничивают связь.

#### Scenario: Некорректная дата или текст
- **WHEN** visitDate отсутствует, находится в будущем либо текст превышает 4000 символов
- **THEN** возвращается HTTP 400 с ошибкой поля.

### Requirement: Частичное изменение медицинской записи

Система SHALL предоставлять `PATCH /api/v1/records/{id}` с HTTP 200 только для visitDate и трех текстовых полей; отсутствие или null SHALL сохранять значения, а petId, appointmentId и attachments не изменяются этим контрактом.

#### Scenario: Изменение и очистка
- **WHEN** переданы допустимая visitDate и пустые либо пробельные тексты
- **THEN** дата обновляется с проверкой PastOrPresent, а переданные тексты очищаются до null; для смены привязки к визиту предусмотрено удаление и новое создание записи, не PATCH.

### Requirement: Удаление визитов и записей

Система SHALL физически удалять визит через `DELETE /api/v1/appointments/{id}` и запись через `DELETE /api/v1/records/{id}` с HTTP 204.

#### Scenario: Удаление связанного визита
- **WHEN** удаляется визит со связанными записями
- **THEN** записи сохраняются, их appointmentId становится null, вложения записей не удаляются.

#### Scenario: Удаление записи с файлами
- **WHEN** удаляется запись с вложениями
- **THEN** система пытается удалить ее локальные файлы по безопасным сгенерированным именам; ошибка файлового удаления логируется и не препятствует удалению записи, поэтому возможны файлы-сироты.

### Requirement: Загрузка и доступ к вложениям

Система SHALL принимать multipart file через `POST /api/v1/records/{id}/attachments`, добавлять новое вложение в конец существующего массива и возвращать HTTP 200 с обновленной записью.

#### Scenario: Допустимый файл
- **WHEN** непустой файл не больше 10 × 1024 × 1024 байт имеет расширение pdf, jpg, jpeg, png или webp без учета регистра
- **THEN** он сохраняется локально в каталоге records под сгенерированным именем; attachments дополняется объектом url, name, type и size, где type — расширение, size — число байт, url начинается с `/files/records/`, а name очищается от путей и управляющих/опасных символов и ограничивается 150 символами.
- **THEN** содержимое и MIME файла не проверяются, число вложений прикладным сервисом не ограничивается, отдельного маршрута удаления одного вложения нет.

#### Scenario: Ошибки и предел multipart
- **WHEN** файл пуст, имеет неподдерживаемое расширение или нарушает прикладной предел размера
- **THEN** прикладная проверка возвращает HTTP 400 с пустым details; multipart-лимиты текущей конфигурации составляют 10MB на файл и 12MB на запрос, их превышение возвращает HTTP 413 с message `Uploaded file is too large (max 5 MB)`, несмотря на фактический предел вложений 10 МиБ.

#### Scenario: Публичность и поврежденные метаданные
- **WHEN** известен URL существующего вложения или чтение записи встречает поврежденный JSON метаданных
- **THEN** файл доступен без JWT по URL; поврежденные метаданные вызывают HTTP 400 через InvalidFileException, а не заменяются пустым массивом.

### Requirement: Идемпотентное создание записи и загрузка вложения

`POST /api/v1/records` и `POST /api/v1/records/{id}/attachments` SHALL принимать необязательный заголовок `Idempotency-Key` длиной от 1 до 128 печатных ASCII-символов без пробелов. Отсутствующий заголовок сохраняет обычное поведение, некорректный возвращает HTTP 400.

Ключ действует в пределах авторизованного владельца и типа операции. Содержимое создания определяется полями запроса, а загрузки — ID записи, исходным именем файла и его байтами. Для каждого вложения используется отдельный ключ.

- При повторе с тем же ключом и содержимым система SHALL возвращать исходное тело и статус HTTP 201 или HTTP 200 соответственно, даже если запись уже изменилась. Параллельные повторы SHALL создавать одну запись или одно вложение.
- После успешной операции повторное использование ключа с другим содержимым SHALL возвращать HTTP 409. Неуспешная операция ключ не резервирует.
- Web и mobile сохраняют ключи повторных отправок в открытой форме. Изменение данных записи или выбор нового вложения образует новую операцию.

### Requirement: Объединенная история питомца

Система SHALL возвращать `GET /api/v1/pets/{petId}/history` как общий массив визитов и записей собственного неудаленного питомца по eventAt по убыванию.

#### Scenario: Хронология разных типов событий
- **WHEN** у питомца существуют визиты и медицинские записи
- **THEN** каждый визит представлен kind APPOINTMENT, eventAt=scheduledAt и объектом appointment; каждая запись представлена kind RECORD, eventAt=visitDate в 00:00 UTC и объектом record; будущие визиты включаются и могут быть первыми, связи appointmentId не объединяют два события в одно.

### Requirement: Причина визита

API визитов SHALL принимать, сохранять и возвращать необязательное поле `reason` длиной до 2000 символов.

#### Scenario: Изменение причины визита
- **WHEN** PATCH передаёт `reason` с текстом, пустой или пробельной строкой либо null
- **THEN** текст сохраняется после trim, пустая или пробельная строка очищает причину, а null сохраняет предыдущее значение.

### Requirement: Приём записи от клиники

Backend SHALL предоставлять POST `/api/v1/vetinfo` для роли `VET_CLINIC`. Питомец и имя клиники SHALL определяться конфигурацией сервера. Запрос SHALL содержать `scheduledAt` и может содержать остальные данные визита, включая причину.

#### Scenario: Создание запланированного визита клиникой
- **WHEN** клиника отправляет валидный запрос и в конфигурации указан активный питомец и допустимое имя клиники
- **THEN** API создаёт визит со статусом SCHEDULED для владельца питомца и возвращает 201 с `appointmentId`.

#### Scenario: Конфигурация клиники недоступна
- **WHEN** идентификатор питомца неположителен либо имя клиники отсутствует или длиннее 150 символов
- **THEN** API возвращает 503.

## Implementation references

- [VetController](../../../services/backend/src/main/java/com/petcare/backend/vet/VetController.java), [VetService](../../../services/backend/src/main/java/com/petcare/backend/vet/VetService.java).
- [CreateAppointmentRequest](../../../services/backend/src/main/java/com/petcare/backend/vet/dto/CreateAppointmentRequest.java), [UpdateAppointmentRequest](../../../services/backend/src/main/java/com/petcare/backend/vet/dto/UpdateAppointmentRequest.java), [CreateRecordRequest](../../../services/backend/src/main/java/com/petcare/backend/vet/dto/CreateRecordRequest.java), [UpdateRecordRequest](../../../services/backend/src/main/java/com/petcare/backend/vet/dto/UpdateRecordRequest.java), [RecordDto](../../../services/backend/src/main/java/com/petcare/backend/vet/dto/RecordDto.java).
- [FileStorageService](../../../services/backend/src/main/java/com/petcare/backend/file/FileStorageService.java), [WebConfig](../../../services/backend/src/main/java/com/petcare/backend/config/WebConfig.java), [GlobalExceptionHandler](../../../services/backend/src/main/java/com/petcare/backend/error/GlobalExceptionHandler.java), [application.properties](../../../services/backend/src/main/resources/application.properties).
- [VetFlowTest](../../../services/backend/src/test/java/com/petcare/backend/VetFlowTest.java), [Миграция ветеринарных таблиц](../../../services/backend/src/main/resources/db/migration/V4__create_vet_tables.sql).
