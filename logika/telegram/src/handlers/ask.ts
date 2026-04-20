import type { Bot } from 'grammy'
import type { LogikaContext } from '../bot.js'

export function registerAskHandler(bot: Bot<LogikaContext>) {
  bot.command('ask', async (ctx) => {
    await ctx.conversation.enter('askDilemma')
  })

  bot.callbackQuery('action:ask', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.conversation.enter('askDilemma')
  })
}
