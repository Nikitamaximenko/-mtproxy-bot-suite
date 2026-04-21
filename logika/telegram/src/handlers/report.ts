import { InputFile } from 'grammy'
import type { LogikaContext } from '../bot.js'
import type { AnalysisReport } from '../../../shared/types.js'
import { LAWS } from '../../../shared/laws.js'
import { canDownloadPdf } from '../../../shared/tariffs.js'
import { renderReportPdf } from '../services/pdf.js'
import { analyzeAgain } from '../keyboards/main.js'

const verdictIcon: Record<'ok' | 'partial' | 'violated', string> = {
  ok: '✅',
  partial: '⚠️',
  violated: '❌',
}

export async function deliverReport(ctx: LogikaContext, r: AnalysisReport): Promise<void> {
  // 1. Hero
  await ctx.reply(
    `*Вопрос:* ${escape(r.question)}\n\n*Score:* ${r.score}/100  ·  *${escape(r.verdict)}*\n\n${escape(r.summary)}`,
    { parse_mode: 'Markdown' },
  )

  // 2. Mirror
  await ctx.reply(
    [
      '*Твои слова:*',
      `_${escape(r.mirror.userWords)}_`,
      '',
      '*Что ты структурно сказал:*',
      `П1 — ${escape(r.mirror.structured.p1)}`,
      `П2 — ${escape(r.mirror.structured.p2)}`,
      `∴ — ${escape(r.mirror.structured.conclusion)}`,
      `! — ${escape(r.mirror.structured.check)}`,
    ].join('\n'),
    { parse_mode: 'Markdown' },
  )

  // 3. Laws
  const lawLines = r.laws.map(
    (l) => `${verdictIcon[l.verdict]} *${escape(LAWS[l.key].title)}*\n_${escape(l.note)}_`,
  )
  await ctx.reply(['*Законы логики:*', ...lawLines].join('\n\n'), { parse_mode: 'Markdown' })

  // 4. Biases
  if (r.biases.length) {
    const bLines = r.biases.map((b) => `• *${escape(b.title)}* — ${escape(b.note)}`)
    await ctx.reply(['*Искажения:*', ...bLines].join('\n\n'), { parse_mode: 'Markdown' })
  }

  // 5. Alternatives
  if (r.alternatives.length) {
    const aLines = r.alternatives.map((a, i) => `${i + 1}. *${escape(a.title)}* — ${escape(a.rationale)}`)
    await ctx.reply(['*Альтернативы:*', ...aLines].join('\n\n'), { parse_mode: 'Markdown' })
  }

  // 6. PDF (PRO/ULTRA)
  if (canDownloadPdf(ctx.session.tier)) {
    try {
      const pdf = await renderReportPdf(r)
      await ctx.replyWithDocument(new InputFile(pdf, `logika-${r.id}.pdf`))
    } catch {
      await ctx.reply('PDF временно недоступен — попробуй позже.')
    }
  }

  // 7. Follow-up
  if (r.followup) {
    await ctx.reply(
      `*Сверим через ${r.followup.daysFromNow} дней:*\n${escape(r.followup.message)}`,
      { parse_mode: 'Markdown' },
    )
  }

  // 8. Menu
  await ctx.reply('Что дальше?', { reply_markup: analyzeAgain() })
}

function escape(s: string): string {
  return s.replace(/([*_`\[\]()])/g, '\\$1')
}
