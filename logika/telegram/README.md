# Логика · Telegram Bot

Перенос веб-сервиса «Логика» в Telegram. Тот же анализ, тот же PDF, та же подписка —
только без веба. Основная задача бота — принять текст или голос, провести 5-шаговый
уточняющий диалог, сгенерировать отчёт и PDF.

## Архитектура

```
logika/
├── shared/                      <-- общий домен (web + tg)
│   ├── types.ts
│   ├── laws.ts
│   ├── biases.ts
│   ├── prompts.ts
│   └── tariffs.ts
├── src/                         <-- web (Vite + React)
└── telegram/                    <-- этот пакет
    ├── src/
    │   ├── bot.ts               entry
    │   ├── handlers/
    │   │   ├── start.ts         /start, /help
    │   │   ├── ask.ts           свободный ввод дилеммы
    │   │   ├── dialog.ts        5 уточняющих вопросов
    │   │   ├── voice.ts         ULTRA-only: voice → text
    │   │   ├── report.ts        отдаёт карточки + PDF
    │   │   └── billing.ts       /subscribe, /status, payment webhooks
    │   ├── services/
    │   │   ├── analyzer.ts      вызов Claude API (Opus 4.7 adaptive)
    │   │   ├── transcriber.ts   голос → текст
    │   │   ├── pdf.ts           рендер HTML-отчёта в PDF (Puppeteer)
    │   │   ├── storage.ts       persist сессий/отчётов (Prisma + Postgres)
    │   │   └── billing.ts       Lava / Telegram Stars / Prodamus
    │   ├── keyboards/
    │   │   ├── main.ts
    │   │   └── tariffs.ts
    │   └── util/
    │       ├── session.ts       stateful диалог (in-memory → Redis)
    │       └── markdown.ts
    ├── package.json
    └── tsconfig.json
```

## Стек

- **grammY** (`grammy`, `@grammyjs/conversations`) — лёгкий типобезопасный Telegram API
- **Claude API** — `@anthropic-ai/sdk`, модель `claude-opus-4-7`, adaptive thinking
- **Puppeteer** — генерирует PDF из `pdf-preview.html` (тот же HTML, что и в вебе, 1:1)
- **Prisma + Postgres** — пользователи, подписки, история отчётов
- **Redis** (опционально) — сессии диалога, rate-limit

## Подписки

Планы — те же, что и на вебе (см. `shared/tariffs.ts`): FREE / PRO / ULTRA. Платёжные
источники:

- **Telegram Stars** — самый гладкий путь для TG-первичных пользователей (webhook `pre_checkout_query`)
- **Lava** — для карт РФ (там же, где веб; id подписки из `LAVA_SUBSCRIPTION_ID`)
- **Prodamus** — fallback/альтернатива, sys=`meetingai` в checkout URL

Пользователь, оплативший ULTRA через Telegram Stars, получает те же права в вебе — единый `userId`
связывается через `tg_id` при первом заходе.

## Голосовые сообщения (ULTRA)

1. Бот принимает `voice` (OGG/Opus).
2. Скачивает через `bot.api.getFile`, передаёт в транскрайбер.
3. Транскрипция сохраняется как обычный ответ пользователя в диалоге.
4. Учёт: `voiceSecondsPerMonth = 1800` (30 минут/мес), сбрасывается первого числа.
5. Если тариф не ULTRA — отвечает карточкой с кнопкой «Подключить ULTRA».

## Поток диалога (MVP)

```
/start
  ├── Новый пользователь → onboarding (3 карточки)
  └── Знакомый → приветствие + меню

Главное меню:
  [🔍 Разобрать решение] [📜 История] [👤 Тариф]

«Разобрать решение»
  → бот: «Опиши дилемму. Как себе в 3 часа ночи.»
  → пользователь: текст или голос
  → 5 уточняющих вопросов по одному
  → анализ (adaptive thinking, 3-5 сек)
  → отчёт: сначала карточки в чате, затем PDF как документ
  → предложение «В пятницу спросить — ты это сделал?»
```

## Переменные окружения

Скопировать `.env.example` в `.env`:

- `BOT_TOKEN` — от @BotFather
- `ANTHROPIC_API_KEY` — Claude API
- `DATABASE_URL` — postgres
- `REDIS_URL` — опционально
- `LAVA_API_KEY`, `LAVA_SUBSCRIPTION_ID` — для карт
- `PRODAMUS_SECRET`, `PRODAMUS_SYS` — fallback
- `WEBHOOK_DOMAIN` — публичный домен для Stars-платежей и Lava webhooks
- `PDF_PREVIEW_URL` — http(s) URL к `pdf-preview.html` для Puppeteer

## Запуск (после настройки)

```bash
cd logika/telegram
pnpm install
pnpm dev     # long-polling
pnpm build
pnpm start   # webhook mode
```

## Что уже реализовано в каркасе

- `src/bot.ts` — точка входа, регистрация хендлеров, session middleware
- `src/handlers/` — заглушки со структурой основных сценариев (TODO-комментарии)
- `src/services/analyzer.ts` — сигнатура вызова Claude API, подключается к `shared/prompts.ts`
- `src/keyboards/` — главное меню и тарифы
- `src/util/session.ts` — типизированная in-memory сессия

## Что предстоит

- [ ] Подключить Prisma-схему (пользователи, отчёты, подписки)
- [ ] Реализовать `services/pdf.ts` через Puppeteer + HTML-шаблон из `logika/public/pdf-preview.html`
- [ ] Реализовать `services/analyzer.ts` с реальным вызовом Claude API и JSON-парсингом
- [ ] Склеить Telegram Stars `pre_checkout` → активация ULTRA
- [ ] Cron на follow-up («в пятницу спрошу»)
- [ ] Перенос единого `userId` между вебом и ботом через связку tg_id/phone
