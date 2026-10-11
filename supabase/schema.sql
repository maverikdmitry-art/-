-- ============================================================================
--  OoverrFinancee — схема базы данных (Supabase / PostgreSQL)
-- ============================================================================
--  Применяется один раз в Supabase → SQL Editor.
--  Деньги: numeric(14,2) (не float). Время: timestamptz (UTC),
--  но «сутки» считаются по Europe/Kyiv на стороне приложения (packages/shared/time.ts).
-- ============================================================================

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
  initial_balance numeric(14,2) not null default 0,
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
  user_id              int not null references users(id),
  description          text,
  note                 text,
  occurred_at          timestamptz not null default now(),
  status               text not null default 'ok' check (status in ('ok','needs_review')),
  source               text not null default 'dashboard' check (source in ('bot','voice','dashboard')),
  raw_text             text,
  telegram_chat_id     bigint,
  telegram_message_id  bigint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Идемпотентность: одно сообщение Telegram = максимум одна транзакция.
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
  id              bigserial primary key,
  from_account_id int not null references accounts(id),
  to_account_id   int not null references accounts(id),
  amount_from     numeric(14,2) not null check (amount_from > 0),
  amount_to       numeric(14,2) not null check (amount_to > 0),
  user_id         int not null references users(id),
  note            text,
  occurred_at     timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index if not exists idx_transfers_date on transfers (occurred_at desc);
create index if not exists idx_transfers_from on transfers (from_account_id);
create index if not exists idx_transfers_to   on transfers (to_account_id);

-- ============ ЦЕЛИ НАКОПЛЕНИЯ ============
create table if not exists goals (
  id            serial primary key,
  name          text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency      text not null default 'UAH' check (currency in ('UAH','USD')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists goal_contributions (
  id         bigserial primary key,
  goal_id    int not null references goals(id) on delete cascade,
  amount     numeric(14,2) not null,
  user_id    int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contrib_goal on goal_contributions (goal_id);

-- ============ РЕГУЛЯРНЫЕ ПЛАТЕЖИ ============
create table if not exists recurring_payments (
  id           serial primary key,
  name         text not null,
  amount       numeric(14,2) not null,
  currency     text not null default 'UAH' check (currency in ('UAH','USD')),
  account_id   int references accounts(id) on delete set null,
  category_id  int references categories(id) on delete set null,
  day_of_month int not null check (day_of_month between 1 and 31),
  auto_confirm boolean not null default false,
  next_due     date not null,
  is_active    boolean not null default true,
  type         text not null default 'expense' check (type in ('expense','income'))
);

-- ============ НАСТРОЙКИ (key/value) ============
create table if not exists settings (
  key   text primary key,
  value text not null
);

-- ============ ЗАЩИТА ОТ ДУБЛЕЙ АПДЕЙТОВ TELEGRAM ============
create table if not exists processed_updates (
  update_id    bigint primary key,
  processed_at timestamptz not null default now()
);
-- ============================================================================
--  ПРЕДСТАВЛЕНИЕ БАЛАНСОВ (DATABASE.md, раздел 4)
-- ============================================================================
-- Баланс счёта ВЫЧИСЛЯЕТСЯ из операций, а не хранится.
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

-- В PG15+ представления уважают RLS базовых таблиц только с security_invoker.
alter view account_balances set (security_invoker = true);

-- ============================================================================
--  ТРИГГЕР updated_at ДЛЯ ТРАНЗАКЦИЙ
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated on transactions;
create trigger trg_transactions_updated
  before update on transactions
  for each row execute function set_updated_at();

-- ============================================================================
--  СТАРТОВЫЕ ДАННЫЕ (DATABASE.md, раздел 3)
-- ============================================================================
create unique index if not exists uq_group_name   on category_groups (name);
create unique index if not exists uq_account_name on accounts (name);

-- Пользователи: ЗАМЕНИ telegram_id на реальные (узнать можно у @userinfobot).
insert into users (name, telegram_id, notify_partner) values
  ('Дмитро', 111111111, true),
  ('Даша',    222222222, true)
on conflict (telegram_id) do nothing;

insert into category_groups (name, sort_order) values
  ('Обязательные', 1),
  ('Необязательные', 2),
  ('Доходы', 3)
on conflict (name) do nothing;

insert into categories (name, group_id, type) values
  ('Жильё',      (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Коммуналка', (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Связь',      (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Транспорт',  (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Продукты',   (select id from category_groups where name = 'Обязательные'),    'expense'),
  ('Кафе',       (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Развлечения',(select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Покупки',    (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Подписки',   (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Прочее',     (select id from category_groups where name = 'Необязательные'),  'expense'),
  ('Зарплата',   (select id from category_groups where name = 'Доходы'),          'income'),
  ('Прочий доход',(select id from category_groups where name = 'Доходы'),         'income')
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

-- ============================================================================
--  БЕЗОПАСНОСТЬ: RLS
-- ============================================================================
-- Дашборд ходит под anon-ключом + вход по email/паролю (Supabase Auth).
-- Политика: любой АВТОРИЗОВАННЫЙ пользователь (двое из семьи) видит и меняет всё.
-- Бот использует service_role и обходит RLS.
alter table users               enable row level security;
alter table accounts            enable row level security;
alter table category_groups     enable row level security;
alter table categories          enable row level security;
alter table transactions        enable row level security;
alter table transfers           enable row level security;
alter table goals               enable row level security;
alter table goal_contributions  enable row level security;
alter table recurring_payments  enable row level security;
alter table settings            enable row level security;
alter table processed_updates   enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'users','accounts','category_groups','categories','transactions',
    'transfers','goals','goal_contributions','recurring_payments','settings','processed_updates'
  ]
  loop
    execute format('drop policy if exists "authenticated_all" on %I;', tbl);
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (true) with check (true);',
      tbl
    );
  end loop;
end;
$$;

-- ============================================================================
--  REALTIME (живые обновления дашборда при записи из бота)
-- ============================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'transactions','transfers','accounts','categories','goals',
    'goal_contributions','recurring_payments','settings','users'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table %I;', tbl);
    end if;
  end loop;
end;
$$;
