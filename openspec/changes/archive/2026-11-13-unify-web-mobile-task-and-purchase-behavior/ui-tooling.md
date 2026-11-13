# Подключение инструментов UI-приёмки

2026-11-13, Windows. По запросу пользователя установлены локально (вне репозитория):

- Playwright в `%LOCALAPPDATA%\PetCareUiTools\node_modules\playwright`; управление установленным Chrome через Node/PowerShell.
- Официальные Android platform-tools в `%LOCALAPPDATA%\PetCareUiTools\platform-tools`; adb 1.0.41, package 37.0.1.

Production dependencies клиентов не изменены. npm install выполнен с --ignore-scripts. Глобальный PATH не менялся.

## Проверка подключения

- Playwright успешно запустил Chrome 157.0.8103.51, создал тестовую страницу и нажал кнопку по роли: interaction OK. Это проверка инструмента, НЕ pet-care UI smoke.
- `adb devices -l` успешно выполняется; список устройств пуст. Запущен локальный adb daemon tcp:5037.
- Chrome и Edge установлены. Android emulator/SDK не найдены в стандартном каталоге; java/docker/maestro/adb/emulator не найдены в PATH до установки adb.
- Backend `http://localhost:8080/api/v1/health` и web `http://localhost:5173` недоступны при probe (timeout). Запущенный Harness на другом URL не является pet-care приложением.
- Официальный Harness CUA bundle помечен unsupported-platform; его установка/обход версии не выполнялись.

## Настройка эмулятора (завершена)

- JDK Temurin 17.0.21+9 установлен локально, SHA256 архива проверен.
- Android CLI 1.1.16919734 установлен в `%LOCALAPPDATA%\PetCareUiTools\android-sdk\cmdline-tools\latest`, SHA1 архива проверен по официальному SDK repository.
- Лицензия SDK принята с явного разрешения пользователя.
- Установлены emulator 37.2.13, platform-tools 37.0.1, Android 35 и google_apis x86_64 image r09. После двух обрывов Android CLI архив скачан curl с поддержкой докачки; SHA1 0103e6dab21290c4b9d16550a3ce99476f884eef совпал с официальным каталогом.
- Создано и запущено AVD `PetCare_API_35` (Pixel 4). `adb devices -l`: emulator-5554 device; `sys.boot_completed=1`; Android release=15. WHPX установлен и доступен.
- Проверены запуск Android Settings, adb input, UI hierarchy dump и screenshot. При первом запуске был System UI ANR; после ожидания и снижения разрешения до 720x1520, density 280 интерфейс откликается, повторный screenshot без диалога ANR. Анимации отключены. Android 35 автоматически требует минимум 2560MB RAM; задано 2 CPU. На хосте 8GB возможна медленная работа.
- Скриншот и UI dump находятся вне репозитория: `%LOCALAPPDATA%\PetCareUiTools\emulator-ready.png`, `emulator-ui.xml`. Эмулятор оставлен запущенным.
- По следующему запросу установлен официальный Expo Go 58.0.5 (адрес получен из Expo versions API). Автозагрузка Expo CLI завершилась ECONNRESET; curl скачал APK, adb install вернул Success. Metro запущен на localhost:8081, adb reverse tcp:8081 настроен, проект открыт через exp://127.0.0.1:8081.
- Metro собрал index.ts (823 modules); на устройстве визуально подтверждён экран «Вход в аккаунт» pet-care. Скриншот: `%LOCALAPPDATA%\PetCareUiTools\petcare-app.png`. Backend localhost:8080 при probe не отвечает; EXPO_PUBLIC_API_URL задан для процесса как http://10.0.2.2:8080. Вход и бизнес-сценарии не проверены.
- Известные предупреждения: React Native DevTools использует fallback после отказа записи dotslash cache; manifest assets resolution aborted (возможны проблемы иконок/шрифтов); remote push notifications не поддерживаются Expo Go, для них нужен development build. Отображение экрана входа подтверждено несмотря на предупреждения.
- Скрипты: `tools/android-env.ps1`, `tools/setup-android-emulator.ps1`, `tools/start-android-emulator.ps1`. При запрете PowerShell scripts запускать через `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` (только текущий процесс, без изменения системной политики).
- Хост: i5-12450H, 8GB RAM, около 366GB свободно; HypervisorPresent=true, VBS работает. Запрос состояния optional feature требует elevation; компоненты Windows и BIOS не изменялись.

## Для фактической приёмки

1. Запустить реальный backend с тестовой БД и web либо предоставить URL тестового окружения. Использовать отдельную тестовую учётную запись; не проверять сценарий создания на production без согласования.
2. Установить совместимый с SDK 58 Expo Go/сборку pet-care на готовый `PetCare_API_35` и запустить Metro. Native действия доступны через adb; отдельный Appium/Maestro driver не установлен.
   Повторный запуск эмулятора из корня pet-care-v2: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/start-android-emulator.ps1`.
   Для Expo открыть PowerShell с процессной execution policy и dot-source `tools/android-env.ps1`, затем из apps/mobile выполнить `npm.cmd run android`.
   Локальный backend хоста из Android доступен по `http://10.0.2.2:8080`, не по localhost эмулятора. Настройку endpoint выполнять отдельно с реальным тестовым backend.
3. При наличии телефона adb позволяет screenshots, UI hierarchy, taps/input и background/foreground. Установка platform-tools не создаёт виртуальное устройство.
4. Проверить сценарии 4.2/4.3 и сохранить реальные результаты. Задачи остаются открытыми до этой проверки; Playwright инструментальная страница и прежние API-моки не заменяют приёмку.
