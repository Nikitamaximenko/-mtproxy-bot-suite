# Logika API

Бэкенд для приложения «Логика»: PostgreSQL, вход по SMS через [SMS Aero](https://smsaero.ru/integration/documentation/api/), уточняющие вопросы и отчёт через **Claude Opus 4.7** (настраивается через `ANTHROPIC_MODEL_*`), выдача PDF (ReportLab).

## Архитектура LLM (юнит-экономика)

- **Router (Haiku)** — лёгкая классификация дилеммы (вкл. `ENABLE_ROUTER`).
- **Уточняющие вопросы (Sonnet)** — дешевле Opus, тот же UX диалога.
- **Глубокий анализ (Opus + adaptive thinking + JSON Schema)** — законы, искажения, альтернативы; мастер-промпт с **prompt caching** на статике.
- **Self-critique (второй Opus)** — проверка слабых мест и финальный `final_report` (вкл. `ENABLE_SELF_CRITIQUE`).
- **Цитаты** — только из курируемого корпуса `app/data/quotes_corpus.py` с `source_id`; расширение до RAG/эмбеддингов — следующий шаг.

Версия методологии: `app/prompts/master.py` → `PROMPT_VERSION`.

## Локальный запуск

```bash
cd logika-server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Заполни .env: DATABASE_URL (или оставь sqlite), JWT_SECRET, ANTHROPIC_API_KEY, SMSAERO_*
uvicorn app.main:app --reload --port 8000
```

- `GET /health` — проверка
- `POST /v1/auth/request-code` — тело `{ "phone": "+79991234567" }`
- `POST /v1/auth/verify` — `{ "phone", "code" }` → JWT
- `POST /v1/sessions/start` — заголовок `Authorization: Bearer …`, тело `{ "dilemma": "…" }`
- `POST /v1/sessions/{id}/reply` — `{ "text": "…" }`
- `GET /v1/sessions/{id}/pdf` — скачивание PDF

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
| `ANTHROPIC_API_KEY` | Ключ [Anthropic Console](https://console.anthropic.com/) — **обязателен** для Sonnet/Opus; без него раньше включался демо-режим в чате. |
| `ANTHROPIC_ALLOW_DEMO_WITHOUT_KEY` | Только локалка: `true` = шаблон без Claude. На **production не задавай** (по умолчанию `false`). |
| `ANTHROPIC_MODEL` | По умолчанию `claude-opus-4-7` |
| `PUBLIC_API_URL` | Публичный URL этого сервиса (опционально для ссылок) |

4. Deploy: Nixpacks подхватит `requirements.txt` и `Procfile`.

## Vercel (фронт `logika/`)

В проекте Vercel (root `logika`) задай:

`VITE_LOGIKA_API_URL=https://<твой-сервис>.up.railway.app`

Без слэша в конце.
