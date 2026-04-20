import type { Bot } from 'grammy'
import type { LogikaContext } from '../bot.js'
import { TARIFFS, yearlyPrice, type Tier } from '../../../shared/tariffs.js'
import { tariffKeyboard } from '../keyboards/tariffs.js'

const TIER_DESCRIPTION: Record<Tier, string> = {
  FREE: 'Один разбор, навсегда. Без истории, без голоса.',
  PRO: '30 разборов в месяц, история 30 дней, PDF, карта аргумента.',
  ULTRA: 'Безлимит разборов, голосовые до 30 мин/мес, история без срока, приоритет.',
}

export function registerBillingHandler(bot: Bot<LogikaContext>) {
  bot.command('tariff', async (ctx) => showTariffs(ctx))
  bot.callbackQuery('action:tariff', async (ctx) => {
    await ctx.answerCallbackQuery()
    await showTariffs(ctx)
  })

  bot.callbackQuery(/^tariff:(FREE|PRO|ULTRA)(:yearly)?$/, async (ctx) => {
    const tier = ctx.match[1] as Tier
    const yearly = Boolean(ctx.match[2])
    await ctx.answerCallbackQuery()

    if (tier === 'FREE') {
      ctx.session.tier = 'FREE'
      await ctx.reply('FREE активирован. Один разбор — и мы поймём, нужен ли тебе PRO.')
      return
    }

    // Telegram Stars invoice stub — wire to real prices in production.
    const price = yearly ? yearlyPrice(tier) : TARIFFS[tier].monthlyRub
    const label = yearly ? `${tier} · год` : `${tier} · месяц`
    await ctx.replyWithInvoice(
      `Логика ${label}`,
      TIER_DESCRIPTION[tier],
      `sub:${tier}:${yearly ? 'y' : 'm'}:${ctx.from?.id}`,
      'XTR', // Telegram Stars
      [{ label, amount: price /* in smallest currency unit */ }],
      { need_email: false },
    )
  })

  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
  })

  bot.on('message:successful_payment', async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload // sub:ULTRA:m:<id>
    const [, tier] = payload.split(':') as [string, Tier]
    ctx.session.tier = tier
    await ctx.reply(
      [
        `*${tier} активирован.*`,
        '',
        tier === 'ULTRA'
          ? 'Голос включён. Можно надиктовывать ответы.'
          : 'PDF, история и карта аргумента доступны.',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    )
  })

  bot.callbackQuery('tariff:dismiss', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.editMessageReplyMarkup({ reply_markup: undefined })
  })
}

async function showTariffs(ctx: LogikaContext) {
  const current = ctx.session.tier
  await ctx.reply(
    [
      `*Текущий тариф: ${current}*`,
      '',
      `_${TIER_DESCRIPTION[current]}_`,
      '',
      'Оплата через Telegram Stars прямо в чате. Карту можно привязать на logika.app.',
    ].join('\n'),
    { parse_mode: 'Markdown', reply_markup: tariffKeyboard(current) },
  )
}
