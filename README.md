# pet-care-v2
## Быстрый старт

Подробная инструкция по локальному запуску через VS Code: [SETUP-VSCODE.md](SETUP-VSCODE.md)

```bash
# Backend  -> http://localhost:8080/api/v1/health
cd services/backend && ./mvnw spring-boot:run

# Web      -> http://localhost:5173
cd apps/web && npm install && npm run dev

# Mobile   -> Expo Go 58 (QR-код в терминале)
cd apps/mobile && npm install && npx expo start

# PostgreSQL 17 (в Sprint 0 backend к нему НЕ подключается)
cd infra && docker compose up -d
```
