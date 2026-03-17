# MTProxy Bot Suite

Монорепа со структурой:

- `frontend/` — Next.js лендинг + старт для оплаты
- `bot/` — Telegram бот на **aiogram**
- `backend/` — **FastAPI** сервер (например, для вебхуков/бэкенд-API)

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

