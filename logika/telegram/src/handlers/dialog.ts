import type { Conversation } from '@grammyjs/conversations'
import type { LogikaContext } from '../bot.js'
import { BOT_QUESTIONS } from '../../../shared/prompts.js'
import type { DialogTurn } from '../../../shared/types.js'
import { analyzeDialog } from '../services/analyzer.js'
import { deliverReport } from './report.js'

export async function askDilemmaConversation(
  conversation: Conversation<LogikaContext, LogikaContext>,
  ctx: LogikaContext,
): Promise<void> {
  await ctx.reply(
    'Сформулируй дилемму одним сообщением. Как другу. Без самоцензуры — чем честнее, тем точнее разбор.',
  )

  const first = await conversation.waitFor('message:text')
  const dilemma = first.message.text.trim()
  if (dilemma.length < 8) {
    await ctx.reply('Слишком коротко. Опиши подробнее — хотя бы 2–3 предложения.')
    return
  }

  const dialog: DialogTurn[] = [{ role: 'user', text: dilemma }]

  for (let i = 0; i < BOT_QUESTIONS.length; i += 1) {
    const question = BOT_QUESTIONS[i]
    await ctx.reply(`Уточнение ${i + 1}/${BOT_QUESTIONS.length}\n\n${question}`)
    dialog.push({ role: 'bot', text: question })

    const answer = await conversation.waitFor('message:text')
    dialog.push({ role: 'user', text: answer.message.text.trim() })
  }

  await ctx.reply('Анализирую по 4 законам и каталогу искажений…')

  const userId = String(ctx.from?.id ?? 'anon')
  const tier = ctx.session.tier

  const report = await conversation.external(() =>
    analyzeDialog({ userId, tier, dialog }),
  )

  ctx.session.lastReportId = report.id
  ctx.session.dialog = []
  ctx.session.step = 0

  await deliverReport(ctx, report)
}
