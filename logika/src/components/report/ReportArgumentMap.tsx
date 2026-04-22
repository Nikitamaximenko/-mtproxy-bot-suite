import { motion } from 'framer-motion'
import { useMemo } from 'react'

/**
 * Personal argument map for an individual report.
 *
 * Mechanics
 * ---------
 * The map is derived **deterministically** from the server's analysis output
 * (laws / biases / dilemma / alternatives). No new model call — we reuse signal
 * that Opus already produced and expose its structure visually.
 *
 *   claim     ← the user's dilemma (single node, top)
 *   premise   ← laws passing ("да") — logic that supports the claim
 *   motive    ← primary bias — the hidden driver
 *   conflict  ← laws violated ("нет" / "частично") — ruptures
 *
 * Edges are constructed from the semantics of each node kind:
 *   premise ⟶ claim                 (supports)
 *   motive  ⟶ each premise           (supports, amplified)
 *   conflict ⟶ claim                 (conflicts)
 *   motive  ⟶ each conflict          (conflicts, "motive inflates the cracks")
 *
 * Insight
 * -------
 * After the graph is assembled we inspect its topology (node counts, hub
 * degrees, conflict ratio) and pick a single sentence that tells the user
 * something they wouldn't see from the laws-list alone.
 */

type LawRow = { name?: string; status?: string; comment?: string }
type BiasRow = { name?: string; hint?: string }

type NodeKind = 'claim' | 'premise' | 'motive' | 'conflict'

type MapNode = {
  id: string
  kind: NodeKind
  label: string
  sub?: string
  x: number
  y: number
  delay: number
}

type MapEdge = {
  from: string
  to: string
  relation: 'supports' | 'conflicts'
  delay: number
}

type Graph = {
  nodes: MapNode[]
  edges: MapEdge[]
  stats: { premises: number; conflicts: number; supports: number; edges: number }
  insight: { title: string; body: string }
}

const ease = [0.32, 0.72, 0, 1] as const

function clipLabel(text: string, max: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).trimEnd() + '…'
}

function titleCase(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t[0].toUpperCase() + t.slice(1)
}

function distributeX(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [50]
  if (count === 2) return [20, 80]
  return [15, 50, 85]
}

function buildGraph(report: Record<string, unknown> | null, dilemma: string | undefined): Graph {
  const laws = Array.isArray(report?.laws) ? (report!.laws as LawRow[]) : []
  const biases = Array.isArray(report?.biases) ? (report!.biases as BiasRow[]) : []

  const claimText = clipLabel(dilemma || (report?.verdict_short as string) || 'Твой выбор', 56)

  const passingLaws = laws
    .filter((l) => (l.status || '').toLowerCase() === 'да')
    .slice(0, 3)

  const violatedLaws = laws
    .filter((l) => ['нет', 'частично'].includes((l.status || '').toLowerCase()))
    .sort((a) => ((a.status || '').toLowerCase() === 'нет' ? -1 : 1))
    .slice(0, 3)

  const primaryBias = biases[0]

  // --- Build nodes -------------------------------------------------------

  const nodes: MapNode[] = []

  nodes.push({
    id: 'claim',
    kind: 'claim',
    label: claimText,
    x: 50,
    y: 14,
    delay: 0.05,
  })

  const premiseSlots = distributeX(passingLaws.length)
  passingLaws.forEach((l, i) => {
    nodes.push({
      id: `premise-${i}`,
      kind: 'premise',
      label: clipLabel(titleCase(l.name || 'Посылка'), 28),
      sub: l.comment ? clipLabel(l.comment, 52) : undefined,
      x: premiseSlots[i],
      y: 40,
      delay: 0.25 + i * 0.08,
    })
  })

  if (primaryBias && primaryBias.name) {
    nodes.push({
      id: 'motive',
      kind: 'motive',
      label: clipLabel(titleCase(primaryBias.name), 32),
      sub: primaryBias.hint ? clipLabel(primaryBias.hint, 60) : undefined,
      x: 50,
      y: 58,
      delay: 0.55,
    })
  }

  const conflictSlots = distributeX(violatedLaws.length)
  violatedLaws.forEach((l, i) => {
    nodes.push({
      id: `conflict-${i}`,
      kind: 'conflict',
      label: clipLabel(titleCase(l.name || 'Трещина'), 28),
      sub: l.comment ? clipLabel(l.comment, 52) : undefined,
      x: conflictSlots[i],
      y: 86,
      delay: 0.8 + i * 0.08,
    })
  })

  // --- Build edges -------------------------------------------------------

  const edges: MapEdge[] = []
  const premiseIds = nodes.filter((n) => n.kind === 'premise').map((n) => n.id)
  const conflictIds = nodes.filter((n) => n.kind === 'conflict').map((n) => n.id)
  const hasMotive = nodes.some((n) => n.id === 'motive')

  premiseIds.forEach((id, i) => {
    edges.push({ from: id, to: 'claim', relation: 'supports', delay: 0.45 + i * 0.05 })
    if (hasMotive) {
      edges.push({ from: 'motive', to: id, relation: 'supports', delay: 0.7 + i * 0.05 })
    }
  })
  conflictIds.forEach((id, i) => {
    edges.push({ from: id, to: 'claim', relation: 'conflicts', delay: 1.0 + i * 0.05 })
    if (hasMotive) {
      edges.push({ from: 'motive', to: id, relation: 'conflicts', delay: 1.15 + i * 0.05 })
    }
  })

  // --- Topology stats + insight -----------------------------------------

  const supportsCount = edges.filter((e) => e.relation === 'supports').length

  const motiveLabel = hasMotive ? (nodes.find((n) => n.id === 'motive')!.label) : ''

  let insight: { title: string; body: string }

  if (conflictIds.length === 0 && premiseIds.length > 0) {
    insight = {
      title: 'Ни одной трещины — и это подозрительно',
      body: hasMotive
        ? `Формально аргумент цел: ${premiseIds.length} посылк${premiseIds.length === 1 ? 'а' : 'и'} ведут к тезису без контрударов. Но мотив «${motiveLabel}» питает каждую из них — вопрос не «верно ли», а «ты точно хочешь, или просто удобно».`
        : `Аргумент держится на ${premiseIds.length} посылк${premiseIds.length === 1 ? 'е' : 'ах'} без трещин. Это редкость — проверь, не защищаешь ли ты уже принятое решение.`,
    }
  } else if (conflictIds.length > premiseIds.length) {
    insight = {
      title: 'Трещин больше, чем опор',
      body: `${conflictIds.length} противореч${conflictIds.length === 1 ? 'ие' : 'ия'} против ${premiseIds.length || 'нет'} посыл${premiseIds.length === 1 ? 'ки' : 'ок'}. Тезис держится больше инерцией, чем логикой${hasMotive ? ` — и мотив «${motiveLabel}» как раз и есть эта инерция.` : '.'}`,
    }
  } else if (conflictIds.length === premiseIds.length && premiseIds.length > 0) {
    insight = {
      title: 'Хрупкое равновесие',
      body: `${premiseIds.length} за, ${conflictIds.length} против. Одна дополнительная проверка в любую сторону опрокинет решение${hasMotive ? ` — особенно если всмотреться в мотив «${motiveLabel}».` : '.'}`,
    }
  } else if (hasMotive && conflictIds.length > 0) {
    insight = {
      title: `Корень — мотив «${motiveLabel}»`,
      body: `Все ${conflictIds.length} трещин${conflictIds.length === 1 ? 'а упирается' : 'ы упираются'} в него же, из него растут ${premiseIds.length || 'все'} посылки. Разрешишь этот мотив — карта перестроится сама. Не разрешишь — остальные аргументы будут его прикрытием.`,
    }
  } else if (premiseIds.length > 0 && conflictIds.length === 0 && !hasMotive) {
    insight = {
      title: 'Чистый, но плоский аргумент',
      body: `${premiseIds.length} посылк${premiseIds.length === 1 ? 'а' : 'и'}, ноль трещин и мотив не проявлен. Либо решение действительно простое, либо ты ещё не задал ему правильных вопросов.`,
    }
  } else {
    insight = {
      title: 'Скелет аргумента',
      body: `${premiseIds.length} посыл${premiseIds.length === 1 ? 'ка' : 'ок'}, ${conflictIds.length} противореч${conflictIds.length === 1 ? 'ие' : 'ий'}${hasMotive ? `, в основе — мотив «${motiveLabel}»` : ''}. Смотри, где линия идёт пунктиром — это места, где рассуждение рвётся.`,
    }
  }

  return {
    nodes,
    edges,
    stats: {
      premises: premiseIds.length,
      conflicts: conflictIds.length,
      supports: supportsCount,
      edges: edges.length,
    },
    insight,
  }
}

// ----- Rendering helpers -------------------------------------------------

function nodeClass(kind: NodeKind): string {
  switch (kind) {
    case 'claim':
      return 'bg-accent text-background'
    case 'premise':
      return 'bg-elevated text-foreground border border-border-hover'
    case 'motive':
      return 'bg-[#2a1d0c] text-[#ffb23d] border border-[#ffb23d]/45'
    case 'conflict':
      return 'bg-[#2a1010] text-[#ff6b6b] border border-[#ff4d4d]/45'
  }
}

function kindTag(kind: NodeKind): string {
  switch (kind) {
    case 'claim':
      return 'Тезис'
    case 'premise':
      return 'Посылка'
    case 'motive':
      return 'Мотив'
    case 'conflict':
      return 'Трещина'
  }
}

/** Curve conflict edges around the motive node so they don't slice through it. */
function conflictEdgePath(ax: number, ay: number, bx: number, by: number): string {
  const midx = (ax + bx) / 2
  const midy = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const ox = (-dy / len) * 14
  const oy = (dx / len) * 14
  return `M ${ax} ${ay} Q ${midx + ox} ${midy + oy} ${bx} ${by}`
}

// ----- Component ---------------------------------------------------------

export type ReportArgumentMapProps = {
  report: Record<string, unknown> | null
  dilemma?: string
}

export function ReportArgumentMap({ report, dilemma }: ReportArgumentMapProps) {
  const graph = useMemo(() => buildGraph(report, dilemma), [report, dilemma])

  // If neither premises nor conflicts nor motive derived — graph is empty.
  // Hide the whole section; no value in rendering just a floating claim.
  const hasContent =
    graph.nodes.some((n) => n.kind !== 'claim') && graph.edges.length > 0
  if (!hasContent) return null

  return (
    <section
      aria-labelledby="report-argmap-heading"
      className="border-border bg-card/60 relative overflow-visible rounded-2xl border"
    >
      <div className="border-border/80 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-7 sm:py-4">
        <div>
          <p
            id="report-argmap-heading"
            className="text-dim font-mono text-[10px] uppercase tracking-[0.14em]"
          >
            Карта аргумента
          </p>
          <p className="text-foreground mt-1.5 text-[15px] font-medium leading-snug">
            Твоё рассуждение — в узлах и рёбрах
          </p>
        </div>
        <div className="text-dim hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] sm:flex">
          <span>
            <span className="text-accent">{graph.stats.premises}</span> опор
          </span>
          <span className="bg-border h-3 w-px" />
          <span>
            <span className="text-[#ff6b6b]">{graph.stats.conflicts}</span> трещин
          </span>
        </div>
      </div>

      <div className="relative aspect-[1/1.1] w-full overflow-visible px-1 sm:aspect-[4/3] sm:px-2">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <pattern id="report-argmap-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="rgba(255,255,255,0.035)"
                strokeWidth="0.3"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#report-argmap-grid)" />
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((n) => n.id === edge.from)!
            const to = graph.nodes.find((n) => n.id === edge.to)!
            if (!from || !to) return null
            const stroke = edge.relation === 'conflicts' ? '#ff4d4d' : '#c4f542'
            const isConflict = edge.relation === 'conflicts'
            const d = isConflict
              ? conflictEdgePath(from.x, from.y, to.x, to.y)
              : `M ${from.x} ${from.y} L ${to.x} ${to.y}`
            return (
              <motion.path
                key={`${edge.from}->${edge.to}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={isConflict ? 0.45 : 0.3}
                strokeDasharray={isConflict ? '1.2 0.8' : undefined}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.78 }}
                transition={{ duration: 0.8, ease, delay: edge.delay }}
              />
            )
          })}
        </svg>

        {graph.nodes.map((n) => {
          const isCenter = n.kind === 'claim' || n.kind === 'motive'
          return (
            <div
              key={n.id}
              className="pointer-events-none absolute z-10 flex h-0 w-0 items-center justify-center"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <motion.div
                className="[backface-visibility:hidden]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease, delay: n.delay }}
              >
                <div
                  className={[
                    nodeClass(n.kind),
                    isCenter
                      ? 'w-[8.8rem] sm:w-[11.5rem] max-w-[min(22rem,62vw)]'
                      : 'w-[7.3rem] sm:w-[9.5rem] max-w-[min(18rem,48vw)]',
                    'shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.55)]',
                    'rounded-[10px] px-2.5 py-2 sm:px-3 sm:max-w-[min(20rem,46vw)]',
                    'flex flex-col gap-1 font-medium antialiased',
                    isCenter ? 'items-center text-center' : 'text-left',
                  ].join(' ')}
                  title={n.sub}
                >
                  <span className="font-mono text-[8px] uppercase leading-tight tracking-[0.07em] opacity-75 sm:text-[9px]">
                    {kindTag(n.kind)}
                  </span>
                  <span className="text-[11px] leading-[1.35] break-words [word-break:normal] sm:text-[13px] sm:leading-[1.48]">
                    {n.label}
                  </span>
                </div>
              </motion.div>
            </div>
          )
        })}
      </div>

      <div className="border-border/80 text-dim grid grid-cols-3 border-t font-mono text-[10px] uppercase tracking-[0.1em] sm:hidden">
        <div className="border-border/80 border-r px-3 py-2.5">
          <div className="text-accent">{graph.stats.premises}</div>
          <div>Опор</div>
        </div>
        <div className="border-border/80 border-r px-3 py-2.5">
          <div className="text-foreground">{graph.stats.edges}</div>
          <div>Рёбер</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[#ff6b6b]">{graph.stats.conflicts}</div>
          <div>Трещин</div>
        </div>
      </div>

      <div className="border-border/80 flex flex-col gap-3 border-t px-5 py-5 sm:flex-row sm:gap-6 sm:px-7 sm:py-6">
        <div className="flex-1">
          <p className="text-dim font-mono text-[10px] uppercase tracking-[0.14em]">
            Что это значит
          </p>
          <p className="text-foreground mt-2 text-[15px] font-medium leading-snug sm:text-base">
            {graph.insight.title}
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">{graph.insight.body}</p>
        </div>
        <div className="border-border/70 text-dim grid grid-cols-3 gap-0 self-start rounded-[10px] border font-mono text-[10px] uppercase tracking-[0.1em] sm:w-[220px]">
          <div className="border-border/70 border-r px-3 py-3">
            <div className="text-accent text-base leading-none">{graph.stats.premises}</div>
            <div className="mt-1">Опор</div>
          </div>
          <div className="border-border/70 border-r px-3 py-3">
            <div className="text-foreground text-base leading-none">{graph.stats.edges}</div>
            <div className="mt-1">Рёбер</div>
          </div>
          <div className="px-3 py-3">
            <div className="text-base leading-none text-[#ff6b6b]">{graph.stats.conflicts}</div>
            <div className="mt-1">Трещин</div>
          </div>
        </div>
      </div>
    </section>
  )
}
