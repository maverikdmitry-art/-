# ARCHITECTURE.md — Финансовый трекер (OoverrFinancee)

Документ описывает фактическую архитектуру кода: стек, структуру монорепозитория, слои, потоки данных и правила разработки.
Схема БД вынесена в отдельный файл: [`DATABASE.md`](./DATABASE.md). Порядок разработки — в [`ROADMAP.md`](./ROADMAP.md), правила для ИИ — в [`PROJECT_RULES.md`](./PROJECT_RULES.md).

> **Статус реализации.** Этот документ описывает **текущий код** (TypeScript/React/Vite + Supabase + Gemini), а не первоначальный Python-план. Из трёх частей системы сейчас готов веб-дашборд (`apps/web`) и общий пакет (`packages/shared`); Telegram-бот (`apps/bot`) и подключение дашборда к Supabase — в работе (см. разделы 3 и 12).

---

## 1. Обзор

Система из трёх частей, связанных через облачную БД:

```
┌──────────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│  Telegram-бот        │ ─────► │  Supabase            │ ◄───── │  Веб-дашборд (React)│
│  (GrammY, быстрый    │        │  (PostgreSQL + Auth  │        │  Vite + TypeScript  │
│   ввод текстом/      │ ◄───── │   + Realtime + RLS)  │ ─────► │  полное управление) │
│   голосом)           │        └──────────────────────┘        └─────────────────────┘
└──────────┬───────────┘
           │
           ▼
     Google Gemini (LLM-парсер + распознавание голоса)
```

| Часть | Роль | Хостинг | Статус |
|---|---|---|---|
| **Бот** (`apps/bot`) | Мобильный шлюз: ввод текстом/голосом, `/today`, `/balance`, `/stats`, уведомления | Render / Railway (24/7, $0) | ⏳ не начат (ROADMAP 1.7+) |
| **БД** (Supabase) | Единственный источник правды | Supabase free tier | ✅ схема готова (`supabase/schema.sql`), клиенты и мапперы в shared |
| **Дашборд** (`apps/web`) | Полное управление: обзор/доходы/транзакции/борд/календарь/счета/цели/регулярные/категории/бот-симулятор/настройки | Локально (`npm run dev:web`) | ✅ работает, сейчас на `localStorage` |

**Ключевой принцип:** бот и дашборд **не общаются напрямую** — только через БД (Supabase). Любой из них можно перезапустить/переписать независимо. Общая бизнес-логика (деньги, время, формулы, парсер) живёт в `packages/shared` и переиспользуется обеими частями — «один код, два потребителя».

---

## 2. Технологический стек

- **Язык:** TypeScript (strict), Node.js 20+.
- **Сборка монорепозитория:** npm workspaces (`packages/*`, `apps/*`).
- **Дашборд:** React 19 + Vite 8 + Tailwind CSS 4 (`@tailwindcss/vite`), иконки `lucide-react`, анимации `motion`.
- **БД:** Supabase (PostgreSQL + Auth + Realtime + RLS), клиент `@supabase/supabase-js`.
- **Бот:** GrammY (`@grammyjs/*`) — планируется в `apps/bot`.
- **LLM / STT:** Google Gemini через `@google/genai` (LLM-парсер и распознавание голоса). Один ключ на всё.
- **Деньги:** `decimal.js` (никакого `float`), в БД `numeric(14,2)`.
- **Время:** хранение в UTC (`timestamptz`), но «сутки/неделя/месяц» считаются по **Europe/Kyiv** через `date-fns` + `date-fns-tz`.
- **Валидация ответов LLM:** `zod` (проверка JSON от Gemini перед использованием).
- **Конфиги:** корневой `.env` для секретов (шаблон — `.env.example`); несекретные настройки — в таблице `settings`.

---

## 3. Структура монорепозитория

```
OoverrFinancee/
├── .env.example            # шаблон секретов (копия → .env, в git не попадает)
├── package.json            # корневой: workspaces + скрипты dev/build/typecheck
├── ARCHITECTURE.md         # этот файл
├── DATABASE.md             # схема и формулы БД
├── PROJECT_RULES.md        # правила для ИИ-ассистента
├── ROADMAP.md              # пошаговый план разработки
│
├── apps/
│   ├── web/                # @oover/web — веб-дашборд (React + Vite)
│   │   ├── index.html
│   │   ├── vite.config.ts  # envDir = корень, алиас @oover/shared → исходники
│   │   └── src/
│   │       ├── main.tsx    # точка входа (createRoot)
│   │       ├── App.tsx     # корневой компонент: табы, store, модалки, тосты
│   │       ├── types/index.ts         # реэкспорт типов из @oover/shared
│   │       ├── services/
│   │       │   ├── storage.ts         # store в localStorage, seed, экспорт CSV/JSON
│   │       │   ├── calculations.ts    # реэкспорт формул из @oover/shared
│   │       │   └── parser.ts          # тонкая обёртка над regex-парсером из shared
│   │       ├── views/                 # по одному экрану на вкладку
│   │       │   ├── OverviewView.tsx   # Net Worth, Safe-to-spend, сравнение с месяцем
│   │       │   ├── IncomeView.tsx
│   │       │   ├── TransactionsView.tsx  # таблица, фильтры, поиск, массовое ред.
│   │       │   ├── BoardView.tsx      # Kanban
│   │       │   ├── CalendarView.tsx   # суммы по дням
│   │       │   ├── AccountsView.tsx   # счета, стартовые остатки
│   │       │   ├── GoalsView.tsx      # цели накопления
│   │       │   ├── RecurringView.tsx  # регулярные платежи
│   │       │   ├── CategoriesView.tsx # категории и группы
│   │       │   ├── BotSimulatorView.tsx  # симуляция ввода как в боте
│   │       │   └── SettingsView.tsx   # курс USD, экспорт, сброс тестовых данных
│   │       └── components/            # переиспользуемый UI
│   │           ├── Navbar.tsx         # вкладки, фильтр по пользователю, быстрый ввод
│   │           ├── TransactionModal.tsx
│   │           ├── TransferModal.tsx  # переводы между счетами
│   │           ├── RevisionModal.tsx  # сверка/корректировка баланса
│   │           ├── GoalContributionModal.tsx
│   │           └── QuickBotInputModal.tsx   # быстрый ввод через парсер
│   │
│   └── bot/                # @oover/bot — Telegram-бот (GrammY) — ⏳ ПОКА НЕ СОЗДАН
│
├── packages/
│   └── shared/             # @oover/shared — общий код для web и bot
│       └── src/
│           ├── index.ts            # единая точка реэкспорта
│           ├── types.ts            # канонические типы (1-в-1 со схемой БД)
│           ├── money.ts            # decimal.js: округление, сумма, USD→UAH, формат
│           ├── time.ts             # Europe/Kyiv: границы суток, диапазоны
│           ├── calculations.ts     # балансы, Net Worth, Safe-to-spend, сравнение
│           ├── parser/
│           │   ├── index.ts        # каскад parseInput: Gemini → regex → needs_review
│           │   └── regex.ts        # офлайн-парсер: сумма, валюта, тип, категория, счёт
│           ├── gemini/
│           │   ├── client.ts       # createGeminiClient(apiKey)
│           │   ├── parse.ts        # parseWithGemini → JSON (zod-валидация)
│           │   └── transcribe.ts   # transcribeAudio: голос → текст
│           └── supabase/
│               ├── client.ts       # createBrowserClient (anon) / createServerClient (service_role)
│               └── mappers.ts      # строки БД → типизированные модели (numeric → number)
│
└── supabase/
    └── schema.sql          # DDL + seed + RLS + Realtime (применить в SQL Editor)
```

### Правила зависимостей (слои)

```
apps/web  ─┐
           ├──►  packages/shared  ──►  Supabase (PostgreSQL)
apps/bot  ─┘        (типы, деньги, время, формулы, парсер, клиенты/мапперы БД)
```

---

## 4. Пакет `@oover/shared` (единый источник правды)

| Файл | Ответственность |
|---|---|
| `types.ts` | Типы `User`, `Account`, `Category`, `Transaction`, `Transfer`, `Goal`, `RecurringPayment`, `AppSettings`, `AppStore` — совпадают со схемой БД. |
| `money.ts` | `toDecimal`, `round2`, `sumMoney`, `convertToUah` (USD→UAH по курсу), `formatMoney` (₴/$). Только decimal.js. |
| `time.ts` | `todayYmd`, `startOfDay/endOfDay`, `rangeForPreset` (today/yesterday/week/month/prev_month/all), `daysBetweenYmd`. Часовой пояс по умолчанию `Europe/Kyiv`. |
| `calculations.ts` | `calculateAccountBalance`, `calculateNetWorth`, `calculateSafeToSpend`, `calculateMonthComparison`, `pendingRecurring`. |
| `parser/index.ts` | `parseInput` — каскад: если передан Gemini-слой → пробуем LLM, при любой ошибке (`onLlmError`) → regex. Ввод не теряется. |
| `parser/regex.ts` | `parseWithRegex` — синонимы категорий, ключевые слова дохода, определение валюты и счёта. Без интернета. |
| `gemini/parse.ts` | `parseWithGemini` — JSON-схема ответа + zod-валидация; при низкой уверенности `< 0.5` → `needs_review`. |
| `gemini/transcribe.ts` | `transcribeAudio` — аудио (base64) → текст; файл нигде не сохраняется. |
| `supabase/client.ts` | `createBrowserClient` (anon + RLS) для дашборда; `createServerClient` (service_role) для бота. |
| `supabase/mappers.ts` | Приведение строк БД (numeric приходит строкой) к типам: `mapUser`, `mapTransaction` и т.д. |

---

## 5. Веб-дашборд (`apps/web`)

- **Точка входа:** `src/main.tsx` → `App.tsx`. Состояние — объект `AppStore` (`useState`), который **перечитывается из Supabase** после каждого изменения. Единый источник правды — БД (RLS, только для авторизованных).

---

## 6. Ключевые потоки

### 6.1. Ввод траты текстом (бот — планируется; в дашборде — «Быстрая операция»)

```
Текст «кофе 150 мак»
  → auth: ID в whitelist? (бот; нет → игнор)
  → idempotency: (telegram_chat_id, telegram_message_id) уже обработан? (да → стоп)
  → parseInput (shared):
       gemini? → parseWithGemini (JSON + zod)
         └ сбой/низкая уверенность → parseWithRegex (фоллбэк)
         └ не распознана сумма → status = needs_review
  → предлагается последний использованный счёт (можно сменить)
  → превью: [Изменить] [Отмена] [Сохранить ✅]  (если confirm_enabled)
  → запись транзакции (идемпотентная вставка)
  → уведомление партнёру (если включено) + проверка дневного лимита (≤ overspend_alert_pct%)
```

> В дашборде Gemini-слой намеренно не подключается (ключ не должен попадать в бандл) — «Быстрая операция» использует только `parseWithRegex`. Полный каскад `Gemini → regex → needs_review` предназначается боту.

### 6.2. Голосовое сообщение (бот)
`голос (base64) → transcribeAudio (Gemini) → текст → файл не сохраняется → далее как 6.1` (хранится только итоговый текст).

### 6.3. Расчёт балансов и Net Worth
`calculateAccountBalance` = стартовый остаток + доходы − расходы ± корректировки + входящие переводы − исходящие переводы. `calculateNetWorth` = Σ балансов UAH + Σ балансов USD × курс. Один код используется в «Обзоре», «Счетах» и (в будущем) в командах бота.

### 6.4. Safe-to-spend («Свободно на сегодня»)
`calculateSafeToSpend` (shared): `available = Σ балансов (UAH) − отложено в цели − предстоящие регулярные платежи`; `safe_per_day = available / max(1, дней до next_income_date)`; `remaining_limit = safe_per_day − потрачено сегодня`. Даты и «сегодня» — по Europe/Kyiv. Если `next_income_date` не задана — показывается понятное сообщение, а не число.

### 6.5. Регулярные платежи
Планировщик бота (ежедневно) → `pendingRecurring` (shared) → пуш с кнопками [Подтвердить]/[Пропустить] → подтверждение создаёт транзакцию и сдвигает `next_due`. В дашборде отображаются в «Регулярных» и «Календаре».

---

## 7. Надёжность

- **Идемпотентность:** в `transactions` уникальный индекс `uq_tx_telegram (telegram_chat_id, telegram_message_id)`. Повторная доставка апдейта Telegram или ретрай дубль не создаёт.
- **Фоллбэк парсера:** каскад `Gemini → regex → needs_review`. Бот не теряет ввод ни при каких сбоях внешнего API; ошибки LLM уходят в `onLlmError` (лог).
- **Деньги и время:** только `decimal.js` и `shared/time.ts` (Europe/Kyiv). Сбой Gemini не «проглатывается» молча — он обязан быть пойман и приведён к regex.

---

## 8. Безопасность

- Бот строго приватный: whitelist из двух Telegram ID (`ALLOWED_TELEGRAM_IDS` в `.env`). Остальным — молчание.
- Секреты только в `.env` (в git не попадает; шаблон — `.env.example`). Никогда не в коде и не в чаты.
- **Ключи по контексту:** `service_role` — только на сервере бота; в браузере — `anon` + RLS. `GEMINI_API_KEY` — только на сервере (бот) или в Supabase Edge Function, **никогда** в браузерном бандле.
- Supabase RLS включён на всех таблицах: политика `authenticated_all` — авторизованный пользователь видит и меняет всё; `anon` доступа к данным не имеет.
- Для дашборда в вебе — авторизация Supabase (email/пароль), иначе финансовые данные открыты.
- Голосовые файлы не сохраняются — аудио сразу превращается в текст.

---

## 9. Конфигурация (`.env`)

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # только сервер бота, в браузер не попадает

# Google Gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TRANSCRIBE_MODEL=gemini-2.5-flash

# Telegram-бот
TELEGRAM_BOT_TOKEN=
ALLOWED_TELEGRAM_IDS=           # два ID через запятую

# Общее
TZ=Europe/Kyiv
LOG_LEVEL=info
```

Несекретные настройки (курс USD, `confirm_enabled`, `overspend_alert_pct`, `next_income_date`, таймзона) хранятся в таблице `settings` и меняются из дашборда. Их типы — `AppSettings` в `shared/types.ts`.

---

## 10. Бэкапы и экспорт

- **Дашборд:** экспорт транзакций в CSV и всего store в JSON (`SettingsView` / `services/storage.ts`); кнопка «Очистить тестовые данные» (удаляет транзакции/переводы/взносы, сохраняя счета и категории) и «Сбросить к демо-данным».
- **Бот (план):** `/backup` — присылает файл бэкапа в Telegram.
- **Архив (вне MVP):** выгрузка старых транзакций на ПК, чтобы БД оставалась лёгкой.
- **Миграции:** без тяжёлых систем; `supabase/schema.sql` применяется в SQL Editor вручную.

---

## 11. Деплой

| Компонент | Где | Как |
|---|---|---|
| Дашборд | локально (`npm run dev:web`) / статика | `npm run build:web` → `dist/` (переменные из корневого `.env` через `vite.config.ts`) |
| Бот | Render / Railway | `npm run dev:bot` / `npm run start` в `apps/bot`, переменные из `.env` в настройках сервиса |
| БД | Supabase | применить `supabase/schema.sql` в SQL Editor |

Примечание: бесплатные тарифы хостингов могут «усыплять» сервис. Если это случится — использовать webhook-режим или внешний пинг.

---

## 12. Что готово и что в плане (соответствие ROADMAP)

- ✅ **Готово:** дашборд (`apps/web`) на React/Vite; общий пакет (`packages/shared`): типы, деньги, время, формулы, regex-парсер, Gemini-парсер/транскрипция, Supabase-клиенты/мапперы; схема БД (`schema.sql`); Telegram-бот (`apps/bot`, `/start`, `/help`, `/balance`). Практически все фичи v2 и v4 по дашборду.
- ⏳ **В плане:** основной сценарий ввода трат в боте (`apps/bot`); уведомления партнёру и `/backup` (3.1–3.3); Realtime-подписку дашборда (сейчас перечитывает store после каждой мутации); деплой бота и дашборда (3.5–3.6); архивация старых данных (v4.13).

Актуальный статус каждого шага — в [`ROADMAP.md`](./ROADMAP.md).

- **Навигация:** `components/Navbar.tsx` — вкладки «Обзор, Доходы, Транзакции, Борд, Календарь, Счета & Ревизия, Цели, Регулярные, Категории, Telegram-Бот, Настройки», фильтр по пользователю (Все/Дмитро/Даша), кнопки «Быстрая операция» (парсер) и «+ операция».
- **Экраны (`views/`):** по одному компоненту на вкладку. Все суммы считаются функциями из `@oover/shared`, а не вручную.
- **Модалки (`components/`):** добавление/редактирование транзакции, перевод, ревизия счёта, взнос в цель, быстрый ввод через парсер.
- **Уведомления:** всплывающий «тост» (например, уведомление партнёру) в `App.tsx`.
- **Секреты:** `vite.config.ts` читает корневой `.env` и пробрасывает в бандл **только** `SUPABASE_URL` и `SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` и `GEMINI_API_KEY` в браузер не попадают никогда.
- **Хранилище данных:** **Supabase — единственный источник правды.** Дашборд читает/пишет таблицы через `services/data.ts` (anon-ключ + RLS), авторизация — Supabase Auth (email/пароль, экран входа `components/AuthGate.tsx`). `localStorage` больше не используется для данных; экспорт CSV/JSON остался в `services/storage.ts` только для скачивания файлов.


- `apps/web` и `apps/bot` **никогда** не импортируют друг друга — общий код только через `@oover/shared`.
- **Бизнес-формулы (балансы, Net Worth, Safe-to-spend) — только в `shared/calculations.ts`.** UI не считает деньги сам, он вызывает эти функции.
- **Деньги — только через `shared/money.ts`** (decimal.js). **Время/границы суток — только через `shared/time.ts`.**
- **SQL и работа с БД — только через `shared/supabase/*`** (клиенты и мапперы). Таблицы и политики — в `supabase/schema.sql`.
- `packages/shared` не знает ни про React, ни про Telegram — это чистый TypeScript.
