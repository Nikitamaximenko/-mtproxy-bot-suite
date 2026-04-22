import { motion } from 'framer-motion'
import { Logo } from '../Logo'
import { ReportArgumentMap } from './ReportArgumentMap'

export function reportScoreColor(score: number): string {
  if (score < 40) return '#ff4d4d'
  if (score < 70) return '#ffb23d'
  return '#c4f542'
}

type LawRow = { name?: string; status?: string; comment?: string }
type BiasRow = { name?: string; hint?: string }

const demoLaws: LawRow[] = [
  { name: 'Тождество', status: 'частично', comment: '…' },
  { name: 'Непротиворечие', status: 'да', comment: '…' },
  { name: 'Исключённое третье', status: 'нет', comment: '…' },
  { name: 'Достаточное основание', status: 'частично', comment: '…' },
]

const demoAlts = [
  'Остаться на 90 дней с измеримым экспериментом.',
  'Уточнить финансовый буфер цифрами.',
  'Сменить контекст без смены работы.',
]

export type ReportViewProps = {
  report: Record<string, unknown> | null
  apiMode: boolean
  /** Animated or static score from parent */
  scoreDisplay: number
  dilemma?: string
  /** ISO date for meta line; omit for “сейчас” */
  documentDateIso?: string | null
}

function formatRuDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function splitSummaryBlocks(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  return t
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function ReportView({
  report,
  apiMode,
  scoreDisplay,
  dilemma,
  documentDateIso,
}: ReportViewProps) {
  const score = Number(report?.overall_score ?? 42)
  const color = reportScoreColor(score)
  const dateLabel = documentDateIso ? formatRuDate(documentDateIso) : null

  const laws: LawRow[] =
    Array.isArray(report?.laws) && (report!.laws as LawRow[]).length > 0
      ? (report!.laws as LawRow[])
      : demoLaws

  const biases: BiasRow[] =
    Array.isArray(report?.biases) && (report!.biases as BiasRow[]).length > 0
      ? (report!.biases as BiasRow[])
      : [{ name: '—', hint: 'Нет данных' }]

  const alternatives: string[] =
    Array.isArray(report?.alternatives) && (report!.alternatives as string[]).length > 0
      ? (report!.alternatives as string[])
      : demoAlts

  const quote =
    report?.quote && typeof report.quote === 'object' && report.quote !== null
      ? (report.quote as { text?: string; author?: string })
      : null

  const summaryFallback = 'Твои аргументы проверены по четырём законам логики и типичным искажениям.'
  const summarySource =
    apiMode && report?.summary && String(report.summary).trim()
      ? String(report.summary).trim()
      : summaryFallback
  const summaryParts = splitSummaryBlocks(summarySource)
  const dilemmaText =
    dilemma?.trim() && dilemma.length > 320 ? `${dilemma.slice(0, 320)}…` : dilemma?.trim()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 sm:space-y-10">
      {/* Верхняя полоса: бренд и дата — воздух, не сливается с остальным */}
      <div className="border-border/80 flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Logo size="lg" />
            <span className="bg-accent/12 text-accent border-accent/25 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              Отчёт
            </span>
          </div>
          <h1 className="text-foreground max-w-xl text-[1.65rem] font-medium leading-[1.2] tracking-[-0.03em] sm:text-3xl sm:leading-tight">
            Разбор решения
          </h1>
        </div>
        <div className="border-border bg-elevated/60 shrink-0 rounded-2xl border px-5 py-4 sm:min-w-[160px] sm:text-right">
          <p className="text-dim font-mono text-[10px] uppercase tracking-[0.14em]">Дата документа</p>
          <p className="text-foreground mt-2 font-mono text-sm leading-snug">
            {dateLabel ?? 'Только что'}
          </p>
        </div>
      </div>

      {/* Исходный запрос — отдельная «карточка», не сплошной текст с шапкой */}
      {dilemmaText ? (
        <section
          aria-labelledby="report-dilemma-heading"
          className="border-border bg-card/50 rounded-2xl border px-5 py-7 sm:px-8 sm:py-9"
        >
          <h2
            id="report-dilemma-heading"
            className="text-dim font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Исходный запрос
          </h2>
          <p className="text-foreground mt-5 text-[15px] leading-[1.75] sm:text-base sm:leading-[1.8]">
            «{dilemmaText}»
          </p>
        </section>
      ) : null}

      {/* Оценка и текст — три явных уровня: цифра → вердикт → разбор абзацами */}
      <section
        aria-labelledby="report-score-heading"
        className="border-border from-card/80 bg-gradient-to-b to-elevated/30 rounded-2xl border px-5 py-8 sm:px-10 sm:py-11"
      >
        <div className="border-accent/35 mb-10 flex items-end justify-between gap-4 border-b pb-8 sm:mb-12 sm:pb-10">
          <div>
            <h2
              id="report-score-heading"
              className="text-dim font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Оценка
            </h2>
            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <motion.span
                className="text-[clamp(3.25rem,12vw,5.75rem)] font-medium leading-none tracking-[-0.04em]"
                style={{ color }}
              >
                {scoreDisplay}
              </motion.span>
              <span className="text-muted pb-1 text-2xl font-medium md:text-3xl">/ 100</span>
            </div>
          </div>
          <div className="text-dim hidden font-mono text-[10px] uppercase tracking-[0.12em] sm:block">
            Overall
            <br />
            score
          </div>
        </div>

        <div className="space-y-8 sm:space-y-10">
          <div>
            <p className="text-dim font-mono text-[10px] uppercase tracking-[0.12em]">Вердикт</p>
            <p className="text-foreground mt-4 text-xl font-medium leading-snug tracking-[-0.02em] md:text-2xl md:leading-snug">
              {String(report?.verdict_short ?? 'Решение частично логично')}
            </p>
          </div>

          <div className="border-border border-t pt-8 sm:pt-10">
            <p className="text-dim font-mono text-[10px] uppercase tracking-[0.12em]">Разбор</p>
            <div className="text-muted mt-5 max-w-prose space-y-5 text-[15px] leading-[1.78] sm:text-base sm:leading-[1.82]">
              {summaryParts.map((block, i) => (
                <p key={i}>{block}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ReportArgumentMap report={report} dilemma={dilemma} />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
        {laws.map((row, idx) => (
          <div
            key={`${row.name ?? idx}-${idx}`}
            className="border-border bg-card flex h-full flex-col rounded-xl border p-6 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-[15px] font-medium leading-snug">{row.name}</h3>
              <span className="text-dim shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">
                {row.status}
              </span>
            </div>
            <p className="text-muted mt-4 text-sm leading-relaxed">{row.comment}</p>
          </div>
        ))}
      </div>

      <div className="mt-14">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Искажения</h3>
        <ul className="mt-5 space-y-3">
          {biases.map((x, i) => (
            <li
              key={i}
              className="border-border bg-elevated rounded-[12px] border px-4 py-3.5 text-sm text-muted"
            >
              <span className="text-foreground">{x.name}</span>
              {x.hint ? ` — ${x.hint}` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Альтернативы</h3>
        <ol className="mt-5 list-decimal space-y-4 pl-5 text-[15px] leading-relaxed text-muted sm:pl-6">
          {alternatives.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>

      <blockquote className="border-border bg-card mt-16 rounded-2xl border p-7 text-left text-xl font-medium leading-snug tracking-[-0.02em] sm:p-9 md:text-2xl">
        {quote?.text ?? 'Когда факты меняются, я меняю мнение.'}
        <footer className="text-dim mt-8 font-mono text-[12px] uppercase tracking-[0.1em]">
          {quote?.author ?? 'Кейнс'}
        </footer>
      </blockquote>

      <div className="border-accent/40 bg-elevated/80 mt-14 rounded-2xl border border-l-4 px-6 py-8 sm:px-10 sm:py-9">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Финальный вывод</h3>
        <p className="text-foreground mt-6 max-w-prose text-[17px] font-medium leading-[1.65] tracking-[-0.01em] md:text-lg md:leading-relaxed">
          {apiMode && report?.conclusion && String(report.conclusion).trim()
            ? String(report.conclusion).trim()
            : apiMode && report?.verdict_short
              ? String(report.verdict_short)
              : 'Сведи вывод к одному ясному следующему шагу: что проверить, что принять или что отложить — исходя из твоих же формулировок выше.'}
        </p>
      </div>
    </div>
  )
}
