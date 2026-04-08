# Деплой Postly на Vercel

1. Залогинься в https://vercel.com через GitHub
2. New Project → выбери репозиторий с этим кодом
3. Root directory: укажи `postly/` (если репо с monorepo)
4. Environment variables — добавь:
   - DATABASE_URL (pooled из Neon)
   - DIRECT_URL (прямой из Neon)
   - AUTH_SECRET (новый, через openssl rand -base64 32)
   - AUTH_URL (https://имя-проекта.vercel.app — узнаешь после первого деплоя)
   - POSTMYPOST_API_TOKEN
   - POSTMYPOST_API_BASE_URL=https://app.postmypost.io/api/v4.1
5. Deploy
6. После первого деплоя — скопируй URL, обнови AUTH_URL в env, передеплой
7. Готово, сайт доступен по URL Vercel
