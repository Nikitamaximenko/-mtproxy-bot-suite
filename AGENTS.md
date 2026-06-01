# Инструкции для агента (Cursor / AI)

## Как работать в проекте (CLAUDE.md)

1. **Повторяющееся → скилл** в `.cursor/skills/` (не объяснять одно и то же в чате).
2. Скилл = **description** (когда) + **instructions** (как) + **`tools/`** (скрипты).
3. **Не монолит** — `frosty-engineering`, `frosty-amnezia-pivot`, и т.д.
4. В конце сессии: что забрать в скилл навсегда.
5. Повторяемую логику — в `scripts/`, не генерировать заново.

Базовые скиллы репозитория:

- `.cursor/skills/frosty-engineering/` — любая задача в этом repo.
- `.cursor/skills/frosty-amnezia-pivot/` — пивот на AmneziaWG, обход блокировки IP.

Стратегия Amnezia: `docs/AMNEZIA_PIVOT.md`. **Пилот только для** `VPN_STACK_PILOT_TG_IDS` — реальным юзерам стек не менять без явного запроса.

## Деплой в прод

После любых осмысленных правок в **`backend/`**, **`frontend/`** или **`bot/`**:

1. Убедись, что в коммит не попадают локальные артефакты: `frontend/next-env.d.ts` (если это только dev-правки Next), секреты `.env`.
2. Выполни **`git add`** нужных файлов.
3. **`git commit -m "..."`** с понятным сообщением.
4. Обязательно **`git push origin main`**.

Репозиторий должен быть подключён к **Vercel** (корень проекта: `frontend`) и **Railway** (сервисы бэкенда и бота). Тогда **push в `main` сам запускает деплой** на стороне хостинга.

Если `git push` из среды агента невозможен (нет прав/сети), явно напиши пользователю выполнить push локально.

## Проверка до push

При желании локально: `cd frontend && npm install && npm run build`, `cd backend && pip install -r requirements.txt && python -c "import main"`.
