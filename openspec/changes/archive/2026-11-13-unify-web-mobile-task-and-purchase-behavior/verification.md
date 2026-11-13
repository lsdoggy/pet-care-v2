# Проверка реализации

Дата: 2026-11-13. Реализация ограничена apps/web и apps/mobile; backend, БД и baseline specs не изменены.

## Автоматические проверки

| Клиент | Команда / окружение | Результат |
| --- | --- | --- |
| Web | `TZ=Europe/Moscow npm.cmd test` | 10/10 прошли |
| Web | `TZ=Europe/Berlin npm.cmd test` | 10/10 прошли |
| Mobile | `TZ=Europe/Moscow npm.cmd test` | 38/38 прошли |
| Mobile | `TZ=Europe/Berlin npm.cmd test` | 38/38 прошли |
| Mobile | `npm.cmd run typecheck` | Успешно |
| Web | `npm.cmd run lint` | 0 ошибок, 4 предупреждения |
| Web | `npm.cmd run build` | Успешно: TypeScript + Vite production build |
| Change | `openspec.cmd validate unify-web-mobile-task-and-purchase-behavior --strict --no-interactive` | Успешно |
| Diff | `git diff --check` | Успешно |

Команды запускались в соответствующих каталогах клиентов. Для PowerShell TZ задавался через `$env:TZ`. Sandbox первоначально блокировал spawn тестовых процессов; результаты таблицы получены при разрешённых запусках, не при заблокированных попытках. Последовательная команда test/build/lint возвращает код последнего процесса, поэтому успешный общий код не означает успешную сборку.

По дополнительному запросу пользователя исправление web auth включено в change и delta-спеку. AuthContext.tsx переименован в AuthProvider.tsx без изменения содержимого; App.tsx импортирует ./auth/AuthProvider. authContext.ts остался единым модулем контекста. Повторная Windows-сборка успешна. Новый tests/auth.test.tsx проверяет реальный провайдер/useAuth, bootstrap сохранённого токена и logout. Начальная попытка теста обнаружила сброс mock-call history Vitest после module bootstrap; тест исправлен динамическим импортом после resetModules, production-логика не менялась.

Предупреждения mobile: react-test-renderer deprecated и предупреждение Vite о будущей native config loading совместимости. Native UI представлен host-моками, поэтому эти тесты не заменяют проверку устройства.

## Покрытие

- Web tests/behavior.test.tsx и mobile tests/parity.test.ts: строгая граница срока ±1ms, равенство, DONE, вчера/завтра, ISO-offset, локальная полночь/DST; валидация имени 1–150 и целого количества 1–999 без округления, trim и PCS.
- Web tests/behavior.test.tsx, tests/home.test.tsx и mobile tests/components.test.tsx: таймеры/foreground/cleanup, счётчики и признаки просрочки, отсутствие GET на тиках, сохранённые различия ленты и горизонтов визитов.
- Формы: custom POST без productId/создания продукта; guard/disabled, запрет закрытия во время POST, ошибка с сохранением ввода/retry, успешное закрытие/reset, отмена без POST, отдельный исход refresh.
- Review diff: прежние быстрые действия и лимиты сохранены; нет преобразования старых продуктов, новых endpoint, server idempotency или изменений обычных Shopping/Stock форм.

## Оставшаяся приёмка

Задачи 4.2 и 4.3 НЕ выполнены. По запросу пользователя установлены Playwright и Android platform-tools: управление Chrome проверено; дополнительно настроен и запущен Android 15 AVD PetCare_API_35, adb видит emulator-5554, проверены Settings/UI dump/screenshot. Впоследствии установлен Expo Go 58.0.5 и запущен pet-care; визуально проверен экран входа. Для регистрации и входа запущен изолированный backend на JDK 25 с временной H2 in-memory БД, Flyway отключён, схема создана Hibernate (PostgreSQL-миграция V10 несовместима с H2). Внешние push отключены. Регистрация отдельного тестового пользователя вернула HTTP 201, health — ok; вход через Android UI открыл главную с email пользователя и пустым списком питомцев. Скриншот: `%LOCALAPPDATA%\PetCareUiTools\signedin.png`. Аккаунт и данные исчезнут при остановке backend. Это не проверка production PostgreSQL-миграций и не выполнение 4.2/4.3. Подробности и prerequisites: [ui-tooling.md](ui-tooling.md). Инструментальный smoke и автоматические API-моки не заменяют фактическую UI-приёмку.

- Проверить главная → быстрая покупка → список на обеих платформах: одна OPEN custom-позиция, правильные поля, нет продукта или изменения запасов; отмена, API ошибка, double tap.
- Проверить прохождение срока и локальной полуночи в активном UI и после foreground, native keyboard, прежние действия питомец/задача/визит и лимиты.

По явному запросу пользователя change архивируется с незавершённой ручной приёмкой: пункты 4.2/4.3 сохранены открытыми, а не отмечены выполненными. При архивации delta specs синхронизируются с baseline; упоминание неизменённых baseline выше относится к этапу реализации до архивации.
