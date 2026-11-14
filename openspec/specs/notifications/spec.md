# Notifications Specification

## Purpose

Зафиксировать baseline backend pet-care-v2 для ленты уведомлений, настроек, реестра устройств, каналов доставки и планировщика напоминаний. Спецификация разделяет реализованные ветви Java-кода и ограничения их исполнения. Основание: контроллеры, сервисы, DTO, сущности, отправители, миграции V6–V8 и конфигурация приложения/тестов. Интеграционный тест NotificationPersistenceTest проверяет хранение на PostgreSQL с миграциями Flyway. Сквозная доставка через Expo и SMTP этим тестом не проверяется.

JPA-конвертеры NotificationEntity сохраняют тип канала как push или email и статус как pending, sent, failed или read. При чтении они преобразуют эти значения обратно в Java enum. Формат соответствует CHECK-ограничениям миграции V6.

Источники реализации: [NotificationService](../../../services/backend/src/main/java/com/petcare/backend/notification/NotificationService.java), [NotificationEntity](../../../services/backend/src/main/java/com/petcare/backend/notification/NotificationEntity.java), [ReminderScheduler](../../../services/backend/src/main/java/com/petcare/backend/notification/ReminderScheduler.java), [DeviceService](../../../services/backend/src/main/java/com/petcare/backend/device/DeviceService.java), [RegisterDeviceRequest](../../../services/backend/src/main/java/com/petcare/backend/device/dto/RegisterDeviceRequest.java), [NotificationSettingsRequest](../../../services/backend/src/main/java/com/petcare/backend/notification/dto/NotificationSettingsRequest.java), [ExpoPushSender](../../../services/backend/src/main/java/com/petcare/backend/notification/ExpoPushSender.java), [FcmPushSender](../../../services/backend/src/main/java/com/petcare/backend/notification/FcmPushSender.java), [SmtpMailSender](../../../services/backend/src/main/java/com/petcare/backend/notification/SmtpMailSender.java), [миграция V6](../../../services/backend/src/main/resources/db/migration/V6__create_notifications_table.sql), [миграция V7](../../../services/backend/src/main/resources/db/migration/V7__create_user_devices_table.sql), [миграция V8](../../../services/backend/src/main/resources/db/migration/V8__add_notification_settings_and_reminder_flag.sql), [application.properties](../../../services/backend/src/main/resources/application.properties), [тестовая конфигурация](../../../services/backend/src/test/resources/application.properties).

## Requirements

### Requirement: Аутентификация и персональная лента

Backend SHALL защищать API уведомлений, настроек и устройств аутентификацией и ограничивать чтение ленты текущим пользователем.

#### Scenario: Неаутентифицированный запрос
- **WHEN** запрос поступает к `/api/v1/notifications`, `/api/v1/devices` либо `/api/v1/users/notification-settings` без аутентификации
- **THEN** security layer возвращает 401.

#### Scenario: Лента пользователя
- **WHEN** аутентифицированный пользователь вызывает GET `/api/v1/notifications`
- **THEN** сервис выбирает только записи с его userId по createdAt по убыванию, без реализованной пагинации; DTO содержит id, type, title, body, payloadJson как строку JSON, channelStatus, sentAt и createdAt.

#### Scenario: Счётчик непрочитанного
- **WHEN** вызывается GET `/api/v1/notifications/unread-count`
- **THEN** сервис считает только записи текущего пользователя со статусом SENT; PENDING, FAILED и READ не входят в счётчик.

### Requirement: Отметка прочтения и ownership

Backend SHALL обрабатывать POST `/api/v1/notifications/{id}/read` проверкой владельца и менять только SENT на READ, не выполняя повторную доставку.

#### Scenario: Чтение доставленной записи
- **WHEN** собственная запись существует и имеет статус SENT
- **THEN** сервис переводит её в READ и возвращает DTO с HTTP 200 при успешном сохранении; sentAt не изменяется, отдельное поле readAt отсутствует.

#### Scenario: Повторная отметка или другой статус
- **WHEN** собственная запись уже READ либо имеет PENDING или FAILED
- **THEN** сервис возвращает её без изменения статуса.

#### Scenario: Чужая запись
- **WHEN** найденная запись принадлежит другому пользователю
- **THEN** AccessDeniedForResourceException преобразуется общим обработчиком в 404, запись не изменяется.

#### Scenario: Отсутствующий id
- **WHEN** запись с id не существует
- **THEN** сервис выбрасывает NotificationNotFoundException; явный HTTP-обработчик или ResponseStatus для этого исключения отсутствует, поэтому baseline не обещает предусмотренный для других доменов корректный ответ 404.

### Requirement: Настройки каналов пользователя

Backend SHALL хранить pushNotificationsEnabled=true и emailNotificationsEnabled=false по умолчанию и принимать PATCH `/api/v1/users/notification-settings` с двумя обязательными Boolean-полями pushEnabled и emailEnabled.

#### Scenario: Обновление обоих переключателей
- **WHEN** пользователь передаёт оба значения true/false
- **THEN** оба настройки текущего пользователя заменяются и возвращается UserDto с HTTP 200; состояние доступно также в GET `/api/v1/users/me`.

#### Scenario: Обновление видов напоминаний
- **WHEN** запрос дополнительно передаёт `hourReminderEnabled`, `dayReminderEnabled`, `overdueReminderEnabled` или `lowStockNotificationEnabled`
- **THEN** переданные значения сохраняются, а отсутствующие поля и null оставляют прежние значения.

#### Scenario: Отсутствующий переключатель канала
- **WHEN** одно из полей отсутствует либо null
- **THEN** DTO-валидация возвращает 400, несмотря на HTTP-метод PATCH оба переключателя каналов обязательны в каждом запросе.

#### Scenario: Отключённый канал при новом событии
- **WHEN** scheduler вызывает push или email для пользователя с выключенным соответствующим каналом
- **THEN** сервис не создаёт уведомление этого канала и не вызывает отправитель; другие включённые каналы обрабатываются независимо.

#### Scenario: Настройки после возникновения записи
- **WHEN** канал выключен после создания PENDING или FAILED записи
- **THEN** retry не перепроверяет пользовательские переключатели и может повторно пытаться отправить существующую запись; выключение канала не удаляет историю.

### Requirement: Регистрация и ownership устройств

Backend SHALL предоставлять POST `/api/v1/devices/register`, GET `/api/v1/devices` и DELETE `/api/v1/devices/{id}` с привязкой устройств к текущему userId; уникальность токена в базе ограничена парой userId/token, а не всеми пользователями.

#### Scenario: Первичная регистрация
- **WHEN** переданы непустой token длиной не более 512 и platform ios/android/web без учёта регистра
- **THEN** сервис обрезает token по краям, нормализует platform в lowercase и создаёт устройство с pushEnabled=true; ответ 201 содержит id, tokenPreview, platform, pushEnabled, createdAt и lastSeenAt.

#### Scenario: Недопустимая платформа или токен
- **WHEN** token пуст/blank/слишком длинен либо platform не соответствует точному шаблону ios/android/web
- **THEN** запрос отклоняется с 400; окружающие пробелы в platform не проходят DTO Pattern до вызова нормализации, а формат push-токена на регистрации не проверяется.

#### Scenario: Повторная регистрация своего токена
- **WHEN** повторяется регистрация уже имеющегося у пользователя token
- **THEN** возвращается тот же id с HTTP 201 без дублирования, прежняя platform сохраняется; отключённое устройство повторно включается.

#### Scenario: Ограничение lastSeenAt
- **WHEN** повторно регистрируется уже включённое устройство с тем же token
- **THEN** сервис не изменяет поля явно; lastSeenAt обновляется только lifecycle-методом PreUpdate при фактическом обновлении сущности и потому не гарантированно освежается таким запросом.

#### Scenario: Токен зарегистрирован другим пользователем
- **WHEN** другой пользователь регистрирует тот же token
- **THEN** может создаваться отдельная строка его реестра, прежняя регистрация не отзывается автоматически.

#### Scenario: Список и отображение токена
- **WHEN** пользователь запрашивает свои устройства
- **THEN** возвращаются только его записи без заданного сервисом порядка; tokenPreview для токенов длиннее 12 символов равен первым 6 символам, многоточию и последним 4, но токены длиной до 12 возвращаются целиком.

#### Scenario: Удаление устройства
- **WHEN** пользователь удаляет своё устройство
- **THEN** строка удаляется, ответ равен 204, а будущая выборка push-устройств не включает её; DELETE чужого либо отсутствующего id выбрасывает DeviceNotFoundException без отдельного HTTP-обработчика, поэтому корректный 404 для него baseline не гарантирует.

### Requirement: Создание push и агрегированный результат устройств

NotificationService SHALL в реализованной сервисной ветви создавать одну PUSH-запись на событие пользователя и отправлять её на все его устройства с pushEnabled=true, сохраняя агрегированный, а не поустройственный статус.

#### Scenario: Нет устройств
- **WHEN** push включён у пользователя, но включённых устройств нет
- **THEN** сервис создаёт запись с начальным PENDING и без sentAt и не вызывает отправители; сохранение записи подчинено ограничениям схемы.

#### Scenario: Есть поддерживаемые токены
- **WHEN** устройства найдены
- **THEN** каждый token назначается первому PushSender, чей supports вернул true; токены группируются по отправителю, и запись получает SENT, если хотя бы один отправитель не включил хотя бы один токен в список неудачных, иначе FAILED; sentAt выставляется как время попытки.

#### Scenario: Частичная неудача
- **WHEN** один токен принят отправителем, а другой не принят либо не поддерживается
- **THEN** общий результат может быть SENT, отдельные результаты токенов не сохраняются и автоматический retry успешной в целом записи не выполняется.

#### Scenario: Ни один отправитель не поддерживает токены
- **WHEN** ни для одного token не выбран PushSender
- **THEN** сервис логирует предупреждения и выставляет записи FAILED с sentAt; регистрации устройств при этом не удаляются и не выключаются.

### Requirement: Реальный Expo transport и ограничение подтверждения доставки

Backend SHALL включать ExpoPushSender по умолчанию через `app.notifications.expo.enabled` (EXPO_PUSH_ENABLED, default true) и поддерживать им только token, начинающиеся с `ExponentPushToken[`.

#### Scenario: Отправка Expo batch
- **WHEN** Expo sender получает непустой набор поддерживаемых токенов
- **THEN** он делает HTTP POST массива сообщений to/title/body/data в `https://exp.host/--/api/v2/push/send` либо заданный `app.notifications.expo.url`, с необязательным access token из EXPO_PUSH_ACCESS_TOKEN, connect timeout 10 секунд и read timeout 15 секунд.

#### Scenario: Отказ Expo или исключение
- **WHEN** соответствующий ticket содержит status не ok либо HTTP/JSON операция выбрасывает исключение
- **THEN** отклонённый токен либо весь batch возвращается сервису как неудачный; исключение sender не пробрасывает.

#### Scenario: Неполный успешный ответ
- **WHEN** ответ разобран, но data отсутствует либо содержит меньше tickets, чем было токенов
- **THEN** текущий sender не добавляет отсутствующие tickets в список ошибок и может сообщить успех; receipt polling и подтверждение получения на устройстве не реализованы, SENT означает только результат текущей логики отправителя.

### Requirement: Raw FCM остаётся заглушкой

Backend SHALL считать FcmPushSender отключённым по умолчанию (`app.notifications.fcm.enabled`, FCM_ENABLED=false) и не трактовать его включение как работоспособную native FCM-доставку.

#### Scenario: Включение FCM
- **WHEN** FCM_ENABLED=true
- **THEN** sender логирует отсутствие firebase-admin клиента, поддерживает любые ненулевые токены без префикса ExponentPushToken[ и возвращает все полученные токены как failed, не отправляя их в Firebase.

#### Scenario: Raw token без sender
- **WHEN** устройство имеет raw FCM token, а FCM sender выключен
- **THEN** реестр принимает token, но push-сервис не находит для него отправитель; отдельного рабочего Web Push/VAPID transport также нет, несмотря на допустимую platform=web.

### Requirement: Email transport и важные события

Backend SHALL в реализованной email-ветви создавать отдельную EMAIL-запись при включённом email-канале и отправлять простой текст SMTP через SmtpMailSender; scheduler вызывает этот канал только для MEDICATION и VACCINATION.

#### Scenario: Доступен SMTP sender
- **WHEN** доступен JavaMailSender и его send завершается без исключения
- **THEN** используется адрес пользователя и настроенный from, а сервис назначает EMAIL-записи SENT и sentAt. SENT не подтверждает прочтение письма.

#### Scenario: Отправка без рабочего SMTP
- **WHEN** JavaMailSender отсутствует либо SMTP отправка завершается исключением
- **THEN** sender логирует ситуацию и возвращает false, сервис назначает FAILED и sentAt, не подменяя отправку успешной заглушкой.

#### Scenario: Конфигурация почты
- **WHEN** приложение загружается без пользовательских SMTP-параметров
- **THEN** конфигурация содержит пустой MAIL_HOST, port=587, auth=true и STARTTLS=true; рабочий SMTP не гарантирован, а наличие или отсутствие автоконфигурированного JavaMailSender определяется Spring-конфигурацией.

### Requirement: Планировщик напоминаний о задачах

Backend SHALL по умолчанию проверять PENDING-задачи с задержкой 60000 мс между проверками. Для каждого вида напоминания SHALL применяться отдельный пользовательский переключатель и отдельный флаг отправки на задаче.

#### Scenario: Выборка по сроку
- **WHEN** планировщик выполняет проверку
- **THEN** часовое напоминание выбирает сроки от текущего момента до конца окна `app.notifications.reminder-window-minutes` включительно (по умолчанию 60 минут), суточное — сроки после конца этого окна до 24 часов включительно, а просроченное — сроки не позднее текущего момента.

#### Scenario: Каналы и данные напоминания
- **WHEN** выбранная задача принадлежит активному владельцу с включённым напоминанием выбранного вида
- **THEN** планировщик передаёт русскоязычный заголовок и текст в push, а для MEDICATION и VACCINATION также в email. Payload содержит `careTaskId`, `taskTitle`, `petName`, `overdue`, `petId`, `type` в нижнем регистре и `dueAt` в формате ISO Instant. Сервис уведомлений учитывает настройки каналов.

#### Scenario: Повторное сканирование
- **WHEN** обработка подходящей задачи успешно фиксируется
- **THEN** следующий проход пропускает этот вид напоминания для задачи. Если владелец отсутствует, деактивирован или выключил этот вид напоминания, соответствующий флаг остаётся прежним.

#### Scenario: Изменение задачи после напоминания
- **WHEN** PATCH меняет срок, описание, тип или статус задачи
- **THEN** флаги отправки сохраняются. Следующий экземпляр повторяющейся задачи получает собственные начальные флаги.

#### Scenario: Ошибка фиксации и параллельные процессы
- **WHEN** транзакция проверки откатывается либо несколько экземпляров backend сканируют одновременно
- **THEN** возможна повторная доставка, поскольку внешние отправки выполняются отдельно от фиксации флагов, а блокировка захвата задачи отсутствует.

### Requirement: Минимальный retry без лимита числа попыток

Backend SHALL запускать retry для PENDING/FAILED записей по createdAt по возрастанию с default fixed delay 60000 мс, не заявляя реализованный лимит в три попытки: объявленная MAX_SEND_ATTEMPTS=3 фактически не используется и счётчик попыток не хранится.

#### Scenario: Повтор push без устройств
- **WHEN** retry обрабатывает PUSH-запись без включённых устройств
- **THEN** меняется только sentAt на время попытки, статус сохраняется и счётчик возвращаемого количества повторных отправок не увеличивается; PENDING не становится автоматически FAILED.

#### Scenario: Повтор push с устройствами
- **WHEN** для PENDING/FAILED PUSH-записи доступны включённые устройства
- **THEN** push отправляется снова на все выбранные токены, применяет общий SENT/FAILED и обновляет sentAt; это учитывается в результате retry даже если доставка неуспешна.

#### Scenario: Повтор email
- **WHEN** retry обрабатывает EMAIL-запись
- **THEN** при найденном адресе и успешном send выставляются SENT/sentAt и увеличивается результат retry, иначе обновляется только sentAt с сохранением прежнего статуса.

#### Scenario: Условное окно отказа
- **WHEN** sentAt записи старше текущего времени более чем на 24 часа
- **THEN** retry пропускает запись без изменения статуса; возраст считается от sentAt, а не createdAt, и поскольку обычные попытки постоянно обновляют sentAt, регулярные неудачи могут повторяться неограниченно долго.

#### Scenario: Начальная задержка и тестовая конфигурация
- **WHEN** специальная initial-delay-ms не задана
- **THEN** scan стартует после 15000 мс, retry после 30000 мс; обе аннотации используют один ключ `app.notifications.initial-delay-ms` с разными fallback, а test configuration устанавливает его и интервалы обоих jobs в 3600000 мс и выключает Expo/FCM senders, не подтверждая реальную внешнюю доставку.
