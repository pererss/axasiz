# 🎁 Gifts Stars — Telegram Mini App

Полноценное Telegram Mini App: выбор подарка (15 / 25 / 50 / 100 ⭐) → выполнение заданий
с **реальной серверной проверкой** → 7-дневное ожидание (серверный таймер) → заявка
в личку через `t.me/...?text=...`. Плюс полноценная админ-панель.

Стек: **Next.js 14 + TypeScript + PostgreSQL (Supabase/Vercel) / JSON-файл для локалки**,
чистый CSS (Glassmorphism / Liquid Glass, светлая праздничная тема), Telegram Bot API.

## Структура

- `app/page.tsx` — Mini App: ровно 3 экрана (выбор → задания → ожидание) с горизонтальной анимацией.
- `app/admin/page.tsx` — админ-панель (подарки, задания, пользователи, заявки, настройки, рассылки).
- `app/api/state` — единый снапшот (пользователь, подарки, задания, прогресс, рефералы, серверное время).
- `app/api/select-gift`, `app/api/tasks/verify`, `app/api/waiting/start`, `app/api/claim` — игровая логика.
- `app/api/bot` — webhook бота (`/start`, рефералы `ref_<id>`, приветствие с кнопкой Mini App).
- `app/api/admin` — CRUD подарков/заданий/настроек + рассылки (только `TELEGRAM_ADMIN_IDS`).
- `lib/core.ts` — типы, сиды, валидация `initData` (HMAC-SHA256 по документации Telegram).
- `lib/db.ts` — хранилище: PostgreSQL при `DATABASE_URL`, иначе локальный `.data/db.json`.
- `lib/logic.ts` — проверки заданий (`getChatMember`, рефералы, ручная модерация), ревалидация.
- `lib/auth.ts` — серверная аутентификация по `initData` (подделка Telegram ID невозможна).

## Переменные окружения

Скопируй `.env.example` в `.env.local` (локально) и задай те же в Vercel:

| Переменная | Обязательно | Описание |
|---|---|---|
| `BOT_TOKEN` | ✅ | Токен бота от @BotFather |
| `MINI_APP_URL` | ✅ | Публичный URL, напр. `https://gift-xxx.vercel.app` |
| `BOT_USERNAME` | ✅ | Username бота без @ (для реферальных ссылок) |
| `TELEGRAM_ADMIN_IDS` | ✅ | ID админов через запятую, напр. `123,456` |
| `DATABASE_URL` | ✅ (прод) | Postgres (Supabase). Локально можно пустым — используется `.data/db.json` |
| `WEBHOOK_SECRET` | — | Секрет для `setWebhook secret_token` |
| `ALLOW_DEV_AUTH` | локально | `true` разрешает `?tg_id=...` без Telegram. **В проде пусто/false** |

## Запуск локально

```bash
npm install
cp .env.example .env.local   # заполнить BOT_TOKEN и др.
npm run dev                  # http://localhost:3000?tg_id=123 — dev-режим
```

## Деплой на Vercel

1. Залей репозиторий на GitHub, импортируй в Vercel.
2. Задай все переменные окружения (см. таблицу). `DATABASE_URL` — из Supabase
   (создай проект, возьми Connection String; таблицы создаются автоматически).
3. Deploy. Получишь `MINI_APP_URL` → впиши его же в переменные и передеплой.
4. Подключи Mini App и webhook:

```bash
# Кнопка Menu / webhook бота (подставь значения):
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<MINI_APP_URL>/api/bot&secret_token=<WEBHOOK_SECRET>"
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🎁 Подарки","web_app":{"url":"<MINI_APP_URL>"}}}'
```

5. В @BotFather: `/newapp` (или `/editapp`) → укажи URL Mini App.
6. Бота сделай **администратором** канала/группы из заданий — иначе `getChatMember`
   не сможет проверять других пользователей.
7. Напиши боту `/start` → придёт приветствие с кнопкой «🎁 Выбрать подарок».
8. Админ-панель: `<MINI_APP_URL>/admin` (доступ только для `TELEGRAM_ADMIN_IDS`;
   в dev-режиме — `/admin?tg_id=твой_ID`).

## Ключевая логика

- Проверка подписок — только `getChatMember` на сервере; клик по ссылке ≠ выполнение.
- Временные ошибки Telegram **не наказывают** пользователя (fail-open с честным сообщением);
  **доказанный** выход из канала во время ожидания → статус `violated`, заявка блокируется,
  после восстановления всех условий период **начинается заново** автоматически.
- Рефералы: засчитывается только первый `/start` нового пользователя; самоприглашения
  и дубликаты игнорируются.
- Таймер считается от **серверного времени** (`serverNow` + смещение на клиенте, тик каждую секунду).
- Сторонний бот / внешняя ссылка: надёжной автопроверки через Bot API нет —
  такие задания помечены «ручная модерация» (клик + пауза + подтверждение).
- Заявка: кнопка активна только после периода + успешной перепроверки; открывает
  `https://t.me/<claimUsername>?text=<URL-encoded>`; статус «отправлено» не рисуется,
  т.к. отправку подтверждает сам пользователь в Telegram.

## Что проверено локально (без секретов)

Сборка `next build` ✅. E2E через dev-режим (`?tg_id=`):
выбор подарка сохраняется; ручные задания (клик → пауза → проверка);
подписка без токена даёт временную ошибку, а не галочку;
рефералы 2/3 (дубликат и самоприглашение отсеяны);
`waiting/start` отклонён при незавершённых заданиях;
`claim` заблокирован до срока; happy-path: `eligible:true` + корректный `claimUrl`;
админка отдаёт 403 обычному пользователю; webhook возвращает 200 без падений.

## Фото подарков (лицензии)

Реальные фото в `public/gifts/` — свободные лицензии Creative Commons (Flickr через Openverse),
хотлинк не используется, файлы лежат локально:

- `g15.jpg` — Teddy bear, CC BY-SA (flickr)
- `g25.jpg` — Gift box with red ribbon, CC BY-SA (Rae Wallis / Flickr)
- `g50.jpg` — Christmas gifts under the tree, CC BY (Flickr)
- `g100.jpg` — Treasure chest with jewels, CC BY (Tom Praison / Flickr)

При замене фото сохраняйте условия лицензий CC BY / BY-SA (указание автора).

## Что осталось предоставить для запуска

1. `BOT_TOKEN` (от @BotFather).
2. `BOT_USERNAME` (имя бота).
3. `TELEGRAM_ADMIN_IDS` — твой числовой Telegram ID (узнать: @userinfobot).
4. `DATABASE_URL` — Postgres (Supabase) для продакшена.
5. `MINI_APP_URL` — появится после деплоя на Vercel (затем прописать в BotFather + webhook).
6. `claimUsername` — Telegram-профиль для заявок (задаётся в админ-панели → Настройки).
7. Реальные ссылки каналов/групп в заданиях + добавить бота туда администратором.
#   a x a s i z  
 