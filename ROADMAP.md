# ROADMAP.md — Чёткая последовательность разработки

Идём **строго по порядку**. Один шаг = один чат с ИИ = одна проверка.
К следующему шагу переходим только когда проверка текущего пройдена.
Правила для ИИ: [`PROJECT_RULES.md`](./PROJECT_RULES.md). Архитектура: [`ARCHITECTURE.md`](./ARCHITECTURE.md). БД: [`DATABASE.md`](./DATABASE.md).

Стек: Node.js 20+, TypeScript, npm workspaces, Supabase, React/Vite дашборд, Gemini, GrammY-бот.

---

## Как проходить шаг (одинаково для всех шагов)

1. Открой **новый чат** с ИИ и вставь `PROJECT_RULES.md`.
2. В разделе «Текущий этап» напиши номер шага и что уже работает.
3. Вставь задачу шага (колонка «Что просить») и **только нужные файлы** из колонки «Файлы».
4. Внеси код в VS Code. Запусти проверку (`npm run typecheck` / `npm run dev:web` / bot).
5. Не прошла — скопируй ошибку из терминала целиком, отправь в тот же чат. Больше 3 попыток по кругу: открой новый чат, вставь правила, файл и ошибку.
6. Прошла — отметь шаг `[x]` ниже и иди дальше.

---

## Этап 0 — Подготовка (≈ 2–3 часа, код писать не нужно)

| № | Что сделать | Проверка |
|---|---|---|
| [x] 0.1 | Установить Node.js 20+ и VS Code. Проверить, что проект использует npm workspaces: корневой `package.json` указывает на `packages/*` и `apps/*`. | В терминале `node --version` показывает 20+. Зависимости установлены через `npm install` на корне. |
| [x] 0.2 | Создать бота в Telegram через @BotFather, получить токен. Узнать свой Telegram ID и ID Даши (бот @userinfobot). | Токен и два ID записаны. |
| [x] 0.3 | Создать **отдельный тестовый** проект в Supabase. Взять URL, anon-ключ и service_role-ключ. | Проект открывается, SQL Editor доступен. |
| [x] 0.4 | Создать ключ Google Gemini API (https://aistudio.google.com/apikey) для LLM-парсера и распознавания голоса. | Ключ записан в `.env`. |
| [x] 0.5 | Создать структуру папок из ARCHITECTURE.md, файл `.env` по шаблону `.env.example`. Структура: `apps/web` (React-дашборд), `apps/bot` (GrammY-бот), `packages/shared` (общий код), `supabase/schema.sql`. | Структура есть, `.env` заполнен и закреплён в `.gitignore`. |

---

## Версия 1 — Бот работает локально на ПК (дни 1–3)

Цель: ты пишешь боту «кофе 150», подтверждаешь, запись появляется в Supabase. Всё на твоём ПК, без хостинга.

| № | Что просить | Файлы | Проверка |
|---|---|---|---|
| [x] 1.1 | `schema.sql` со стартовыми данными: 2 пользователя, счета (Монобанк, Райффайзен, Наличка, USD Сейф), группы и базовые категории, настройки (`usd_rate`, `timezone=Europe/Kyiv`, `confirm_enabled`, `next_income_date`). Выполни его в SQL Editor Supabase. | `supabase/schema.sql` | Таблицы, вью `account_balances`, стартовые данные и RLS видны в Supabase. |
| [x] 1.2 | Загрузка `.env`, логирование и подключение к Supabase. Общий клиент живёт в `packages/shared/src/supabase/client.ts`. Бот использует service_role-ключ, дашборд — anon-ключ + авторизацию. | [`packages/shared/src/supabase/client.ts`](./packages/shared/src/supabase/client.ts) | Бот может читать пользователей через Supabase. |
| [x] 1.3 | Модуль времени: границы «сегодня/вчера/неделя/месяц» по **Europe/Kyiv**, хранение в UTC. | [`packages/shared/src/time.ts`](./packages/shared/src/time.ts) | Операция в 23:30 по Киеву попадает в правильный день. |
| [x] 1.4 | Репозитории/мапперы: счета, категории, настройки, транзакции. Вставка транзакции **идемпотентная** (`ON CONFLICT DO NOTHING`). | [`packages/shared/src/supabase/mappers.ts`](./packages/shared/src/supabase/mappers.ts), `supabase/schema.sql` | Повторная вставка с тем же `message_id` дубля не создаёт. |
| [x] 1.5 | Расчёт баланса счёта и Net Worth, форматирование денег, перевод USD → UAH по курсу. Числа идут через `decimal.js`, не float. | [`packages/shared/src/money.ts`](./packages/shared/src/money.ts), [`packages/shared/src/calculations.ts`](./packages/shared/src/calculations.ts) | Баланс совпадает с расчётом вручную. |
| [x] 1.6 | Простой парсер **без LLM**: «кофе 150 мак», «зп 20000», «15$ такси». Определяет сумму, валюту, тип, описание. Если не понял — `needs_review`. | [`packages/shared/src/parser/regex.ts`](./packages/shared/src/parser/regex.ts), [`packages/shared/src/parser/index.ts`](./packages/shared/src/parser/index.ts) | 15 тест-фраз, мусор попадает в `needs_review`. |
| [ ] 1.7 | Запуск бота на **GrammY** (`@grammyjs`), доступ только для двух ID, команда `/start`. Код пока ожидается в папке `apps/bot`. | `apps/bot/src/main.ts`, `apps/bot/src/auth.ts`, `apps/bot/src/handlers/*.ts` | Ты получаешь ответ. Чужие ID бот игнорирует. |
| [ ] 1.8 | Основной сценарий: текст → парсер (Gemini → regex → `needs_review`) → кнопки выбора типа и счёта (запоминает последний) → превью → `[Изменить] [Отмена] [Сохранить]` → запись в БД. | `apps/bot/src/handlers/input.ts`, `apps/bot/src/handlers/callbacks.ts`, `apps/bot/src/keyboards.ts` | Запись появилась в Supabase. Повтор сообщения не создаёт дубль. |
| [ ] 1.9 | Команды `/balance`, `/stats`, `/help`. | `apps/bot/src/handlers/commands.ts` | Цифры совпадают с Supabase. |
| [x] 1.10 | Формула Safe-to-spend. Сутки считаются по Киеву. Если `next_income_date` не задана, дашборд/бот пишут понятное сообщение, а не ошибку. | [`packages/shared/src/calculations.ts`](./packages/shared/src/calculations.ts) | Результат совпадает с расчётом вручную. |


**Стоп-точка v1:** дашборд уже работает локально; осталось написать `apps/bot` (GrammY). Баги, которые найдёшь, исправь до перехода к v2.


| Команда | Описание | Статус |
|---|---|---|
| `/start` | Меню и список команд | [x] |
| `/balance` | Баланс счетов и Net Worth | [x] |
| `/stats` | Статистика: сегодня / неделя / месяц | [x] (только месяц) |
| `/income` | Внести поступление | [ ] |
| `/expense` | Внести трату | [ ] |
| `/recurring` | Добавить регулярный платёж | [ ] |
| `/today` | Что внесли за сегодня | [x] |
| `/backup` | Резервная копия данных (JSON) | [ ] |
| `/undo` | Удалить последнюю операцию | [ ] |
| `/cancel` | Отменить текущий ввод | [ ] |
| `/help` | Справка | [x] |

">

---

## Версия 2 — Дашборд, минимум (дни 3–5)

Цель: открываешь сайт и видишь свои траты, можешь их править.

| № | Что просить | Файлы | Проверка |
|---|---|---|---|
| [x] 2.1 | Каркас React-дашборда на Vite. Экраны: `OverviewView`, `TransactionsView`, `AccountsView`, `SettingsView`. Вход защищён авторизацией Supabase, курс USD вводится в настройках. | [`apps/web`](./apps/web), `apps/web/src/views/SettingsView.tsx` | Без авторизации данные не видны. Курс сохраняется в БД. |
| [x] 2.2 | Окно стартовых остатков по счетам. | [`apps/web/src/views/AccountsView.tsx`](./apps/web/src/views/AccountsView.tsx) | Балансы совпадают с введёнными. |
| [x] 2.3 | Таблица транзакций: фильтры (Все/Дмитро/Даша; Сегодня/Вчера/Неделя/Месяц/Прошлый месяц), сортировка, пагинация 10/30/50/100, подсветка `needs_review`. | [`apps/web/src/views/TransactionsView.tsx`](./apps/web/src/views/TransactionsView.tsx) | Данные видны в таблице. Фильтры работают. |
| [x] 2.4 | Редактирование и удаление транзакции. После удаления баланс счёта пересчитывается. | [`apps/web/src/components/TransactionModal.tsx`](./apps/web/src/components/TransactionModal.tsx), [`apps/web/src/components/RevisionModal.tsx`](./apps/web/src/components/RevisionModal.tsx) | Удалил трату, баланс вернулся. |
| [x] 2.5 | Добавление транзакции с дашборда. | [`apps/web/src/components/TransactionModal.tsx`](./apps/web/src/components/TransactionModal.tsx) | Запись видна на сайте и в Supabase. |
| [x] 2.6 | Главный экран: Net Worth, виджет «Свободно на сегодня», кнопка-глазок для скрытия сумм. | [`apps/web/src/views/OverviewView.tsx`](./apps/web/src/views/OverviewView.tsx) | Цифры совпадают с Supabase. |

---

## Версия 3 — Второй пользователь, уведомления, выход в интернет (дни 6–7)

| № | Что просить | Файлы | Проверка |
|---|---|---|---|
| [ ] 3.1 | Даша: уведомления партнёру о тратах (с настройкой вкл/выкл) через GrammY-бота. | `apps/bot/src/notifications.ts` | Трата Даши приходит тихим уведомлением тебе. |
| [ ] 3.2 | Уведомление о перерасходе, когда остаток дневного лимита ≤ 30% (формула — в `packages/shared`). | `apps/bot/src/notifications.ts`, [`packages/shared/src/calculations.ts`](./packages/shared/src/calculations.ts) | Уведомление приходит один раз, не спамит. |
| [ ] 3.3 | `/backup`: бот присылает файл с данными в Telegram. | `apps/bot/src/commands/backup.ts` | Файл пришёл и открывается. |
| [x] 3.4 | Кнопка «Очистить тестовые данные» в настройках дашборда. | [`apps/web/src/views/SettingsView.tsx`](./apps/web/src/views/SettingsView.tsx) | Транзакции удалены, счета и категории остались. |
| [ ] 3.5 | **Деплой бота** на Render или Railway. Перед выбором проверь актуальные условия бесплатного тарифа (сервис может «засыпать»; тогда нужен webhook или пинг). | `apps/bot` / настройки хостинга | Выключаешь бота на ПК, он продолжает отвечать. |
| [ ] 3.6 | **Деплой дашборда** (или оставить локальным). Если в вебе, авторизация обязательна. | `apps/web` / настройки хостинга | Сайт открывается, без авторизации данные не видны. |

**Стоп-точка v3:** бот пока не написан и деплой не готов. Проверь, что `apps/bot` написан на GrammY, уведомления о тратах работают, `/backup` работает и бот задеплоен.

---

## Версия 4 — Дополнения (по одной фиче, в таком порядке)

| Фича | Статус | Файлы |
|---|---|---|
| 1. Группы категорий и управление категориями с дашборда | [x] | [`apps/web/src/views/CategoriesView.tsx`](./apps/web/src/views/CategoriesView.tsx) |
| 2. Переводы между счетами | [x] | [`apps/web/src/components/TransferModal.tsx`](./apps/web/src/components/TransferModal.tsx) |
| 3. Сверка баланса («Ревизия») | [x] | [`apps/web/src/components/RevisionModal.tsx`](./apps/web/src/components/RevisionModal.tsx) |
| 4. Сравнение с прошлым месяцем | [x] | [`apps/web/src/views/OverviewView.tsx`](./apps/web/src/views/OverviewView.tsx) |
| 5. Календарь (сумма по дням, клик → список, подсветка перерасхода) | [x] | [`apps/web/src/views/CalendarView.tsx`](./apps/web/src/views/CalendarView.tsx) |
| 6. Регулярные платежи и напоминания в Telegram (подтвердить/пропустить) | [x] дашборд | [`apps/web/src/views/RecurringView.tsx`](./apps/web/src/views/RecurringView.tsx); Telegram-часть — `apps/bot` |
| 7. Цели накопления | [x] | [`apps/web/src/views/GoalsView.tsx`](./apps/web/src/views/GoalsView.tsx) |
| 8. **Gemini LLM-парсер** (с фоллбэком на regex) | [x] | [`packages/shared/src/gemini/parse.ts`](./packages/shared/src/gemini/parse.ts), [`packages/shared/src/gemini/client.ts`](./packages/shared/src/gemini/client.ts), [`packages/shared/src/parser/index.ts`](./packages/shared/src/parser/index.ts) |
| 9. Голосовые сообщения (Gemini Audio / Whisper) | [x] | [`packages/shared/src/gemini/transcribe.ts`](./packages/shared/src/gemini/transcribe.ts) |
| 10. Поиск по заметкам, массовое редактирование | [x] | [`apps/web/src/views/TransactionsView.tsx`](./apps/web/src/views/TransactionsView.tsx) |
| 11. Борд (Kanban) | [x] | [`apps/web/src/views/BoardView.tsx`](./apps/web/src/views/BoardView.tsx) |
| 12. Экспорт Excel/CSV/PDF | [x] дашборд | [`apps/web/src/views/SettingsView.tsx`](./apps/web/src/views/SettingsView.tsx) |
| 13. Архивация старых данных на ПК | [ ] | — |

---

## Если срок горит: что резать (сверху вниз)

1. Фичи v4, которые ещё не включены: архивация, bot-напоминания регулярных платежей, экспорт в PDF.
2. Пункты 3.1–3.3 (бот можно оставить локальным, пока не сделан деплой).
3. Пункты 3.5–3.6 (деплой бота/дашборда можно отложить).
4. Крайний случай: уже готовый React-дашборд плюс таблицы в Supabase закрывают основную задачу — бот станет дополнительным способом ввода.
