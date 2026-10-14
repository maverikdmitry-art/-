# DATABASE.md — Схема данных (Supabase / PostgreSQL)

Схема максимально простая, без тяжёлых систем миграций. Файл применяется один раз в **Supabase → SQL Editor**: [`supabase/schema.sql`](./supabase/schema.sql).
Общая архитектура: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Правила для ИИ: [`PROJECT_RULES.md`](./PROJECT_RULES.md). Канонические типы TS, деньги (`decimal.js`), время (`date-fns-tz`) и клиенты/мапперы БД — в пакете `@oover/shared` (`packages/shared/src/`).

---

## 1. Обзор сущностей

```
users ──┬─< transactions >── accounts
        │         │
        │         └── categories >── category_groups
        │
        ├─< transfers  (accounts → accounts)
        ├─< goals ─< goal_contributions
        └─< recurring_payments

settings            — глобальные настройки (курс USD, дата следующего дохода, ...)
processed_updates   — защита от дублей (идемпотентность)
```

Принципы:
- Баланс счёта **вычисляется** из операций, а не хранится → удаление траты автоматически «возвращает» деньги на счёт.
- Переводы — отдельная сущность, не доход и не расход.
- Время хранится в UTC (`timestamptz`), но **все «сутки», фильтры дат и расчёты считаются по Europe/Kyiv** (см. раздел «Часовой пояс»).
- Деньги — `numeric(14,2)`, не `float`.

---

## 2. DDL

```sql
-- ============ ПОЛЬЗОВАТЕЛИ ============
create table if not exists users (
  id             serial primary key,
  name           text not null,
  telegram_id    bigint unique not null,
  notify_partner boolean not null default true
);

-- ============ СЧЕТА ============
create table if not exists accounts (
  id              serial primary key,
  name            text not null,
  kind            text not null check (kind in ('card','cash')),
  currency        text not null default 'UAH' check (currency in ('UAH','USD')),
  initial_balance numeric(14,2) not null default 0,   -- стартовый остаток
  is_active       boolean not null default true,
  sort_order      int not null default 0
);

-- ============ ГРУППЫ КАТЕГОРИЙ ============
create table if not exists category_groups (
  id         serial primary key,
  name       text not null,
  sort_order int not null default 0
);

-- ============ КАТЕГОРИИ ============
create table if not exists categories (
  id        serial primary key,
  name      text not null unique,
  group_id  int references category_groups(id) on delete set null,
  type      text not null check (type in ('expense','income')),
  is_active boolean not null default true
);

-- ============ ТРАНЗАКЦИИ ============
create table if not exists transactions (
  id                   bigserial primary key,
  type                 text not null check (type in ('expense','income','adjustment')),
  amount               numeric(14,2) not null,
  currency             text not null default 'UAH' check (currency in ('UAH','USD')),
  account_id           int not null references accounts(id),
  category_id          int references categories(id) on delete set null,
  user_id              int not null references users(id),   -- автор (Дмитро / Даша)
  description          text,
  note                 text,                                -- комментарий (по нему поиск)
  occurred_at          timestamptz not null default now(),
  status               text not null default 'ok' check (status in ('ok','needs_review')),
  source               text not null default 'dashboard' check (source in ('bot','voice','dashboard')),
  raw_text             text,                                -- исходный текст/транскрипт
  telegram_chat_id     bigint,
  telegram_message_id  bigint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- идемпотентность: одно сообщение Telegram = максимум одна транзакция
create unique index if not exists uq_tx_telegram
  on transactions (telegram_chat_id, telegram_message_id)
  where telegram_message_id is not null;

create index if not exists idx_tx_date     on transactions (occurred_at desc);
create index if not exists idx_tx_account  on transactions (account_id);
create index if not exists idx_tx_category on transactions (category_id);
create index if not exists idx_tx_user     on transactions (user_id);
create index if not exists idx_tx_status   on transactions (status) where status = 'needs_review';

-- ============ ПЕРЕВОДЫ МЕЖДУ СЧЕТАМИ ============
create table if not exists transfers (
  id               bigserial primary key,
  from_account_id  int not null references accounts(id),
  to_account_id    int not null references accounts(id),
  amount_from      numeric(14,2) not null check (amount_from > 0),
  amount_to        numeric(14,2) not null check (amount_to > 0),   -- отличается при смене валюты
  user_id          int not null references users(id),
  note             text,
  occurred_at      timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

-- ============ ЦЕЛИ НАКОПЛЕНИЯ ============
create table if not exists goals (
  id             serial primary key,
  name           text not null,
  target_amount  numeric(14,2) not null check (target_amount > 0),
  currency       text not null default 'UAH' check (currency in ('UAH','USD')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists goal_contributions (
  id          bigserial primary key,
  goal_id     int not null references goals(id) on delete cascade,
  amount      numeric(14,2) not null,                 -- отрицательное = снятие
  user_id     int references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============ РЕГУЛЯРНЫЕ ПЛАТЕЖИ ============
create table if not exists recurring_payments (
  id            serial primary key,
  name          text not null,
  amount        numeric(14,2) not null,
  currency      text not null default 'UAH' check (currency in ('UAH','USD')),
  account_id    int references accounts(id) on delete set null,
  category_id   int references categories(id) on delete set null,
  day_of_month  int not null check (day_of_month between 1 and 31),
  auto_confirm  boolean not null default false,   -- автоматически или по напоминанию
  next_due      date not null,
  is_active     boolean not null default true,
  type          text not null default 'expense' check (type in ('expense','income'))
);

-- ============ НАСТРОЙКИ ============
create table if not exists settings (
  key    text primary key,
  value  text not null
);
-- ключи: usd_rate, confirm_enabled, next_income_date, overspend_alert_pct (30), timezone

-- ============ ЗАЩИТА ОТ ДУБЛЕЙ ============
create table if not exists processed_updates (
  update_id    bigint primary key,
  processed_at timestamptz not null default now()
);
```

---

## 3. Стартовые данные

`supabase/schema.sql` содержит готовый seed. Все вставки — с `on conflict ... do nothing`, поэтому файл можно переприменять. Для устойчивости `on conflict` по именам заранее созданы уникальные индексы `uq_group_name` (на `category_groups.name`) и `uq_account_name` (на `accounts.name`).

```sql
-- Пользователи: telegram_id заменить на реальные (узнать у @userinfobot)
-- Значения должны совпадать с ALLOWED_TELEGRAM_IDS из .env.
insert into users (name, telegram_id, notify_partner) values
  ('Дмитро', 396881223, true),
  ('Даша',    725733059, true)
on conflict (telegram_id) do nothing;

insert into category_groups (name, sort_order) values
  ('Обязательные', 1), ('Необязательные', 2), ('Доходы', 3)
on conflict (name) do nothing;

-- базовые категории (редактируются из дашборда)
insert into categories (name, group_id, type) values
  ('Жильё',       (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Коммуналка',  (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Связь',       (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Транспорт',   (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Продукты',    (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Кафе',        (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Развлечения', (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Покупки',     (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Подписки',    (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Прочее',      (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Зарплата',    (select id from category_groups where name = 'Доходы'),          'income'),
  ('Прочий доход',(select id from category_groups where name = 'Доходы'),          'income')
on conflict (name) do nothing;

insert into accounts (name, kind, currency, initial_balance, sort_order) values
  ('Монобанк',   'card', 'UAH', 0, 1),
  ('Райффайзен', 'card', 'UAH', 0, 2),
  ('Наличка',    'cash', 'UAH', 0, 3),
  ('USD Сейф',   'cash', 'USD', 0, 4)
on conflict (name) do nothing;

insert into settings (key, value) values
  ('usd_rate',           '41.5'),
  ('confirm_enabled',    'true'),
  ('next_income_date',   ''),
  ('overspend_alert_pct','30'),
  ('timezone',           'Europe/Kyiv')
on conflict (key) do nothing;
```

Стартовые остатки задаются в `accounts.initial_balance` (в демо-дашборде — в `services/storage.ts`).

---

## Часовой пояс

Это критично для «потрачено сегодня» и дневного лимита. Правила:

1. В БД время хранится в UTC (`timestamptz`). Менять это не нужно.
2. «Сегодня», «вчера», «эта неделя», «этот месяц» всегда считаются по зоне `Europe/Kyiv` (хранится в `settings.timezone`).
3. В SQL дату операции в киевских сутках получаем так:

```sql
(occurred_at at time zone 'Europe/Kyiv')::date
```

   Например, расходы за сегодня:

```sql
select coalesce(sum(amount), 0)
from transactions
where type = 'expense'
  and (occurred_at at time zone 'Europe/Kyiv')::date
      = (now() at time zone 'Europe/Kyiv')::date;
```

4. В приложении (TypeScript) все границы суток берутся **только** из модуля `packages/shared/src/time.ts` (пакет `@oover/shared`, на базе `date-fns` + `date-fns-tz`). Запрещено считать границы вручную через `new Date()` / `toISOString().slice(...)`: на хостинге машина в UTC, и день «переключится» в 02:00–03:00 по Киеву. Используй `todayYmd`, `startOfDay/endOfDay`, `rangeForPreset`.
5. Переход на зимнее/летнее время обрабатывается автоматически через `date-fns-tz` (`formatInTimeZone`/`fromZonedTime`), а не фиксированное смещение `+2`/`+3`.
6. Тест (шаг 1.3 в ROADMAP): операция в 23:30 по Киеву попадает в «сегодня», а в 00:30 следующего дня уже в «завтра», и летом, и зимой.

---

## 4. Баланс счёта

```
balance(account) =
    initial_balance
  + Σ income        (account_id = A)
  − Σ expense       (account_id = A)
  + Σ adjustment    (account_id = A)        -- со знаком
  + Σ transfers.amount_to   (to_account_id = A)
  − Σ transfers.amount_from (from_account_id = A)
```

В `supabase/schema.sql` уже создано представление `account_balances` (`security_invoker = on`, чтобы работал RLS), чтобы читать баланс одним запросом:

```sql
create or replace view account_balances as
select
  a.id       as account_id,
  a.name     as account_name,
  a.currency as currency,
  a.initial_balance
    + coalesce((
        select sum(
          case
            when t.type = 'income'     then t.amount
            when t.type = 'expense'    then -t.amount
            when t.type = 'adjustment' then t.amount
            else 0
          end
        )
        from transactions t
        where t.account_id = a.id
      ), 0)
    + coalesce((select sum(tr.amount_to)   from transfers tr where tr.to_account_id   = a.id), 0)
    - coalesce((select sum(tr.amount_from) from transfers tr where tr.from_account_id = a.id), 0)
  as balance
from accounts a;

alter view account_balances set (security_invoker = true);
```

Поле `updated_at` в `transactions` автоматически обновляет триггер `trg_transactions_updated` (функция `set_updated_at`).
Удаление транзакции = удаление строки → баланс пересчитывается сам.

---

## 5. Net Worth

```
net_worth_UAH = Σ balance(accounts в UAH)
              + Σ balance(accounts в USD) × usd_rate
```

`usd_rate` — ручной ввод в `settings` (шапка дашборда). Автоматического курса в MVP нет.
Накопления в целях в Net Worth входят (деньги остаются на счетах).

---

## 6. Сверка баланса («Ревизия»)

Пользователь вводит фактический остаток → система считает разницу и создаёт транзакцию `type='adjustment'` на эту разницу (со знаком). Так история не искажается, а расхождение видно.

---

## 7. Формулы

### Safe-to-spend (безопасная сумма на день)

```
available = Σ balance(счета, пересчитанные в UAH)
          − Σ goal_contributions (отложено в цели)
          − Σ recurring_payments, у которых next_due ≤ next_income_date (ещё не оплачены)

days_left = max(1, next_income_date − today)     -- today и next_income_date — даты по Europe/Kyiv

safe_per_day = available / days_left
```

- `next_income_date` хранится в `settings` (в ТЗ не указан способ определения даты — вынесено в настройку; можно позже вычислять из регулярных доходов). Если дата не задана, бот и дашборд показывают сообщение «укажи дату следующего дохода», а не число.
- Все «сутки» в формуле считаются по Europe/Kyiv (см. «Часовой пояс»).
- Сэкономленное за день **не** переносится в лимит следующих дней автоматически — остаток считается фактом.
- **Потрачено сегодня** = Σ expense за текущие **киевские** сутки (в UAH).
- **Остаток лимита** = `safe_per_day − spent_today`.
- Уведомление в Telegram при остатке ≤ 30% от дневного лимита; дни с превышением подсвечиваются мягким красным.

### Сравнение месяцев
`delta = sum(expense, текущий месяц) − sum(expense, прошлый месяц)` (и аналогично по доходам/категориям).

---

## 8. Статусы и фильтры

| Поле | Значения | Назначение |
|---|---|---|
| `status` | `ok`, `needs_review` | Нераспознанное попадает в очередь разбора на ПК |
| `source` | `bot`, `voice`, `dashboard` | Откуда пришла запись |
| `user_id` | Дмитро / Даша | Фильтр «Все / Дмитро / Даша» |

Фильтры дат (Сегодня, Вчера, Эта неделя, Этот месяц, Прошлый месяц) строятся по `occurred_at`.
Сортировка по умолчанию: `occurred_at desc`. Пагинация: 10 / 30 / 50 / 100.
Поиск по `description` и `note` — `ILIKE` (для MVP достаточно; при росте — `pg_trgm`).

---

## 9. Архив и объём

- Текстовые транзакции занимают килобайты: десятки тысяч записей ≈ единицы МБ — лимит Supabase 500 МБ на годы.
- Архив/выгрузка старых записей на ПК — из дашборда (`SettingsView` / `services/storage.ts`, экспорт CSV/JSON), после чего их можно удалить из облака.
- Бэкап по команде `/backup` (бот, в плане) и по расписанию — файл отправляется в Telegram.
- Кнопка «Очистить тестовые данные» удаляет транзакции/переводы/взносы, не трогая счета, категории и настройки.

---

## 10. Безопасность данных

- Включить RLS в Supabase; серверный ключ (`service_role`) — только у бота.
- Данные дашборда в вебе — за авторизацией Supabase (email/пароль), иначе финансовые данные открыты.
- Голосовые файлы не хранятся; в `raw_text` лежит только текст.
