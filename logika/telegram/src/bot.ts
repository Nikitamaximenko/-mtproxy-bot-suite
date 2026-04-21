import 'dotenv/config'
import { Bot, session, type Context, type SessionFlavor } from 'grammy'
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations'
import pino from 'pino'
import { initialSession, type LogikaSession } from './util/session.js'
import { startHandler, helpHandler } from './handlers/start.js'
import { askCommand, askAction } from './handlers/ask.js'
import { askDilemmaConversation } from './handlers/dialog.js'
import { voiceHandler } from './handlers/voice.js'
import {
  tariffCommand,
  tariffCallback,
  ultraInvoice,
  preCheckoutQuery,
  successfulPayment,
} from './handlers/billing.js'

export type LogikaContext = ConversationFlavor<Context & SessionFlavor<LogikaSession>>

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

const token = process.env.BOT_TOKEN
if (!token) {
  logger.fatal('BOT_TOKEN is not set')
  process.exit(1)
}

const bot = new Bot<LogikaContext>(token)

bot.use(session({ initial: initialSession }))
bot.use(conversations())
bot.use(createConversation(askDilemmaConversation, 'askDilemma'))

bot.command('start', startHandler)
bot.command('help', helpHandler)
bot.command('ask', askCommand)
bot.command('tariff', tariffCommand)

bot.callbackQuery('action:ask', askAction)
bot.callbackQuery(/^tariff:(free|pro|ultra)$/, tariffCallback)
bot.callbackQuery('upgrade:ultra', ultraInvoice)

bot.on('pre_checkout_query', preCheckoutQuery)
bot.on('message:successful_payment', successfulPayment)

bot.on('message:voice', voiceHandler)

bot.catch((err) => {
  logger.error({ err }, 'bot error')
})

const mode = process.env.WEBHOOK_URL ? 'webhook' : 'long-polling'
if (mode === 'webhook') {
  const { webhookCallback } = await import('grammy')
  const http = await import('node:http')
  const cb = webhookCallback(bot, 'http')
  const port = Number(process.env.PORT ?? 8080)
  http
    .createServer(async (req, res) => {
      try {
        await cb(req, res)
      } catch (err) {
        logger.error({ err }, 'webhook handler error')
        res.statusCode = 500
        res.end()
      }
    })
    .listen(port, () => logger.info({ port }, 'logika-telegram webhook listening'))
  await bot.api.setWebhook(process.env.WEBHOOK_URL!)
} else {
  logger.info('logika-telegram starting in long-polling mode')
  await bot.start()
}
