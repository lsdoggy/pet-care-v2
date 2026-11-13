# Локальный запуск Pet Care Platform через VS Code

Инструкция для Sprint 0: backend (Spring Boot) + web (React/Vite) + mobile (Expo).

## 1. Требования к окружению

| Инструмент          | Версия                     | Проверка в терминале VS Code        |
|---------------------|----------------------------|-------------------------------------|
| Java (JDK)          | 25 LTS                     | `java -version`                     |
| Node.js             | 26.x                       | `node -v`                           |
| npm                 | идёт в комплекте с Node   | `npm -v`                            |
| Docker Desktop      | последняя                  | `docker --version`                  |
| Git                 | любая современная         | `git --version`                     |
| Expo Go (телефон)   | 58                         | установить из App Store / Play Store|

> Maven ставить не нужно — в `services/backend` есть обёртка `mvnw`, которая сама скачает нужную версию Maven.

## 2. Открытие проекта

```bash
git clone <URL-репозитория>
code pet-care-v2
```

Открывайте **корень монорепо** (не отдельную папку) — тогда VS Code увидит все три приложения сразу.

При первом открытии VS Code предложит установить рекомендованные расширения (панель справа внизу) — соглашайтесь:
- **Extension Pack for Java** (redhat/java) — поддержка Spring Boot и Maven;
- **ESLint**, **Prettier** — линтинг и форматирование TS;
- **Docker** — работа с контейнерами.

## 3. Настройка терминалов (сплит-экраны)

В VS Code откройте три терминала: `Terminal → New Terminal`, затем разделите панель (иконка «разделить») или используйте вкладку `Ports`. Каждый сервис запускается в **своём** терминале, потому что команды работают постоянно (dev-серверы).

### 3.1. Backend (порт 8080)

Терминал 1:
```bash
cd services/backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```
Признак готовности: лог `Started BackendApplication in ... seconds`.

Проверка (в любом другом терминале или браузере):
```bash
curl http://localhost:8080/api/v1/health
# ожидаемый ответ: {"status":"ok"}
```

Остановка: `Ctrl+C` в этом терминале.

### 3.2. Web (порт 5173)

Терминал 2:
```bash
cd apps/web
npm install
npm run dev
```
Откройте http://localhost:5173 — на странице должен появиться индикатор **OK** (запрос `/api/v1/health` идёт через Vite-proxy на backend, CORS не мешает).

Если видите **Error** — убедитесь, что backend запущен (шаг 3.1).

### 3.3. Mobile (Expo)

Терминал 3:
```bash
cd apps/mobile
npm install
npx expo start
```

**Вариант А — телефон (рекомендуется):**
1. Установите на телефон приложение **Expo Go 58**.
2. Телефон и компьютер должны быть в одной Wi-Fi сети.
3. Отсканируйте QR-код из терминала (iPhone — камерой, Android — приложением Expo Go).
4. ⚠️ В файле `apps/mobile/.env.local` замените `localhost` на **IP компьютера в локальной сети**, иначе телефон не достучится до backend:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.XX:8080
   ```
   IP в Linux/macOS: `ip addr` / `ifconfig`; в Windows: `ipconfig`.
   После изменения `.env` перезапустите `npx expo start` с флагом `--clear`:
   ```bash
   npx expo start --clear
   ```

**Вариант Б — эмулятор:**
- Android: установите Android Studio и создайте AVD, затем `npx expo start --android`.
- iOS (только macOS): Xcode Simulator, затем `npx expo start --ios`.

**Вариант В — браузер (быстрый тест без телефона):**
```bash
npx expo start --web
```

### 3.4. PostgreSQL (Docker) — по желанию

В Sprint 0 backend **не подключается** к базе. Если нужен запущенный PG 17:
```bash
cd infra
docker compose up -d
docker compose ps            # статус healthy
docker compose down          # остановка
```

## 4. Запуск через Task Pipelines (опционально)

В `.vscode/tasks.json` уже описаны задачи: `Terminal → Run Task...` → выберите нужную:
- `install all deps` — установка npm-зависимостей для web и mobile;
- `run all (backend + web)` — одновременный запуск Spring Boot и Vite в отдельных терминалах;
- `mobile: expo start` — запуск Expo.

## 5. Частые проблемы

| Симптом                                   | Причина / решение                                                        |
|------------------------------------------|---------------------------------------------------------------------------|
| Страница web показывает **Error**        | Backend не запущен → проверьте шаг 3.1 и `curl http://localhost:8080/api/v1/health` |
| Порт 8080 занят                          | `lsof -i :8080` (macOS/Linux) / `netstat -ano \| findstr 8080` (Windows), освободите порт |
| Телефон показывает ошибку сети           | Не заменён IP в `.env`, либо телефон и ПК в разных сетях / блокирует firewall |
| Expo не применяет новый `.env`           | Перезапуск с `npx expo start --clear`                                     |
| VS Code не видит Spring Boot             | Установите Extension Pack for Java и выполните `Java: Clean Java Language Server Workspace` |

## 6. Итоговый чек-лист Sprint 0

- [ ] `curl http://localhost:8080/api/v1/health` → `{"status":"ok"}`
- [ ] http://localhost:5173 → индикатор **OK**
- [ ] Expo-экран на телефоне/эмуляторе → **OK**
