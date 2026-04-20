import type { Conversation } from '@grammyjs/conversations'
import type { Context } from 'grammy'
import { BOT_QUESTIONS } from '../../../shared/prompts.js'
import { analyze } from '../services/analyzer.js'
import { deliverReport } from './report.js'

/**
 * Core 5-step interrogation — mirrors the web flow.
 * Uses grammY conversations so the state survives across updates naturally.
 */
export async function askDilemmaConversation(
  conv: Conversation<Context, Context>,
  ctx: Context,
) {
  await ctx.reply(
    [
      '*Опиши дилемму. Как себе в 3 часа ночи.*',
      '',
      'Одно сообщение. Без самоцензуры. Можно текстом или голосом (голос — в ULTRA).',
    ].join('\n'),
    { parse_mode: 'Markdown' },
  )

  const firstCtx = await conv.waitFor('message:text')
  const firstQuestion = firstCtx.message.text.trim()
  if (firstQuestion.length < 8) {
    await firstCtx.reply('Коротковато. Попробуй описать подробнее — хотя бы 2–3 предложения.')
    return
  }

  const answers: string[] = []
  for (let i = 0; i < BOT_QUESTIONS.length; i += 1) {
    await ctx.reply(`*Вопрос ${i + 1} из 5*\n\n${BOT_QUESTIONS[i]}`, { parse_mode: 'Markdown' })
    const ansCtx = await conv.waitFor('message:text')
    answers.push(ansCtx.message.text.trim())
  }

  await ctx.reply('Разбираю ответы на атомы…')

  const report = await conv.external(() =>
    analyze({
      userId: String(ctx.from?.id ?? 'anon'),
      tier: 'FREE',
      firstQuestion,
      dialog: [
        { role: 'user', text: firstQuestion, source: 'text' },
        ...BOT_QUESTIONS.flatMap((q, i) => [
          { role: 'bot' as const, text: q },
          { role: 'user' as const, text: answers[i], source: 'text' as const },
        ]),
      ],
      requestedAt: new Date().toISOString(),
      source: 'telegram',
    }),
  )

  await deliverReport(ctx, report)
}
