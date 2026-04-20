import 'dotenv/config'
import { Bot, session, type Context, type SessionFlavor } from 'grammy'
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations'
import pino from 'pino'

import { registerStartHandler } from './handlers/start.js'
import { registerAskHandler } from './handlers/ask.js'
import { askDilemmaConversation } from './handlers/dialog.js'
import { registerVoiceHandler } from './handlers/voice.js'
import { registerBillingHandler } from './handlers/billing.js'
import type { LogikaSession } from './util/session.js'
import { defaultSession } from './util/session.js'
import { mainMenu } from './keyboards/main.js'

export type LogikaContext = Context & SessionFlavor<LogikaSession> & ConversationFlavor<Context>

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function main() {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN is required')

  const bot = new Bot<LogikaContext>(token)

  // Session storage — in-memory for MVP, swap for Redis in production.
  bot.use(session({ initial: defaultSession }))
  bot.use(conversations())
  bot.use(createConversation(askDilemmaConversation, 'askDilemma'))

  // Handlers (wired in one place so the flow is readable)
  registerStartHandler(bot)
  registerAskHandler(bot)
  registerVoiceHandler(bot)
  registerBillingHandler(bot)

  // Fallback — unknown text → hint
  bot.on('message:text', async (ctx) => {
    await ctx.reply(
      'Я слушаю только законы логики. Нажми кнопку ниже — и начнём разбор.',
      { reply_markup: mainMenu() },
    )
  })

  bot.catch((err) => {
    log.error({ err }, 'bot error')
  })

  if (process.env.WEBHOOK_DOMAIN) {
    const path = process.env.WEBHOOK_PATH ?? '/tg'
    log.info({ domain: process.env.WEBHOOK_DOMAIN, path }, 'webhook mode (set up externally)')
    // NOTE: webhook server setup (e.g. express/fastify + webhookCallback(bot)) is intentionally
    // left to the platform you deploy on — see README for examples.
    await bot.api.setWebhook(`${process.env.WEBHOOK_DOMAIN}${path}`, {
      secret_token: process.env.WEBHOOK_SECRET,
    })
  } else {
    log.info('long-polling mode')
    await bot.start({ onStart: (info) => log.info({ username: info.username }, 'bot online') })
  }
}

main().catch((err) => {
  log.error({ err }, 'fatal')
  process.exit(1)
})
