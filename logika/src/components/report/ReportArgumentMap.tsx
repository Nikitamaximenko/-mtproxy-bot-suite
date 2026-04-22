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
  anchor: 'center' | 'left' | 'right'
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

function distributeX(count: number): { x: number; anchor: MapNode['anchor'] }[] {
  if (count <= 0) return []
  if (count === 1) return [{ x: 50, anchor: 'center' }]
  if (count === 2) return [
    { x: 5, anchor: 'left' },
    { x: 95, anchor: 'right' },
  ]
  return [
    { x: 5, anchor: 'left' },
    { x: 50, anchor: 'center' },
    { x: 95, anchor: 'right' },
  ]
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
    y: 13,
    anchor: 'center',
    delay: 0.05,
  })

  const premiseSlots = distributeX(passingLaws.length)
  passingLaws.forEach((l, i) => {
    nodes.push({
      id: `premise-${i}`,
      kind: 'premise',
      label: clipLabel(titleCase(l.name || 'Посылка'), 28),
      sub: l.comment ? clipLabel(l.comment, 52) : undefined,
      x: premiseSlots[i].x,
      y: 40,
      anchor: premiseSlots[i].anchor,
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
      y: 63,
      anchor: 'center',
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
      x: conflictSlots[i].x,
      y: 87,
      anchor: conflictSlots[i].anchor,
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

function shortenEdge(
  from: MapNode,
  to: MapNode,
  pullStart = 5,
  pullEnd = 5,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return {
    x1: from.x + ux * pullStart,
    y1: from.y + uy * pullStart,
    x2: to.x - ux * pullEnd,
    y2: to.y - uy * pullEnd,
  }
}

function anchorStyle(n: MapNode): React.CSSProperties {
  const base: React.CSSProperties = { left: `${n.x}%`, top: `${n.y}%` }
  if (n.anchor === 'center') return { ...base, transform: 'translate(-50%, -50%)' }
  if (n.anchor === 'left') return { ...base, transform: 'translate(0, -50%)' }
  return { ...base, transform: 'translate(-100%, -50%)' }
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
      className="border-border bg-card/60 overflow-hidden rounded-2xl border"
    >
      <div className="border-border/80 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 sm:px-7">
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
        <div className="text-dim flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em]">
          <span>
            <span className="text-accent">{graph.stats.premises}</span> опор
          </span>
          <span className="bg-border h-3 w-px" />
          <span>
            <span className="text-[#ff6b6b]">{graph.stats.conflicts}</span> трещин
          </span>
        </div>
      </div>

      <div className="relative aspect-[4/3] w-full">
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
            const { x1, y1, x2, y2 } = shortenEdge(from, to)
            const stroke = edge.relation === 'conflicts' ? '#ff4d4d' : '#c4f542'
            return (
              <motion.line
                key={`${edge.from}->${edge.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={edge.relation === 'conflicts' ? 0.4 : 0.28}
                strokeDasharray={edge.relation === 'conflicts' ? '1.2 0.8' : undefined}
                strokeLinecap="butt"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.7 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.8, ease, delay: edge.delay }}
              />
            )
          })}
        </svg>

        {graph.nodes.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.5, ease, delay: n.delay }}
            className="pointer-events-none absolute"
            style={anchorStyle(n)}
          >
            <div
              className={`${nodeClass(n.kind)} inline-flex items-center gap-2 whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[10px] font-medium shadow-[0_4px_18px_rgba(0,0,0,0.55)] sm:px-3 sm:text-xs`}
              title={n.sub}
            >
              <span className="font-mono text-[8px] uppercase tracking-[0.08em] opacity-70 sm:text-[9px]">
                {kindTag(n.kind)}
              </span>
              <span>{n.label}</span>
            </div>
          </motion.div>
        ))}
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
