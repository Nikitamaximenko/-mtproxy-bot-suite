# MTProxy Bot Suite

Монорепа со структурой:

- `frontend/` — Next.js лендинг + старт для оплаты
- `bot/` — Telegram бот на **aiogram**
- `backend/` — **FastAPI** сервер (например, для вебхуков/бэкенд-API)

## Деплой (прод)

1. Подключи репозиторий к **Vercel**: Root Directory = **`frontend`**.
2. Подключи **Railway**: отдельные сервисы для **backend** и **bot** (из этого же репо, разные `Dockerfile`/start или monorepo-команды).
3. Любой **`git push origin main`** запускает деплой на Vercel и Railway (если включены auto-deploy с ветки `main`).

CI: при push/PR запускается [Verify](.github/workflows/verify.yml) (сборка frontend + проверка импорта backend).

## Быстрый старт

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### Bot (aiogram)

```bash
cd bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

