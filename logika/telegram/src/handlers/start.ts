import type { Bot } from 'grammy'
import type { LogikaContext } from '../bot.js'
import { mainMenu } from '../keyboards/main.js'

export function registerStartHandler(bot: Bot<LogikaContext>) {
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name ?? 'друг'
    await ctx.reply(
      [
        `*Логика.* Внешний рациональный контур для твоих решений.`,
        ``,
        `Привет, ${name}. Я не советую. Я проверяю.`,
        `Четыре закона логики, сотня искажений, один PDF-отчёт — за 4 минуты разговора.`,
        ``,
        `Готов начать?`,
      ].join('\n'),
      { parse_mode: 'Markdown', reply_markup: mainMenu() },
    )
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        `*Команды*`,
        `/start — главное меню`,
        `/ask — разобрать новое решение`,
        `/history — список прошлых отчётов`,
        `/tariff — управление подпиской`,
        ``,
        `На тарифе *ULTRA* можно отвечать голосом — просто надиктуй ответ.`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    )
  })
}
