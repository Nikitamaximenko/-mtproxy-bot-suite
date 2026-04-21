import type { LogikaContext } from '../bot.js'
import { mainMenu } from '../keyboards/main.js'

export async function startHandler(ctx: LogikaContext): Promise<void> {
  await ctx.reply(
    `Логика — внешний рациональный контур.\n\nЭто не чат с ИИ. Это зеркало твоего рассуждения: 4 закона логики, 180 искажений, 2400 лет философии.\n\nЧто дальше:`,
    { reply_markup: mainMenu(), parse_mode: 'Markdown' },
  )
}

export async function helpHandler(ctx: LogikaContext): Promise<void> {
  await ctx.reply(
    [
      '*Команды:*',
      '/ask — разобрать новую дилемму',
      '/tariff — тарифы и оплата',
      '/help — это сообщение',
      '',
      '_Голосовые сообщения — только ULTRA._',
    ].join('\n'),
    { parse_mode: 'Markdown' },
  )
}
