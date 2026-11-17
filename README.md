# Minecraft Mods Admin

SPA-панель адміністратора для [`minecraftmods_backend`](../minecraftmods_backend).
Керує користувачами, ролями, каталогом правил і файлами модів, показує журнал дій.

Стан проєкту, архітектура, смоук-скрипти й план доробки — у
[`HANDOFF.md`](HANDOFF.md).

| Шар             | Вибір                                                   |
| --------------- | ------------------------------------------------------- |
| Framework       | Angular 22 (standalone components, signals, zoneless)   |
| UI              | Angular Material 3 + Roboto / Material Icons            |
| Форми           | Reactive Forms                                          |
| HTTP            | `HttpClient` + функціональний інтерсептор (Bearer, 401) |
| Тести           | Vitest через `ng test`                                  |
| Мова інтерфейсу | англійська                                              |

## Швидкий старт

Потрібен запущений бекенд на `http://localhost:8080` (див. сусідню теку
`minecraftmods_backend`).

```bash
npm install
npm start          # http://localhost:4200
```

`npm start` піднімає dev-сервер із проксі: запити `/api/*` і `/docs` ідуть на
`http://localhost:8080` (див. `proxy.conf.json`), тому окремо налаштовувати CORS
для розробки не потрібно.

Увійти можна лише акаунтом із роллю **`admin`**. Перший адміністратор створюється
бекендом зі змінних `ADMIN_*` у `.env` бекенду.

## Збірка

```bash
npm run build      # dist/admin-panel/browser
```

SPA потребує двох речей на хостингу:

1. **fallback на `index.html`** для будь-якого шляху (`/mods`, `/users`, …), бо
   маршрути клієнтські;
2. **проксі `/api`** на бекенд (nginx `location /api { proxy_pass … }`,
   Traefik, Caddy) — тоді `environment.apiBaseUrl = '/api/v1'` працює як є.

Якщо панель відкривається з іншого origin без проксі, задайте абсолютну адресу в
`src/environments/environment.ts`:

```ts
export const environment = { apiBaseUrl: 'http://localhost:8080/api/v1' };
```

і перезберіть. Бекенд дозволяє cross-origin запити згідно з `CORS_ORIGINS`.

## Docker

`Dockerfile` збирає застосунок у два етапи (Node → nginx) і вже містить SPA-fallback
та проксі `/api` і `/docs`. Адреса бекенду задається змінною `BACKEND_URL`
(типово `http://backend:8080`):

```bash
docker build -t minecraft-mods-admin .
docker run -p 8080:80 -e BACKEND_URL=http://host.docker.internal:8080 minecraft-mods-admin
```

Docker Compose (поруч із сервісом бекенду):

```yaml
services:
  admin:
    image: ghcr.io/<owner>/<repo>:latest
    ports: ["8080:80"]
    environment:
      BACKEND_URL: http://backend:8080
```

### CI

`.github/workflows/docker.yml` на кожен пуш у `main` (а також на теги `v*` і
ручний запуск) збирає образ і публікує його в GitHub Container Registry:
`ghcr.io/<owner>/<repo>:latest` та `:sha-<commit>`. На pull request збірка
виконується без публікації. Окремих секретів не потрібно — використовується
`GITHUB_TOKEN`; якщо пакет приватний, перевірте доступ до нього в налаштуваннях
репозиторію (Packages).

## Екрани

| Шлях              | Що робить                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `/login`          | вхід email + пароль, перевірка ролі `admin`, повернення на `returnUrl`                      |
| `/mods`           | файли з `MODS_DIR`: список, upload з прогресом, download, delete, історія по файлу          |
| `/users`          | список акаунтів; створення, редагування профілю, активація, видалення                       |
| `/users → Manage` | ролі користувача, прямі permission-и, ефективні права                                       |
| `/roles`          | ролі з наборами прав; створення, редагування, видалення (системні — лише редагування прав)  |
| `/permissions`    | каталог правил `resource:action`: створення, видалення                                      |
| `/audit`          | журнал усіх дій з файлами; фільтр за точною назвою файлу; перехід до історії кліку по назві |
| `/forbidden`      | пояснення, якщо акаунт втратив роль `admin` під час сесії                                   |

Пагінація на `/mods`, `/users`, `/audit` — offset-based (`Pager`), бо list-ендпоінти
бекенду не повертають загальну кількість. Сторінка запитує `limit + 1` рядок, щоб
чесно показати, чи є наступна.

### Що важливо знати про поведінку

- **Ролі й прямі права застосовуються одразу**: перемикач у діалозі `Manage` робить
  запит і перечитує користувача, кнопки «зберегти» немає. Профіль (email, username,
  пароль, `is_active`) зберігається кнопкою.
- **Видалення незворотне**: файл мода, користувач, роль і permission видаляються
  одразу після підтвердження; для файлів і користувачів це ще й пише рядок у журнал.
- **Видалений користувач анонімізує історію**: журнал зберігає лише `user_id`, тому
  після `DELETE /users/{id}` минулі дії показуються як «deleted account». Якщо
  атрибуція потрібна назавжди — деактивуйте акаунт (`is_active: false`).
- **Системні ролі** `admin`/`user` не можна перейменувати чи видалити; набір прав
  редагується. Бекенд на кожному старті повертає `admin` увесь каталог правил.
- **Ліміт upload** визначає бекенд (`MODS_MAX_UPLOAD_BYTES`, типово 128 MiB);
  перевищення повертає `413`, і панель показує повідомлення бекенду.

## Авторизація

- JWT зберігається в `localStorage` під ключем `minecraft-mods-admin.session`
  разом із `expires_at` і профілем `/auth/me`.
- Під час входу панель спершу перевіряє роль через `/auth/me`: валідний не-адмін
  не отримує сесію в панелі.
- Інтерсептор додає `Authorization: Bearer …` до запитів `/api/*`. На `401`
  сесія очищається і відкривається `/login?returnUrl=…`; на `/login` цього немає,
  щоб помилка пароля не виглядала як «сесія закінчилась».
- Refresh-токенів бекенд не видає: після `JWT_TTL_MINUTES` (типово 60) потрібен
  повторний вхід.
- `Shell` один раз на старт викликає `/auth/me`, щоб підхопити зміни ролей без
  повторного логіну; якщо роль `admin` зникла — редірект на `/forbidden`.

## Структура

```
src/app/
├── app.config.ts          # провайдери: router, HttpClient + interceptor
├── app.routes.ts          # lazy-завантаження сторінок, adminGuard на shell
├── app.ts                 # <router-outlet />
├── core/
│   ├── auth.service.ts    # сесія, login/logout, refresh /auth/me
│   ├── api.interceptor.ts # Bearer + реакція на 401
│   ├── admin.guard.ts     # токен + роль admin
│   ├── models.ts          # типи 1:1 з DTO бекенду
│   ├── api-error.ts       # { error, message } → текст для оператора
│   ├── confirm-dialog.ts  # спільний діалог підтвердження
│   ├── pager.ts           # offset-пагінатор
│   ├── pagination.ts      # PAGE_SIZE + limit+1
│   ├── format.ts          # розмір файлу, підпис автора дії
│   └── notify.service.ts  # snackbar
├── layout/shell.*         # sidenav, toolbar, меню користувача
├── features/login/
├── features/forbidden/
├── features/mods/         # список/upload/download/delete + mods.service
├── features/users/        # список, create/manage діалоги, users.service
├── features/roles/        # список, role-dialog з чекбоксами прав
├── features/permissions/  # список, permission-dialog
└── features/audit/        # журнал, history-dialog
```

## Перевірки

```bash
npm run build
npm test -- --watch=false
npx prettier --check "src/**/*.{ts,html,scss}"
```

Смоук-тест на живому бекенді (headless Chrome через DevTools Protocol) перевіряв:

- рендеринг `/login`, `/mods`, `/users`, `/roles`, `/permissions`, `/audit`;
- вхід реальним адміном і підхоплення сесії з `localStorage`;
- створення користувача через форму, перемикання прямого `mods:upload`,
  появу права в «effective permissions», видалення користувача;
- діалог історії файлу з рядком `upload` і автором;
- діалог ролі з каталогом прав;
- upload файлу через справжній `<input type=file>` і його видалення.

Помилок у консолі сторінки не було. Тестові файли й рядки журналу після перевірки
прибрані.

## Безпека

- Токен у `localStorage` доступний будь-якому JS на сторінці: панель не повинна
  підключати сторонні скрипти, а працювати має лише через HTTPS у проді.
- Панель не є публічною: усі її маршрути вимагають роль `admin`, але сам застосунок
  статичний, тож обмеження доступу до нього — це роль у бекенді, а не «прихований
  URL». За потреби закрийте весь хост basic-auth або VPN.
- `CORS_ORIGINS=*` у бекенді зручний для розробки; у проді задайте конкретний origin
  панелі.
