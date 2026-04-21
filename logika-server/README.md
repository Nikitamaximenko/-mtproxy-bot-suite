# Logika API

Бэкенд для приложения «Логика»: PostgreSQL, вход по SMS через [SMS Aero](https://smsaero.ru/integration/documentation/api/) (отправка SMS **в фоне** после быстрого ответа API — пользователь не ждёт HTTP к шлюзу) или **код на почту по SMTP**, уточняющие вопросы и отчёт через **Claude Opus 4.7** (настраивается через `ANTHROPIC_MODEL_*`), выдача PDF **через Chromium + HTML** (тот же разметочный вид, что экран отчёта в приложении; запасной вариант — ReportLab). Время доставки SMS до абонента зависит от оператора и сети; это не ускорить на стороне API.

## Архитектура LLM (юнит-экономика)

- **Router (Haiku)** — лёгкая классификация дилеммы (вкл. `ENABLE_ROUTER`).
- **Уточняющие вопросы (Sonnet)** — дешевле Opus, тот же UX диалога.
- **Глубокий анализ (Opus + adaptive thinking + JSON Schema)** — законы, искажения, альтернативы; мастер-промпт с **prompt caching** на статике.
- **Self-critique (второй Opus)** — проверка слабых мест и финальный `final_report` (вкл. `ENABLE_SELF_CRITIQUE`).
- **Цитаты** — только из курируемого корпуса `app/data/quotes_corpus.py` с `source_id`; расширение до RAG/эмбеддингов — следующий шаг.

Версия методологии: `app/prompts/master.py` → `PROMPT_VERSION`.

## Производительность LLM

- Уточняющие вопросы по умолчанию идут в **Sonnet** (`ANTHROPIC_MODEL_QUESTIONS`), итоговый отчёт — **Opus** с structured output и (если не отключено) adaptive thinking.
- **`FAST_ANALYSIS=true`** (Railway Variables): отключает роутер Haiku, второй проход self-critique и adaptive thinking на анализе; effort снижается до `medium`; лимит токенов анализа не выше 8192. Для максимального качества оставь `FAST_ANALYSIS=false`, при необходимости задай `ANTHROPIC_MODEL_QUESTIONS=claude-opus-4-7` и `ENABLE_SELF_CRITIQUE=true`.
- **`ANTHROPIC_ANALYSIS_THINKING`** / **`ANTHROPIC_CRITIQUE_THINKING`** — точечное отключение thinking без полного fast-режима.
- Цитаты и вызов роутера (если включён) выполняются **параллельно** (`asyncio.gather`), клиент Anthropic **переиспользуется** в процессе.
- Потоковая отдача ответов (SSE) в API **не реализована** — при появлении метрик латентности можно вынести в отдельную задачу.

## Локальный запуск

```bash
cd logika-server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env
# Заполни .env: DATABASE_URL (или оставь sqlite), JWT_SECRET, ANTHROPIC_API_KEY, SMSAERO_*
uvicorn app.main:app --reload --port 8000
```

- `GET /health` — проверка
- `POST /v1/auth/request-code` — `{ "phone": "+79991234567" }` → `{"ok":true}` (SMS уходит в фоне)
- `POST /v1/auth/request-email-code` — `{ "email": "you@example.com" }` → `{"ok":true}` (письмо в фоне)
- `POST /v1/auth/verify` — `{ "phone", "code" }` **или** `{ "email", "code" }` → JWT
- `POST /v1/sessions/start` — заголовок `Authorization: Bearer …`, тело `{ "dilemma": "…" }`
- `POST /v1/sessions/{id}/reply` — `{ "text": "…" }`
- `GET /v1/sessions/{id}` — полная сессия (диалог, фаза, отчёт) для владельца; для восстановления UI после перезагрузки
- `GET /v1/sessions/{id}/pdf` — скачивание PDF
- `GET /v1/me` — профиль (телефон, почта, имя) по JWT
- `GET /v1/cabinet` — история сессий и агрегированная статистика для личного кабинета

## Railway

1. Новый сервис из репозитория, **Root Directory** = `logika-server`.
2. Добавь **PostgreSQL** плагин и привяжи `DATABASE_URL`.
3. Переменные (Variables):

| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Длинная случайная строка |
| `CORS_ORIGINS` | Свой домен фронта и `http://localhost:5173` через запятую. Деплои на `*.vercel.app` допускаются автоматически (regex в `main.py`). |
| `SMSAERO_EMAIL` | Логин кабинета SMS Aero |
| `SMSAERO_API_KEY` | API-ключ |
| `SMSAERO_SIGN` | Подпись отправителя из кабинета |
| `SMSAERO_ALLOW_LOG_ONLY` | На проде **не задавай** или `false`. Если `true` при пустых ключах — код только в логах Railway, SMS не уйдёт. |
| `SMSAERO_TEST_MODE` | `true` → метод API `sms/testsend` (тестовая ветка в [доке SMS Aero](https://smsaero.ru/integration/documentation/api/)). На проде обычно `false`. |
| `SMSAERO_HTTP_TIMEOUT_SECONDS` | Таймаут HTTP к шлюзу (по умолчанию `12`). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` | Для `POST /v1/auth/request-email-code`. |
| `EMAIL_ALLOW_LOG_ONLY` | Локалка: `true` — код в логах без SMTP. На проде задайте SMTP. |
| `ANTHROPIC_API_KEY` | Ключ [Anthropic Console](https://console.anthropic.com/) — **обязателен** для Sonnet/Opus; без него раньше включался демо-режим в чате. |
| `ANTHROPIC_ALLOW_DEMO_WITHOUT_KEY` | Только локалка: `true` = шаблон без Claude. На **production не задавай** (по умолчанию `false`). |
| `ANTHROPIC_MODEL` | По умолчанию `claude-opus-4-7` |
| `ANTHROPIC_MODEL_QUESTIONS` | По умолчанию Sonnet — см. раздел «Производительность LLM». |
| `ANTHROPIC_ANALYSIS_MAX_TOKENS` | Лимит ответа анализа (по умолчанию `12000`). |
| `ANTHROPIC_ANALYSIS_THINKING` | `true`/`false` — adaptive thinking у первого Opus (JSON-отчёт). |
| `ANTHROPIC_CRITIQUE_THINKING` | `true`/`false` — thinking у шага self-critique. |
| `FAST_ANALYSIS` | `true` — быстрый пресет (см. «Производительность LLM»). |
| `ENABLE_ROUTER` | `false` — не вызывать Haiku до анализа. |
| `ENABLE_SELF_CRITIQUE` | `false` — один проход Opus без второго «ревизора». |
| `PUBLIC_API_URL` | Публичный URL этого сервиса (опционально для ссылок) |
| `PDF_ENGINE` | `playwright` (по умолчанию) — PDF как на сайте; `reportlab` — только текст, без Chromium (не рекомендуется для прод). |
| `PDF_FALLBACK_REPORTLAB` | По умолчанию `true`: при сбое Playwright отдаётся ReportLab, скачивание не ломается. `false` — только Chromium (задавай вместе с рабочей установкой Playwright в образе). |

4. Deploy: Nixpacks подхватит `requirements.txt`, `nixpacks.toml` (`pip install` и `playwright install chromium` в одной фазе) и `Procfile`.
5. **PDF «как на сайте»:** `PDF_ENGINE=playwright` и команда из `nixpacks.toml`; при падении Chromium — ReportLab (если не выключил fallback). Ручная сборка: `pip install -r requirements.txt && python -m playwright install chromium`.

## Vercel (фронт `logika/`)

В проекте Vercel (root `logika`) задай:

`VITE_LOGIKA_API_URL=https://<твой-сервис>.up.railway.app`

Без слэша в конце.
