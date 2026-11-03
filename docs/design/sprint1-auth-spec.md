# Design Sprint 1 — Auth screens: спецификация

> Статус: реализовано (web `AuthPage.tsx`, mobile `AuthScreen.tsx`).
> API-контракты сохранены: `POST /api/v1/auth/login {email,password}`,
> `POST /api/v1/auth/register {email,password,firstName?,phone?}` — новые поля опциональны
> (миграция V9, nullable колонки), старые клиенты не ломаются.
> Вариант B подтверждён владельцем проекта; интерфейс — русский; captcha/social/2FA нет.

---

## 1. Экран «Вход» (login)

**Цель:** безопасный вход → Dashboard (W: `/`, M: Home-tab).

| Поле | Тип | Валидация (onBlur + onSubmit) | autofill |
|---|---|---|---|
| Электронная почта | email/text | непустая, формат, ≤255 | `email` |
| Пароль | password + toggle 👁 | непустой, ≥8, ≤72 | `current-password` |

**Состояния кнопки:** idle «Войти» → busy: спиннер + блокировка (`aria-busy` / `accessibilityState.busy`), повторная отправка невозможна.

**Ошибки API → текст:**
- 401 → «Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.»
- 400 + field details → ошибка под конкретным полем (маппинг `normalizeFieldName`)
- сетевая → «Не удалось связаться с сервером…»

**Переход:** успех → AuthContext/AuthGate устанавливает сессию → `<Navigate to="/">` (replace) / `phase='authed'`.

## 2. Экран «Регистрация» (register)

Поля сверху вниз: **Имя***, **Электронная почта***, **Телефон** (необязательно, подпись «необязательно»), **Пароль*** (≥8), **Подтверждение пароля*** (совпадение проверяется на blur обоих полей).

- Toggle показа пароля применяется к обоим password-полям сразу.
- 409 → «Эта почта уже зарегистрирована. Попробуйте войти.»
- Switch-mode ссылки внизу: «Нет аккаунта? Зарегистрироваться» ↔ «Уже есть аккаунт? Войти».

## 3. Дизайн-токены

Web: `apps/web/src/styles/auth.css` → переменные `tokens.css` (`--color-primary`, `--space-*`, `--radius-*`).
Mobile: `StyleSheet` только из `src/theme/tokens.ts` (`colors.*`, `spacing.*`, `radius.*`, `typography.*`, `layout.minTouchTarget`). Хардкод-hex в экранах запрещён правилом Sprints.

## 4. WCAG AA checklist

- [x] Touch target ≥44px (M) / ≥48px высота полей (W).
- [x] Контраст text-on-surface ≥4.5:1 (slate900/slate600 на white; onPrimary #fff на teal600).
- [x] Visible focus ring (W), никаких `outline:none` без замены.
- [x] Метки полей связаны: W `label htmlFor` + `aria-describedby` на ошибку; M `accessibilityLabel`.
- [x] Ошибки: баннер `role="alert"` / `accessibilityLiveRegion="polite"` + live-сводка (W).
- [x] Ошибка ≠ только цвет: текст + красная рамка + иконка (W).
- [x] Кнопка loading: `aria-busy`, disabled, текстовая подсказка состояния.
- [x] `autocomplete`/`textContentType` для passkey/менеджеров паролей.
- [x] Шрифт полей ≥16px — нет zoom-ловушки на iOS.

## 5. Тексты ошибок (единый словарь, web+mobile mirror)

Файлы `validation/auth.ts` идентичны по правилам и строкам; при изменении — синхронизировать оба.

| Ключ | Текст |
|---|---|
| email empty | Укажите электронную почту. |
| email format | Укажите корректный адрес, например name@example.com. |
| password empty (login/reg) | Введите пароль. / Придумайте пароль. |
| password length | Пароль должен содержать не менее 8 символов. |
| confirm empty / mismatch | Повторите пароль. / Пароли не совпадают. |
| firstName empty / long | Укажите имя. / Имя не должно превышать 80 символов. |
| phone format | Укажите корректный номер, например +7 900 123-45-67. |
| network | Не удалось связаться с сервером. Проверьте подключение… |

## 6. Что сознательно НЕ сделано

- Рефакторинг остальных экранов/компонентов — точечное улучшение UI/UX.
- Captcha, social login, 2FA — по требованию спринта.
- Изменение JSON-контрактов login — не потребовалось.
- Бинарные ассеты/архивы — иконки inline-SVG (W) и emoji-placeholder (M), system fonts.
