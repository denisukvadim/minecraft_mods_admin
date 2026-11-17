# HANDOFF — адмін-панель `admin-panel`

> Оновлено: **17.11.2026**. Документ передачі: поточний стан, архітектура, як
> запускати й перевіряти, відомі обмеження та план доробки. Користувацький опис і
> команди — у [`README.md`](README.md); тут — те, що потрібно, щоб **продовжити**.

## 1. Що це

SPA-панель адміністратора для [`../minecraftmods_backend`](../minecraftmods_backend).
Керує користувачами, ролями, каталогом правил і файлами модів, показує журнал дій.
Панель приймає **`admin`** і **`user`**: останній бачить Mods та Audit і може
створювати акаунти з точно таким самим доступом, як у нього.

| Шар       | Вибір                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| Framework | Angular 22.2 (standalone, signals, **zoneless** — без zone.js)                  |
| UI        | Angular Material 3 (тема `mat.theme`, зелена primary) + Roboto / Material Icons |
| Форми     | Reactive Forms, `nonNullable`                                                   |
| HTTP      | `HttpClient` + функціональний інтерсептор                                       |
| Тести     | Vitest через `ng test` (jsdom)                                                  |
| Мова UI   | англійська                                                                      |

Версії на момент передачі: Angular CLI **22.2.7**, Material **22.2.7**,
Node **26.13.1**, npm **12.2.2**, TypeScript ~6.0.

## 2. Стан на момент передачі

**Готово:**

- `/login` — email+пароль; сесію отримує `admin` або акаунт із `mods:read`, перевірка **до** збереження токена;
- `/forbidden` — якщо доступ до розділу зник під час сесії;
- `/mods` — список файлів, upload із прогресом (multipart), download, delete,
  **Download all** (один ZIP з усіх файлів), діалог історії по файлу; картка
  сервера Minecraft: статус (polling 10 с), Start/Stop/Restart, діалог логів
  (auto-refresh 5 с, 100/300/1000 рядків); upload і delete заблоковані, поки
  сервер запущений; кнопка **New user** для акаунтів із `users:create`
  (без вибору ролей);
- `/users` — список, створення, видалення, діалог `Manage` з трьома вкладками:
  профіль (кнопка Save), ролі (одразу), прямі права (одразу) + ефективні права;
- `/roles` — список, створення/редагування з чекбоксами прав по ресурсах,
  видалення (system-ролі захищені);
- `/permissions` — каталог `resource:action`, створення/видалення;
- `/audit` — журнал (`audit:read`), фільтр за точною назвою файлу, історія по кліку на файл;
- shell: sidenav, toolbar, меню користувача, handset-режим;
- спільні компоненти: `Pager`, `ConfirmDialog`, `NotifyService`, `apiErrorMessage`,
  `formatBytes`, `actorLabel`.

**Перевірено 17.11.2026:**

- `npm run build` — OK; initial ~313 kB (gzip ~86 kB), решта — lazy-чанки;
- `npm test -- --watch=false` — **5/5** у 2 файлах (`app.spec.ts`, `format.spec.ts`);
- smoke у headless Chrome на живому бекенді (див. розділ 7): рендер усіх сторінок,
  логін, створення/керування/видалення користувача, прямий grant `mods:upload`,
  діалоги історії та ролі, upload+delete реального файлу. Помилок консолі немає;
- тестові артефакти прибрані: у `data/mods` лишився лише реальний
  `trackwork-1.20.1-1.2.4.jar`, у журналі — лише рядок `id = 7`; тестовий
  користувач видалений; порти 8080/4200 вільні.

**Git:** тека не є git-репозиторієм (`.gitignore` уже є). Історії змін немає —
варто ініціалізувати git перед подальшою роботою.

## 3. Швидкий старт

Потрібен запущений бекенд на `http://localhost:8080`.

```bash
cd ~/work/personal/backend/minecraftmods_backend && cargo run

cd ~/work/personal/backend/admin-panel
npm install
npm start                      # http://localhost:4200
```

Dev-сервер читає `proxy.conf.json`: `/api` і `/docs` → `http://localhost:8080`.
Проксі підключений у `angular.json` (`architect.serve.options.proxyConfig`), тому
CORS для розробки не потрібен.

Вхід — адміністратором або акаунтом із роллю `user`; перший адмін створюється
бекендом зі змінних `ADMIN_*` у `.env` бекенду.

Продакшн-збірка:

```bash
npm run build                  # dist/admin-panel/browser
```

Хостингу потрібні fallback на `index.html` для всіх маршрутів і проксі `/api` на
бекенд. Якщо панель на іншому origin — змінити `apiBaseUrl` в
`src/environments/environment.ts` на абсолютний URL і перезібрати.

## 4. Архітектура фронтенду

```
src/
├── main.ts                     # bootstrapApplication(App, appConfig)
├── index.html                  # Roboto + Material Icons
├── styles.scss                 # тема Material 3, page/card/table/chip/form утиліти
├── environments/environment.ts # apiBaseUrl = '/api/v1'
└── app/
    ├── app.config.ts           # router, HttpClient + apiInterceptor, global errors
    ├── app.routes.ts           # lazy routes; authGuard на shell, adminGuard на розділи
    ├── app.ts                  # <router-outlet />
    ├── core/
    │   ├── auth.service.ts     # сигнал сесії, login/logout, refreshMe
    │   ├── api.interceptor.ts  # Bearer + 401 → logout
    │   ├── admin.guard.ts      # валідний токен + роль admin
    │   ├── models.ts           # типи 1:1 з DTO бекенду
    │   ├── api-error.ts        # { error, message } → текст
    │   ├── confirm-dialog.ts   # confirmAction(dialog, data)
    │   ├── pager.ts            # offset-пагінатор (input/output)
    │   ├── pagination.ts       # PAGE_SIZE=20, withHasMore(rows, pageSize)
    │   ├── format.ts           # formatBytes, actorLabel (+ spec)
    │   └── notify.service.ts   # snackbar success/error/info
    ├── layout/shell.*          # sidenav + toolbar + user menu
    └── features/
        ├── login/              # LoginPage
        ├── forbidden/          # ForbiddenPage
        ├── account/            # ChangePasswordDialog (меню акаунта)
        ├── mods/               # ModsPage + ModsService (+ картка сервера)
        ├── server/             # ServerService, ServerLogsDialog
        ├── users/              # UsersPage, CreateUserDialog, ManageUserDialog, UsersService
        ├── roles/              # RolesPage, RoleDialog, RolesService
        ├── permissions/        # PermissionsPage, PermissionDialog, PermissionsService
        └── audit/              # AuditPage, HistoryDialog, AuditService
```

**Ключові механізми:**

- **Zoneless.** У `package.json` немає `zone.js`, поліфілів у `angular.json` теж
  немає — застосунок працює без zone.js. Стан — сигнали (`signal`, `computed`,
  `input`, `output`), тому після `await` достатньо оновити сигнал;
  `ChangeDetectorRef` не потрібен. Не покладайтеся на мутацію звичайних полів у
  шаблоні — вона не запустить рендер.
- **Сесія.** `AuthService` тримає `signal<Session | null>`, зберігає його в
  `localStorage` під ключем `minecraft-mods-admin.session`
  (`{ token, expiresAt, me }`). Під час логіну спершу викликається `/auth/me`, і
  токен не зберігається, якщо немає ні `admin`, ні `mods:read`.
- **Інтерсептор.** Додає `Authorization` лише до URL, що починаються з
  `environment.apiBaseUrl`. На `401` (крім `/auth/login`) чистить сесію й веде на
  `/login?returnUrl=…`.
- **Guards.** `authGuard` перевіряє лише живу сесію; `permissionGuard(code)` —
  динамічне право (Mods → `mods:read`, Audit → `audit:read`); `adminGuard` —
  системну роль `admin` (Users/Roles/Permissions). Порушення → `/login` або
  `/forbidden`.
- **Меню.** `Shell.navItems` — `computed`, який фільтрує розділи за
  `isAdmin()`/`can(permission)`; акаунт `user` бачить Mods та Audit.
- **Пагінація.** List-ендпоінти не віддають total, тому сторінка запитує
  `PAGE_SIZE + 1`, а `withHasMore` відрізає зайвий рядок і каже, чи є наступна.
  Якщо видалили останній рядок останньої сторінки, `ModsPage` відкочує offset.
- **Діалоги.** Дані й результат типізовані через `MatDialog.open<C, D, R>`.
  `confirmAction()` повертає `true` лише після підтвердження.
- **Помилки.** Усі сервіси кидають `HttpErrorResponse`; сторінки ловлять і
  показують `apiErrorMessage(error)` через snackbar.

## 5. API, який використовує панель

| Екран       | Виклики                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| логін       | `POST /auth/login`, `GET /auth/me`                                                             |
| shell       | `GET /auth/me` (refreshMe на старт); `PUT /auth/password` (діалог зміни пароля)                 |
| mods        | `GET /mods`, `POST /mods`, `GET /mods/archive`, `GET /mods/{name}/download`, `DELETE /mods/{name}` |
| server      | `GET /server/status`, `POST /server/{start,stop,restart}`, `GET /server/logs`                   |
| users       | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}`                                              |
| manage      | `POST/DELETE /users/{id}/roles/{roleId}`, `POST/DELETE /users/{id}/permissions/{permissionId}` |
| roles       | `GET/POST /roles`, `GET/PATCH/DELETE /roles/{id}`, `PUT /roles/{id}/permissions`               |
| permissions | `GET/POST /permissions`, `DELETE /permissions/{id}`                                            |
| audit       | `GET /mod-actions` (`audit:read`), `GET /mods/{name}/history`                                  |

Усі шляхи — з префіксом `environment.apiBaseUrl` (`/api/v1`). Помилки бекенду:
`{ error, message }`; пагінація — `?limit=&offset=`; імена файлів у шляху
кодуються через `encodeURIComponent`.

## 6. Поведінкові рішення (не змінювати випадково)

- **Пароль змінюється самостійно**: меню акаунта → **Change password** →
  `PUT /auth/password` з поточним і новим паролем, бекенд перевіряє поточний.
  Хибний поточний дає `400`, а не `401`, тому інтерсептор не вибиває з сесії.
  Інші сесії не відкликаються — токени живуть до `exp`.
- **Ролі й прямі права застосовуються одразу** — перемикач робить запит і
  перечитує користувача; кнопки «зберегти» немає. Профіль зберігається кнопкою.
- **Панель пускає `admin` і акаунти з `mods:read`**: перевірка до запису в
  `localStorage`. Не-адмін бачить Mods та Audit; решта маршрутів закрита guard-ом.
- **`/forbidden` замість `/login`**, якщо креденшели валідні, але доступу до
  розділу (або панелі взагалі) вже немає.
- **Створення користувача не-адміном** не показує вибір ролей: бекенд копіює
  `user_roles` і `user_permissions` творця. Спроба передати `roles` → `400`.
- **401 на `/login` не очищає сесію** — інакше невірний пароль виглядав би як
  «сесія закінчилась».
- **Видалення підтверджується** і є незворотним; для користувача діалог пояснює,
  що історія втратить ім'я (backend зберігає лише `user_id`).
- **Своєму акаунту не можна натиснути Delete** у списку (кнопка disabled), але
  роль `admin` з нього зняти можна — у діалозі є попередження.
- **System-ролі**: ім'я не редагується, видалення disabled; набір прав — можна.
- **Upload**: файл вибирається через прихований `<input type=file>`; прогрес
  показується окремим блоком; після успіху список перечитується з offset 0.
  nginx контейнера має `client_max_body_size` зі змінної `CLIENT_MAX_BODY_SIZE`
  (типово `128m`): без неї дефолтний 1 MB дає 413 ще до бекенду. Якщо підняли
  `MODS_MAX_UPLOAD_BYTES` на API, підніміть і це.
- **Download**: через `HttpClient` з `responseType: 'blob'`, щоб додався Bearer;
  потім тимчасовий object URL і `<a download>`.
- **Аудит**: фільтр — це **точна** назва файлу (history-ендпоінт), не підрядок.
  Порожній фільтр повертає загальний журнал.
- **Керування сервером**: статус опитується кожні 10 с (`setInterval` +
  `DestroyRef`), поки сторінка відкрита; під час дії кнопки блокуються. `503` від
  `/server/status` означає «Portainer не налаштований» — картка ховається,
  upload/delete лишаються доступними (як і на бекенді). Інші помилки статусу
  трактуються як «стан невідомий»: зміни файлів блокуються (fail-closed).
- **Stop/Restart підтверджуються** через `confirmAction`: гравців буде
  відключено; Stop лишає контейнер вимкненим до явного Start.
- **Логи** доступні лише для запущеного сервера; діалог сам опитує
  `/server/logs`, доки відкритий і ввімкнено Auto-refresh.

## 7. Перевірки

```bash
npm run build
npm test -- --watch=false
npx prettier --check "src/**/*.{ts,html,scss}"
```

### Смоук-скрипти

Оригінальні one-off скрипти збережено в [`scripts/smoke/`](scripts/smoke), щоб їх
не втратити після очищення `/tmp`. Вони працюють через Chrome DevTools Protocol і
**не** є частиною `ng test`; запускати вручну на живому бекенді.

Підготовка:

```bash
# 1. бекенд і панель запущені (8080, 4200)
# 2. headless Chrome з CDP на 9223
rm -rf /tmp/opencode/chrome-admin
nohup google-chrome-stable --headless=new --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port=9223 \
  --user-data-dir=/tmp/opencode/chrome-admin --window-size=1440,900 \
  about:blank > /tmp/opencode/chrome.log 2>&1 &
# дочекатися: curl -sf http://127.0.0.1:9223/json/version
```

Запуск (потрібні креденшели адміна; скрипти читають їх з env):

```bash
cd ~/work/personal/backend/admin-panel

ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke/check-admin.mjs
node scripts/smoke/check-ui.mjs
node scripts/smoke/check-upload.mjs
```

Що перевіряють:

| Скрипт             | Сценарій                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-admin.mjs`  | рендер `/login`, вхід через API + сесія в `localStorage`, рендер `/mods`, `/users`, `/roles`, `/permissions`, `/audit`, відсутність помилок сторінки |
| `check-ui.mjs`     | створення користувача через форму, прямий grant `mods:upload` у `Manage`, видалення користувача, діалог історії файлу, діалог ролі                   |
| `check-upload.mjs` | генерація 4 KiB файлу, upload через справжній `<input type=file>`, поява в таблиці, видалення через UI                                               |

**Важливо:** скрипти містять очікування, прив'язані до поточної БД —
`trackwork-1.20.1-1.2.4.jar`, `admin@example.com`, наявність `mods:upload` у
каталозі. Якщо стан зміниться, відредагуйте константи у скриптах.

Прибирання після смоуку:

```sql
-- check-upload лишає два рядки журналу (upload + delete)
DELETE FROM mod_file_actions WHERE file_name = 'ui-upload-test.jar';
```

Якщо `check-ui` упав посеред сценарію, у БД може лишитися користувач із
email `ui-smoke-<timestamp>@example.com` — видаліть його через панель або API.
Реальний файл `trackwork-1.20.1-1.2.4.jar` і рядок журналу `id = 7` не видаляти.

Після смоуку зупиніть Chrome і dev-сервер, інакше порти 9223/4200 будуть зайняті.

## 8. Відомі обмеження / технічний борг

- **Download all буферизує ZIP у пам'яті браузера** (`responseType: 'blob'`), бо
  Bearer-токен не можна додати до звичайного `<a download>`. Для великих
  `MODS_DIR` це пік пам'яті на весь архів; за потреби — підписаний одноразовий URL.
- **Немає dashboard/home**: `/` редіректить на `/mods`.
- **Немає i18n**: UI англійською, рядки захардкоджені в шаблонах.
- **Немає перемикача теми**: світла тема Material 3; dark mode не підключений.
- **Токен у `localStorage`**: доступний будь-якому JS; прийнятно лише для
  довіреного статичного бандла + HTTPS у проді. Refresh-токенів бекенд не видає —
  після `JWT_TTL_MINUTES` (60) потрібен повторний вхід.
- **Пагінація offset-only**, без total; сортування/пошук на сервері відсутні.
  Фільтр аудиту — точна назва файлу.
- **Немає «replace» для моду**: повторний upload дає `409`, треба спершу видалити.
- **Логи лише polling-ом**, без SSE/WebSocket; `tail` обмежений 1000 рядків, історію
  старішу за останній хвіст з панелі не видно.
- **Статус сервера — додатковий запит до бекенду** кожні 10 с; без Portainer
  картка не показується.
- **Route-level гейтинг є**: `authGuard` на shell, `permissionGuard('mods:read')`
  на Mods, `permissionGuard('audit:read')` на Audit, `adminGuard` на
  Users/Roles/Permissions. Усередині Mods кнопки додатково прив'язані до
  `mods:upload/download/delete`, `server:manage`, `users:create`.
- **Тестів мало**: 8 unit-тестів (`App`, `format`, `apiErrorMessage`); сервіси,
  діалоги й сторінки не покриті. E2E — лише ручні скрипти вище, без CI.
- **Немає CI** (GitHub Actions тощо) і немає ESLint-конфігу — лише Prettier і `tsc`
  через `ng build`.
- **Snackbar-стилі** залежать від внутрішніх класів Material
  (`.mdc-snackbar__surface`); при оновленні Material перевірити.
- **Початковий бандл ~313 kB** — прийнятно, але нові залежності варто додавати
  lazy-чанками.
- **Мобільний UX** базовий: sidenav over-mode, таблиці скролляться горизонтально.

## 9. Пропозиції для подальшої доробки

1. **E2E у CI**: перенести сценарії зі `scripts/smoke` на Playwright, підняти
   бекенд+БД у docker compose і ганяти на кожен PR. Найбільша прогалина.
2. **Dashboard**: кількість файлів/користувачів, останні дії, розмір `MODS_DIR`.
   Потребує або нових ендпоінтів, або кількох існуючих викликів.
3. **i18n (uk/en)** через `@angular/localize` або власний `Transloco`; винести
   рядки з шаблонів.
4. **Dark mode**: `mat.theme` з `color-scheme: dark` + перемикач у toolbar,
   збереження вибору в `localStorage`.
5. **Серверний пошук/сортування/total** — спільно з бекендом; після цього
   замінити `limit+1`-пагінацію на звичайний `MatPaginator`.
6. **Replace-upload**: `PUT /mods/{name}` або видалення+upload в один крок із
   підтвердженням.
7. **Керування сесією**: `token_version`/refresh на бекенді + тихе продовження
   сесії та попередження за кілька хвилин до `exp`.
8. **Експорт аудиту** в CSV із поточними фільтрами.
9. **Більше ніж одна не-адмінська роль** у UI: зараз навігація і кнопки Mods
   перевіряють відомі permissions; для нових екранів варто додати декларативний
   реєстр «розділ → permission».
10. **Доступність**: перевірити focus-trap у діалогах, `aria-label` на іконкових
    кнопках (частина вже є), контраст тем.

## 10. Файли-орієнтири

- `src/app/core/auth.service.ts` — сесія, перевірка admin, refresh, logout;
- `src/app/core/api.interceptor.ts` — Bearer і реакція на 401;
- `src/app/core/models.ts` — єдине місце, де змінювати типи під зміни DTO бекенду;
- `src/app/core/pagination.ts`, `pager.ts` — модель пагінації;
- `src/app/features/users/manage-user-dialog.ts` — найскладніший екран (ролі,
  прямі права, профіль, self-warning);
- `src/app/features/mods/mods-page.ts` + `mods.service.ts` — upload/download/delete;
- `src/app/features/server/server.service.ts` — `/server/*`;
- `src/app/features/server/server-logs-dialog.ts` — діалог логів;
- `src/app/features/audit/history-dialog.ts` — спільний діалог історії;
- `src/styles.scss` — тема й утиліти (`page`, `card`, `data-table`, `chip`, …);
- `proxy.conf.json`, `angular.json` — dev-проксі;
- `scripts/smoke/*.mjs` — ручні E2E-сценарії.

## 11. Пастки

- **Angular zoneless**: після асинхронних операцій оновлюйте сигнали, а не звичайні
  поля; інакше UI не перерендериться.
- **Не зберігайте токен до перевірки `/auth/me`** — інакше акаунт без
  `admin`/`mods:read` отримає сесію.
- **401 на логіні** не повинен чистити сесію/редіректити — це просто невірні дані.
- **`localStorage`-ключ** `minecraft-mods-admin.session` змінюється лише разом із
  міграцією/очищенням у `AuthService`; інакше старі сесії «застрягнуть».
- **`limit + 1`** — свідомий контракт із бекендом; не замінюйте на `limit`, поки
  list-ендпоінти не почнуть віддавати total.
- **Видалення користувача** анонімізує його історію на бекенді; у діалозі це
  написано, і це не баг фронтенду.
- **Роль `user`** отримує свій базовий набір із бекенду (міграції `0002`–`0003`):
  моди, сервер, `users:create`, `audit:read`. Не «лагодьте» це в UI — змінюйте
  права через Roles.
- **Prettier** форматує і шаблони, і SCSS; після ручних правок запускайте
  `npx prettier --write`, щоб `--check` не падав.
- **Smoke-скрипти** залежать від поточних даних і вільної 9223/4200; не запускайте
  паралельно з іншим Chrome на тому ж порту.

## 12. Чеклист «перший день» після повернення

- [ ] підняти бекенд (`cargo run`) і панель (`npm start`);
- [ ] `npm run build` і `npm test -- --watch=false`;
- [ ] залогінитися адміном, пройти `/mods`, `/users`, `/roles`, `/permissions`,
      `/audit`;
- [ ] переконатися, що реальний файл `trackwork-1.20.1-1.2.4.jar` на місці;
- [ ] за потреби ініціалізувати git і закомітити поточний стан;
- [ ] вибрати пункт із розділу 9 (рекомендовано E2E у CI) і почати з тестів.
