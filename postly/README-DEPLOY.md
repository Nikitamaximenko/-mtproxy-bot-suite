# Деплой Postly на Vercel

1. Залогинься в https://vercel.com через GitHub
2. New Project → выбери репозиторий с этим кодом
3. Root directory: укажи `postly/` (если репо с monorepo)
4. Environment variables — добавь:
   - **DATABASE_URL** — connection string **с пулером** Neon (для runtime Next.js / serverless)
   - **DIRECT_URL** — **прямой** host Neon (без `-pooler`); нужен для `prisma migrate deploy` на сборке Vercel
   - AUTH_SECRET (новый, через `openssl rand -base64 32`)
   - AUTH_URL (https://имя-проекта.vercel.app — узнаешь после первого деплоя)
   - POSTMYPOST_API_TOKEN
   - POSTMYPOST_API_BASE_URL=https://app.postmypost.io/api/v4.1
5. Deploy — при сборке выполняется `prisma migrate deploy` (схема в БД синхронизируется с репозиторием).
6. После первого деплоя — скопируй URL, обнови AUTH_URL в env, передеплой
7. Готово, сайт доступен по URL Vercel

### Если база уже создавалась через `db push`

Таблицы есть, но нет истории миграций — первый `migrate deploy` может упасть. Один раз локально (с `.env.local` с теми же `DATABASE_URL` / `DIRECT_URL`):

```bash
cd postly && npx dotenv-cli -e .env.local -- prisma migrate resolve --applied 20250418000000_init
```

Потом снова деплой на Vercel.

### Mini App / бэкенд (не Postly)

База у **Python backend** на Railway: в Variables задай **Postgres** `DATABASE_URL` (не оставляй пустым — иначе SQLite на проде). Фронт на Vercel: **BACKEND_URL** = публичный URL этого бэкенда.
