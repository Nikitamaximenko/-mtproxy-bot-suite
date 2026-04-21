import type { LogikaContext } from '../bot.js'
import type { Tier } from '../../../shared/types.js'
import { TARIFFS } from '../../../shared/tariffs.js'
import { tariffKeyboard } from '../keyboards/tariffs.js'
import { activateSubscription } from '../services/billing.js'
import { storage } from '../services/storage.js'

export async function tariffCommand(ctx: LogikaContext): Promise<void> {
  await ctx.reply(
    [
      '*FREE* — 1 вопрос, базовый анализ',
      '*PRO* — 790 ₽/мес · 30 вопросов · PDF · история 30 дней',
      '*ULTRA* — 1 490 ₽/мес · без лимита · голос · история навсегда',
    ].join('\n'),
    { parse_mode: 'Markdown', reply_markup: tariffKeyboard() },
  )
}

export async function tariffCallback(ctx: LogikaContext): Promise<void> {
  await ctx.answerCallbackQuery()
  const match = ctx.match
  if (!match || typeof match !== 'object' || !('length' in match)) return
  const tier = match[1] as Tier

  if (tier === 'free') {
    ctx.session.tier = 'free'
    await ctx.reply('Переключил на FREE. 1 разбор доступен.')
    return
  }

  if (tier === 'pro') {
    await ctx.reply('Оплата PRO — через Lava. Открой web-кабинет и оплати картой.')
    return
  }

  if (tier === 'ultra') {
    await ultraInvoice(ctx)
  }
}

/**
 * Send a Telegram Stars invoice for ULTRA. Stars use XTR currency, amount is
 * integer stars. Rough conversion: 1 490 ₽ ≈ 250 stars (adjust with provider).
 */
export async function ultraInvoice(ctx: LogikaContext): Promise<void> {
  const stars = 250
  await ctx.replyWithInvoice(
    'Логика ULTRA — 1 месяц',
    'Без лимита вопросов · голосовые сообщения · PDF · история навсегда.',
    'ultra-1m',
    'XTR',
    [{ label: 'ULTRA 1 месяц', amount: stars }],
  )
}

export async function preCheckoutQuery(ctx: LogikaContext): Promise<void> {
  await ctx.answerPreCheckoutQuery(true)
}

export async function successfulPayment(ctx: LogikaContext): Promise<void> {
  const payload = ctx.message?.successful_payment?.invoice_payload
  if (payload === 'ultra-1m') {
    const userId = String(ctx.from?.id ?? 'anon')
    const sub = await activateSubscription(userId, 'ultra', 'telegram-stars', 1)
    await storage.setSubscription(sub)
    ctx.session.tier = 'ultra'
    const hours = Math.round((new Date(sub.activeUntil).getTime() - Date.now()) / 3_600_000)
    await ctx.reply(
      `Оплата прошла. ULTRA активен на ${TARIFFS.ultra.name === 'ULTRA' ? '1 месяц' : ''} (~${hours} часов).`,
    )
  }
}
