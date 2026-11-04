# CLAUDE.md — OoverrFinancee

Семейный финансовый трекер: монорепозиторий TypeScript (npm workspaces) — веб-дашборд, Telegram-бот и общий пакет, связанные через Supabase.
Полные правила — в [PROJECT_RULES.md](./PROJECT_RULES.md) (прочитай целиком перед работой). Архитектура — [ARCHITECTURE.md](./ARCHITECTURE.md), схема БД — [DATABASE.md](./DATABASE.md), план — [ROADMAP.md](./ROADMAP.md), баги — [BUGS.md](./BUGS.md) и `bugs*.md`. При расхождении документов доверяй ARCHITECTURE.md и предупреди пользователя.

## Команды (из корня)
- `npm install` — установка всех workspaces
- `npm run dev:web` — дашборд (Vite)
- `npm run dev:bot` — Telegram-бот (long polling)
- `npm run build:web` / `npm run build` — сборка
- `npm run typecheck` — проверка типов во всех пакетах (запускай после изменений)

## Структура
- `apps/web` (`@oover/web`) — React 19 + Vite + Tailwind v4, данные через `services/data.ts` (Supabase anon + RLS)
- `apps/bot` (`@oover/bot`) — GrammY, Supabase service_role, состояние диалогов только здесь
- `packages/shared` (`@oover/shared`) — типы, деньги, время, формулы, regex-парсер, Supabase-клиенты и мапперы
- `supabase/schema.sql` — DDL + seed + RLS (применяется вручную в SQL Editor)

## Правила слоёв (нарушать нельзя)
- `apps/web` и `apps/bot` не импортируют друг друга — общий код только через `@oover/shared`.
- Формулы (балансы, Net Worth, Safe-to-spend, сравнение месяцев) — только `shared/src/calculations.ts`; UI деньги сам не считает.
- Деньги — только `shared/src/money.ts` (decimal.js), в БД `numeric(14,2)`. Никакого `float`.
- Время и границы суток/недели/месяца — только `shared/src/time.ts` (Europe/Kyiv, хранение в UTC). Никаких `new Date()`, `getMonth()`, `toISOString().slice()` для границ периодов.
- SQL/работа с БД — только через `shared/src/supabase/*`.
- `@oover/shared` — чистый TypeScript, без React и Telegram.

## Критичные ловушки
- Секреты только из `.env`; в браузер уходят лишь `SUPABASE_URL` и `SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` — только бот.
- Вставка транзакции из Telegram идемпотентна (`uq_tx_telegram`, `processed_updates`).
- Бот не должен падать на мусоре: непонятный ввод → `needs_review`, парсинг только regex (LLM/Gemini не используется).
- Пустые данные (нет `next_income_date`, нулевые остатки) — понятное сообщение, а не ошибка или странное число.
- Баланс счёта вычисляется из операций, не хранится. Переводы — таблица `transfers`.
- Вне MVP: долги, фото чеков, круговые диаграммы, автокурс валют. Python/aiogram/Streamlit/Groq в проекте не появляются.

## Как работать
- Интерфейс и сообщения бота — на русском. Дашборд минималистичный (Notion/Obsidian).
- Работай по ROADMAP, шаг за шагом; не делай то, что относится к следующим шагам.
- Правь только файлы, относящиеся к задаче; не меняй схему БД, имена функций/файлов и `.env` без согласия пользователя. Не удаляй несвязанный код.
- Сначала короткий план (3–5 строк), потом правки. Большую задачу разбивай на шаги.
- После изменений кода спроси: «Стоит ли внести эти изменения в ROADMAP.md как выполненные?» — и только по ответу обновляй ROADMAP и разделы «Текущий этап»/«Известные проблемы» в PROJECT_RULES.md.
- Когда пользователь сообщает о баге — сначала запиши его в BUGS.md в формате файла и предложи точечное решение, без огромного кода.
- В конце задачи: что изменено, что намеренно не тронуто, как проверить (`npm run typecheck`, `dev:web`/`dev:bot`).

## Коммиты
Conventional Commits: `<type>(<scope>): <описание>`. Типы: feat, fix, docs, refactor, test, chore, style, perf, build, ci. Scope: `web`, `bot`, `shared`, `supabase`, `deps`, `docs`, `root`. Описание — на английском, в повелительном наклонении, без точки. Один коммит — одна логическая правка в одной части.

> Примечание: в PROJECT_RULES.md осталась фраза «я не программист, вставляю код вручную, ты не видишь проект» — для Claude Code она неактуальна: ты видишь файлы и можешь править их напрямую в рамках правил выше.
