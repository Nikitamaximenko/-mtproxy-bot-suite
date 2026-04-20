import type { Context } from 'grammy'
import { InputFile } from 'grammy'
import type { AnalysisReport } from '../../../shared/types.js'
import { renderReportPdf } from '../services/pdf.js'
import { analyzeAgain } from '../keyboards/main.js'

const verdictEmoji = (score: number) => (score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴')

const formatLaw = (v: 'passed' | 'partial' | 'failed') =>
  v === 'passed' ? '✓ выдержан' : v === 'partial' ? '~ частично' : '✗ нарушен'

/**
 * Sends the report in chat the same shape as the web app shows it:
 * 1) hero card (score + verdict)
 * 2) mirror (user words vs structural)
 * 3) laws, biases, alternatives
 * 4) PDF as document
 * 5) follow-up offer
 */
export async function deliverReport(ctx: Context, r: AnalysisReport) {
  // 1. Hero
  await ctx.reply(
    [
      `${verdictEmoji(r.score)} *${r.verdictHeadline}*  ·  _${r.score}/100_`,
      '',
      `«${r.question}»`,
      '',
      r.verdictSummary,
    ].join('\n'),
    { parse_mode: 'Markdown' },
  )

  // 2. Mirror
  await ctx.reply(
    [`*Зеркало*`, '', `_Ты сказал:_`, `«${r.question}»`, '', `*Структурно:*`, r.structuralSummary].join(
      '\n',
    ),
    { parse_mode: 'Markdown' },
  )

  // 3. Laws
  await ctx.reply(
    [
      `*Четыре закона*`,
      '',
      ...r.laws.map((l) => `• *${l.title}* — ${formatLaw(l.verdict)}\n  _${l.explanation}_`),
    ].join('\n'),
    { parse_mode: 'Markdown' },
  )

  // 4. Biases
  if (r.biases.length) {
    await ctx.reply(
      [`*Искажения*`, '', ...r.biases.map((b) => `• ${b.name} — ${b.description}`)].join('\n'),
      { parse_mode: 'Markdown' },
    )
  }

  // 5. Alternatives
  if (r.alternatives.length) {
    await ctx.reply(
      [
        `*Альтернативы, которые ты не рассмотрел*`,
        '',
        ...r.alternatives.map((a, i) => `${i + 1}. *${a.title}* — ${a.description}`),
      ].join('\n'),
      { parse_mode: 'Markdown' },
    )
  }

  // 6. PDF
  try {
    const pdf = await renderReportPdf(r)
    await ctx.replyWithDocument(new InputFile(pdf, `logika-${r.id}.pdf`), {
      caption: 'Отчёт в PDF — перешли себе в избранное, чтобы вернуться через неделю.',
    })
  } catch (err) {
    await ctx.reply(
      '_PDF не собрался, но отчёт выше полный. Мы починим это._',
      { parse_mode: 'Markdown' },
    )
  }

  // 7. Follow-up offer
  await ctx.reply(
    [
      `*Вернуться через 5 дней?*`,
      '',
      'Напомним один раз и спросим — ты сделал то, что решил. Это единственный способ понять, было ли решение рациональным.',
    ].join('\n'),
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✓ Напомнить в пятницу', callback_data: `followup:${r.id}` }]] },
    },
  )

  // 8. Continue menu
  await ctx.reply('Что дальше?', { reply_markup: analyzeAgain() })
}
