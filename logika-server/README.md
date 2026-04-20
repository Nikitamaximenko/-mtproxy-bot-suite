# Logika API

Бэкенд для приложения «Логика»: PostgreSQL, вход по SMS через [SMS Aero](https://smsaero.ru/integration/documentation/api/), отчёты и уточняющие вопросы через **Anthropic Claude** (по умолчанию `claude-opus-4-7`), выдача PDF (ReportLab).

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
| `CORS_ORIGINS` | URL фронта на Vercel и `http://localhost:5173` через запятую |
| `SMSAERO_EMAIL` | Логин кабинета SMS Aero |
| `SMSAERO_API_KEY` | API-ключ |
| `SMSAERO_SIGN` | Подпись отправителя из кабинета |
| `ANTHROPIC_API_KEY` | Ключ [Anthropic Console](https://console.anthropic.com/) |
| `ANTHROPIC_MODEL` | По умолчанию `claude-opus-4-7` |
| `PUBLIC_API_URL` | Публичный URL этого сервиса (опционально для ссылок) |

4. Deploy: Nixpacks подхватит `requirements.txt` и `Procfile`.

## Vercel (фронт `logika/`)

В проекте Vercel (root `logika`) задай:

`VITE_LOGIKA_API_URL=https://<твой-сервис>.up.railway.app`

Без слэша в конце.
