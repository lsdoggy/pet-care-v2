# Тестовый Android APK в GitHub Actions

После появления workflow в `main` откройте **Actions → Android APK → Run workflow**,
выберите ветку и нажмите **Run workflow**. Для запуска из терминала нужны
права записи в репозиторий и авторизованный GitHub CLI.

```bash
gh workflow run android-apk.yml --repo lsdoggy/pet-care-v2 --ref main
```

GitHub включает ручной запуск после появления файла workflow в основной ветке.
До этого первый запуск выполняется при открытии PR. Автоматическая сборка
также проверяет обновления PR, в diff которых есть `.github/workflows/android-apk.yml`.

После успешного запуска откройте его страницу и скачайте **pet-care-android-apk**
в разделе **Artifacts**. В архиве лежат `pet-care-ci.apk` и `SHA256SUMS`.
**pet-care-android-diagnostics** содержит журналы npm, TypeScript, Vitest, Expo,
Gradle и проверки APK для выполненных шагов. Артефакты хранятся 7 дней.

```bash
gh run download RUN_ID --repo lsdoggy/pet-care-v2 --name pet-care-android-apk
sha256sum -c SHA256SUMS
adb install -r pet-care-ci.apk
```

Для установки используйте Android 7.0 (API 24) или новее на 64-битном ARM
либо x86-64. Откройте **Pet Care CI** на устройстве. В APK уже встроен
JavaScript, а вариант для тестирования подписан отладочным ключом шаблона
Expo. Идентификатор `com.lsdoggy.petcare.ci` позволяет установить его рядом
с обычным приложением. GitHub Actions проверяет подпись, стартовую Activity,
обе архитектуры и наличие встроенного бандла перед публикацией.

Сборка обращается к `https://petcare-ci.invalid`. Её можно использовать для
проверки установки, запуска и экранов до входа. Для проверки сценариев после
входа понадобится отдельный тестовый API с синтетическими данными и новая
сборка с его адресом. Конфигурация FCM для этого APK не используется.

## Firebase Test Lab

Загрузите распакованный `pet-care-ci.apk` в **Firebase Console → Test Lab →
Run a test → Robo** в отдельном тестовом проекте. Для первичной проверки
выберите одно виртуальное устройство x86-64 с API 24 или новее.
Robo использует APK приложения. Результаты, видео и logcat будут доступны
в Test Lab. У Google есть [инструкция по запуску Robo](https://firebase.google.com/docs/test-lab/android/firebase-console).

На Spark квота проекта составляет до 10 запусков на виртуальных и 5 на
физических устройствах в день. Для первого запуска используйте Firebase Console
и проверьте [действующие квоты](https://firebase.google.com/docs/test-lab/usage-quotas-pricing).
Текущий workflow строит APK локально на раннере GitHub и не требует аккаунтов
EAS или Firebase, токенов и платных раннеров. Сборка идёт в одном задании
на стандартном Linux-раннере с лимитом 35 минут. Для публичного репозитория
такие минуты [не тарифицируются](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
