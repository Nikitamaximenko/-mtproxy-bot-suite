# Логика — Telegram bot

Порт web-сервиса «Логика» в Telegram. Разделяет доменный слой с web-приложением
через `../shared/` (типы, законы, искажения, промпты, тарифы).

## Стек

- **grammY** — фреймворк бота + `@grammyjs/conversations` для многошаговых диалогов
- **Anthropic SDK** — анализатор через `claude-opus-4-7`, adaptive thinking, prompt caching
- **Puppeteer** — рендер dark-тема PDF через общий `pdf-preview.html`
- **Pino** — структурное логирование
- **Postgres** (Prisma) — общая БД с backend-ом

## Архитектура

```
logika/telegram/
├── src/
│   ├── bot.ts                  # entry: grammY app, session, conversations
│   ├── util/
│   │   └── session.ts          # типы сессии + initial state
│   ├── keyboards/
│   │   ├── main.ts             # главное меню
│   │   └── tariffs.ts          # переключение/апгрейд тарифов
│   ├── handlers/
│   │   ├── start.ts            # /start /help
│   │   ├── ask.ts              # /ask → входит в conversation
│   │   ├── dialog.ts           # основной 5-шаговый диалог
│   │   ├── report.ts           # отправка отчёта (hero/laws/biases/…)
│   │   ├── voice.ts            # голосовые сообщения (только ULTRA)
│   │   └── billing.ts          # /tariff, Telegram Stars, Lava webhook
│   └── services/
│       ├── analyzer.ts         # Claude call, JSON parse
│       ├── transcriber.ts      # ASR (Deepgram/Whisper)
│       ├── pdf.ts              # Puppeteer PDF
│       ├── storage.ts          # Storage interface + InMemory + Prisma
│       └── billing.ts          # unified subscription activation
└── tsconfig.json → paths @shared/* → ../shared/*
```

## Тарифы и голос

Голосовые сообщения доступны **только ULTRA**. `voice.ts` проверяет
`canUseVoice(tier)` и возвращает приглашение обновить тариф для FREE/PRO.

## Оплата

- **Telegram Stars** — внутренняя валюта Telegram. `billing.ts` шлёт invoice
  с `currency: "XTR"`, обрабатывает `pre_checkout_query` и `successful_payment`.
- **Lava** — RU карты. Webhook в общем backend-е на `/webhook/lava`.
- **Prodamus** — fallback, `/webhook/prodamus`.

## Как запустить dev

```bash
cd logika/telegram
cp .env.example .env
# заполни BOT_TOKEN и ANTHROPIC_API_KEY
pnpm install
pnpm dev
```

## Roadmap

- [ ] Prisma schema (User / Subscription / Report / Followup / VoiceUsage)
- [ ] Real ASR provider wire
- [ ] Telegram Stars → ULTRA activation cron
- [ ] Follow-up scheduler (cron → bot.api.sendMessage)
- [ ] Unify userId between web and bot
