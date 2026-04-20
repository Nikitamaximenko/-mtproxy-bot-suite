import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Logo } from '../Logo'

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

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Шапка: бренд, контекст, дата */}
      <div className="border-border from-card/90 bg-gradient-to-br to-elevated/40 relative overflow-hidden rounded-2xl border">
        <div className="bg-accent absolute top-0 left-0 h-full w-[3px]" aria-hidden />
        <div className="relative px-5 py-7 sm:px-8 sm:py-9 md:pl-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Logo size="lg" />
                <span className="text-dim font-mono text-[11px] uppercase tracking-[0.14em]">
                  Аналитический отчёт
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem] md:leading-tight">
                Разбор решения
              </h1>
              {dilemma?.trim() ? (
                <p className="text-muted mt-5 max-w-2xl text-left text-[15px] leading-relaxed">
                  <span className="text-dim font-mono text-[10px] uppercase tracking-[0.12em]">
                    Исходный запрос
                  </span>
                  <br />
                  <span className="text-foreground mt-1 inline-block">
                    «{dilemma.length > 320 ? `${dilemma.slice(0, 320)}…` : dilemma}»
                  </span>
                </p>
              ) : null}
            </div>
            <div
              className={clsx(
                'bg-elevated/80 border-border shrink-0 rounded-xl border px-4 py-3 text-left lg:text-right',
              )}
            >
              <p className="text-dim font-mono text-[10px] uppercase tracking-[0.12em]">Документ</p>
              <p className="text-foreground mt-1 font-mono text-[13px]">
                {dateLabel ?? 'Только что'}
              </p>
            </div>
          </div>

          <div className="border-border mt-8 border-t pt-8">
            <p className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Overall Score</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <motion.span
                className="text-[clamp(3rem,14vw,5.5rem)] font-medium leading-none tracking-[-0.04em]"
                style={{ color }}
              >
                {scoreDisplay}
              </motion.span>
              <span className="text-muted text-2xl font-medium md:text-3xl">/100</span>
            </div>
            <p className="mt-6 text-left text-xl font-medium leading-snug tracking-[-0.02em] md:text-2xl">
              {String(report?.verdict_short ?? 'Решение частично логично')}
            </p>
            <p className="text-muted mt-5 max-w-prose text-left text-base leading-relaxed">
              {apiMode && report?.summary
                ? String(report.summary)
                : 'Твои аргументы проверены по четырём законам логики и типичным искажениям.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {laws.map((row, idx) => (
          <div
            key={`${row.name ?? idx}-${idx}`}
            className="border-border bg-card flex h-full flex-col rounded-xl border p-5 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-[15px] font-medium leading-snug">{row.name}</h3>
              <span className="text-dim shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">
                {row.status}
              </span>
            </div>
            <p className="text-muted mt-3 text-sm leading-relaxed">{row.comment}</p>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Искажения</h3>
        <ul className="mt-4 space-y-3">
          {biases.map((x, i) => (
            <li
              key={i}
              className="border-border bg-elevated rounded-[12px] border px-4 py-3 text-sm text-muted"
            >
              <span className="text-foreground">{x.name}</span>
              {x.hint ? ` — ${x.hint}` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Альтернативы</h3>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
          {alternatives.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>

      <blockquote className="border-border bg-card mt-14 rounded-2xl border p-6 text-left text-xl font-medium leading-snug tracking-[-0.02em] sm:p-8 md:text-2xl">
        {quote?.text ?? 'Когда факты меняются, я меняю мнение.'}
        <footer className="text-dim mt-6 font-mono text-[12px] uppercase tracking-[0.1em]">
          {quote?.author ?? 'Кейнс'}
        </footer>
      </blockquote>

      <div className="border-accent/40 bg-elevated/80 mt-12 rounded-2xl border border-l-4 px-5 py-6 sm:px-8">
        <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Финальный вывод</h3>
        <p className="text-foreground mt-4 text-left text-[17px] font-medium leading-relaxed tracking-[-0.01em] md:text-lg">
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
