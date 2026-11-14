# Pet Profiles Specification

## Purpose

Описать текущий API профилей питомцев, правила владения, частичного изменения, мягкого удаления и загрузки фотографии.

## Requirements

### Requirement: Доступ только к собственным активным профилям

Система SHALL требовать JWT для `/api/v1/pets`, возвращать в `GET /api/v1/pets` только неудаленных питомцев текущего владельца по createdAt по возрастанию и проверять владельца при чтении, изменении, удалении и прикреплении фото.

#### Scenario: Чужой, отсутствующий или удаленный питомец
- **WHEN** пользователь обращается к такому id через маршрут профиля
- **THEN** возвращается HTTP 404 вместо раскрытия существования чужого ресурса; ошибка содержит status, error, message, details и timestamp.

#### Scenario: Нет аутентификации
- **WHEN** маршрут профиля вызывается без действительного JWT
- **THEN** возвращается HTTP 401.

### Requirement: Создание и представление профиля

Система SHALL создавать профиль через `POST /api/v1/pets` с HTTP 201, назначая ownerId из текущего пользователя. Ответы создания, `GET /api/v1/pets/{id}` и изменения SHALL содержать id, ownerId, name, species, birthDate, photoUrl, createdAt, updatedAt, breed и weightKg.

#### Scenario: Допустимый профиль
- **WHEN** переданы name длиной 1–100 до trim и species из DOG, CAT, BIRD, HAMSTER, RABBIT, TURTLE, FISH, OTHER
- **THEN** создается профиль с обрезанным по краям name; birthDate, breed и weightKg могут отсутствовать.

#### Scenario: Необязательные поля
- **WHEN** указаны breed или weightKg
- **THEN** breed ограничивается 80 символами до trim, обрезается по краям и становится null, если пуст или пробельный; weightKg должен быть строго больше нуля и не больше 200 кг.

#### Scenario: Некорректные данные
- **WHEN** name отсутствует, пуст или длиннее 100, species отсутствует, birthDate позднее текущей серверной даты, breed длиннее 80 либо weightKg вне диапазона
- **THEN** возвращается HTTP 400 с ошибкой соответствующего поля; для Bean Validation message равен `Validation failed`.

#### Scenario: Пробельное имя при создании
- **WHEN** name содержит только пробелы и проходит ограничение длины 1–100
- **THEN** текущая реализация не применяет NotBlank и сохраняет пустое имя после trim.

### Requirement: Частичное обновление профиля

Система SHALL предоставлять `PATCH /api/v1/pets/{id}` с HTTP 200; отсутствующие и null-поля SHALL сохранять прежние значения, включая birthDate и weightKg.

#### Scenario: Изменение отдельных полей
- **WHEN** переданы допустимые name, species, birthDate, breed или weightKg
- **THEN** изменяются только переданные ненулевые поля, применяются те же пределы длины, даты и веса; непустое непробельное name обрезается по краям.

#### Scenario: Очистка и пустые значения
- **WHEN** breed равен пустой или пробельной строке
- **THEN** breed очищается до null; null не очищает breed, birthDate или weightKg.

#### Scenario: Пустое и пробельное имя
- **WHEN** PATCH содержит name `""` либо непустую пробельную строку допустимой длины
- **THEN** пустая строка отклоняется HTTP 400, а пробельная строка не меняет текущее имя.

### Requirement: Мягкое удаление

Система SHALL обрабатывать `DELETE /api/v1/pets/{id}` с HTTP 204 установкой deleted=true без удаления строки профиля и связанных задач, визитов или медицинских записей.

#### Scenario: Последующие обращения
- **WHEN** питомец мягко удален
- **THEN** он отсутствует в списке профилей, его профиль и история возвращают HTTP 404; повторное удаление также возвращает HTTP 404.

### Requirement: Фотография питомца

Система SHALL принимать multipart-поле file через `POST /api/v1/pets/{id}/photo`, сохранять файл локально и возвращать HTTP 200 с обновленным photoUrl вида `/files/uploads/pets/<generated-name>.<ext>`.

#### Scenario: Допустимая загрузка
- **WHEN** непустой файл не больше 5 × 1024 × 1024 байт имеет расширение jpg, jpeg, png или webp без учета регистра
- **THEN** файл сохраняется под сгенерированным именем, новый URL заменяет photoUrl; прежняя фотография при замене не удаляется и содержимое файла не проверяется как изображение.

#### Scenario: Недопустимый файл
- **WHEN** файл пуст, превышает прикладной предел 5 МиБ или имеет неподдерживаемое расширение
- **THEN** прикладная проверка возвращает HTTP 400 с message и пустым details; при превышении multipart-лимита контейнера возвращается HTTP 413.

Система SHALL требовать JWT владельца для чтения текущего фото активного профиля по обоим путям: `/files/uploads/pets/{filename}` и `/files/pets/{filename}`.

#### Scenario: Чтение фото владельцем
- **WHEN** владелец запрашивает сохранённое фото с действительным JWT
- **THEN** сервер возвращает изображение с HTTP 200 и `Cache-Control: no-store`.

#### Scenario: Чтение фото без доступа
- **WHEN** клиент запрашивает фото без действительного JWT
- **THEN** сервер возвращает HTTP 401.
- **WHEN** аутентифицированный клиент запрашивает чужое, отсутствующее или уже не привязанное к его активному профилю фото
- **THEN** сервер возвращает HTTP 404.

## Implementation references

- [PetController](../../../services/backend/src/main/java/com/petcare/backend/pet/PetController.java), [PetService](../../../services/backend/src/main/java/com/petcare/backend/pet/PetService.java), [PetSpecies](../../../services/backend/src/main/java/com/petcare/backend/pet/PetSpecies.java).
- [CreatePetRequest](../../../services/backend/src/main/java/com/petcare/backend/pet/dto/CreatePetRequest.java), [UpdatePetRequest](../../../services/backend/src/main/java/com/petcare/backend/pet/dto/UpdatePetRequest.java), [PetDto](../../../services/backend/src/main/java/com/petcare/backend/pet/dto/PetDto.java).
- [FileStorageService](../../../services/backend/src/main/java/com/petcare/backend/file/FileStorageService.java), [PetPhotoController](../../../services/backend/src/main/java/com/petcare/backend/pet/PetPhotoController.java), [GlobalExceptionHandler](../../../services/backend/src/main/java/com/petcare/backend/error/GlobalExceptionHandler.java).
- [PetFlowTest](../../../services/backend/src/test/java/com/petcare/backend/PetFlowTest.java), [Миграция профилей](../../../services/backend/src/main/resources/db/migration/V2__create_pets_table.sql).
