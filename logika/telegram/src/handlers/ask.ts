import type { LogikaContext } from '../bot.js'

export async function askCommand(ctx: LogikaContext): Promise<void> {
  await ctx.conversation.enter('askDilemma')
}

export async function askAction(ctx: LogikaContext): Promise<void> {
  await ctx.answerCallbackQuery()
  await ctx.conversation.enter('askDilemma')
}
