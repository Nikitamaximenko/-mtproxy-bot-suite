import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const ease = [0.32, 0.72, 0, 1] as const

/**
 * Signature visualisation: while the user writes, «Логика» draws a live argument
 * graph — premises, claims, motives, and conflict edges. The animation loops.
 *
 * Built with SVG + framer-motion. No data deps — this is a landing showcase.
 */

type Node = {
  id: string
  kind: 'claim' | 'premise' | 'motive' | 'conflict'
  label: string
  x: number
  y: number
  delay: number
}

type Edge = {
  from: string
  to: string
  relation: 'supports' | 'conflicts'
  delay: number
}

const NODES: Node[] = [
  { id: 'c', kind: 'claim', label: 'Я должен уволиться', x: 50, y: 14, delay: 0 },
  { id: 'p1', kind: 'premise', label: 'Я выгораю', x: 18, y: 40, delay: 0.6 },
  { id: 'p2', kind: 'premise', label: 'Мне скучно', x: 82, y: 40, delay: 1.0 },
  { id: 'm', kind: 'motive', label: 'Страх стабильности', x: 50, y: 62, delay: 1.6 },
  { id: 'x', kind: 'conflict', label: 'Но ипотека', x: 22, y: 86, delay: 2.4 },
  { id: 'y', kind: 'conflict', label: 'Нет плана «что дальше»', x: 78, y: 86, delay: 2.9 },
]

const EDGES: Edge[] = [
  { from: 'p1', to: 'c', relation: 'supports', delay: 1.0 },
  { from: 'p2', to: 'c', relation: 'supports', delay: 1.4 },
  { from: 'm', to: 'p1', relation: 'supports', delay: 2.0 },
  { from: 'm', to: 'p2', relation: 'supports', delay: 2.2 },
  { from: 'x', to: 'c', relation: 'conflicts', delay: 3.0 },
  { from: 'y', to: 'c', relation: 'conflicts', delay: 3.4 },
  { from: 'x', to: 'm', relation: 'conflicts', delay: 3.8 },
]

const CYCLE_SEC = 5.4

function nodeFill(kind: Node['kind']): string {
  switch (kind) {
    case 'claim':
      return '#c4f542'
    case 'premise':
      return '#ffffff'
    case 'motive':
      return '#ffb23d'
    case 'conflict':
      return '#ff4d4d'
  }
}

function nodeBg(kind: Node['kind']): string {
  switch (kind) {
    case 'claim':
      return 'bg-accent text-background'
    case 'premise':
      return 'bg-elevated text-foreground border border-border-hover'
    case 'motive':
      return 'bg-[#ffb23d]/15 text-[#ffb23d] border border-[#ffb23d]/40'
    case 'conflict':
      return 'bg-[#ff4d4d]/15 text-[#ff4d4d] border border-[#ff4d4d]/40'
  }
}

function kindLabel(kind: Node['kind']): string {
  switch (kind) {
    case 'claim':
      return 'Тезис'
    case 'premise':
      return 'Посылка'
    case 'motive':
      return 'Мотив'
    case 'conflict':
      return 'Противоречие'
  }
}

const STEPS = [
  'Слушает формулировку',
  'Достаёт посылки',
  'Ищет скрытый мотив',
  'Подсвечивает противоречия',
  'Отдаёт карту — с трещинами',
]

export function ArgumentMap() {
  const [t, setT] = useState(0)
  const [cycle, setCycle] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const startedAt = performance.now()
    const tick = (now: number) => {
      const elapsed = ((now - startedAt) / 1000) % CYCLE_SEC
      setT(elapsed)
      if (elapsed < 0.05 && now - startedAt > 100) {
        setCycle((c) => c + 1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const step = Math.min(STEPS.length - 1, Math.floor((t / CYCLE_SEC) * STEPS.length))

  const visibleNodes = NODES.filter((n) => n.delay <= t)
  const visibleEdges = EDGES.filter((e) => e.delay <= t)
  const conflictCount = visibleEdges.filter((e) => e.relation === 'conflicts').length

  return (
    <section id="argument-map" className="border-border border-y py-[120px] md:py-[200px]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 md:grid-cols-12 md:gap-10 md:px-6">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-24">
            <p className="text-muted font-mono text-[13px] uppercase tracking-[0.08em]">
              Карта аргумента · live
            </p>
            <h2 className="mt-4 text-[clamp(2.1rem,4.2vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.02em]">
              Пока ты пишешь —
              <br />
              <span className="text-accent">Логика</span> рисует.
            </h2>
            <p className="text-muted mt-6 max-w-[46ch] text-[17px] leading-relaxed">
              Это не «совет психолога» и не ответ из чата. Это твоё собственное рассуждение,
              разложенное на посылки, мотивы и трещины. Ты увидишь, где держит — и где рвётся.
            </p>

            <div className="text-muted mt-10 space-y-3 font-mono text-[13px]">
              {STEPS.map((label, i) => {
                const active = i === step
                const done = i < step
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3 transition-colors duration-300"
                  >
                    <span
                      className={
                        done
                          ? 'text-accent'
                          : active
                            ? 'text-foreground'
                            : 'text-dim'
                      }
                    >
                      {done ? '✓' : active ? '›' : '·'}
                    </span>
                    <span className={active ? 'text-foreground' : done ? 'text-muted' : ''}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-10 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-[0.08em]">
              <span className="bg-accent/15 text-accent rounded-[4px] px-2 py-1">Тезис</span>
              <span className="border-border bg-card text-muted rounded-[4px] border px-2 py-1">
                Посылка
              </span>
              <span className="rounded-[4px] border border-[#ffb23d]/40 bg-[#ffb23d]/15 px-2 py-1 text-[#ffb23d]">
                Мотив
              </span>
              <span className="rounded-[4px] border border-[#ff4d4d]/40 bg-[#ff4d4d]/15 px-2 py-1 text-[#ff4d4d]">
                Противоречие
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.6, ease }}
            className="border-border bg-card relative overflow-hidden rounded-[16px] border"
          >
            <div className="border-border text-dim flex items-center justify-between border-b px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em]">
              <span>Карта аргумента — цикл #{cycle + 1}</span>
              <span>
                {visibleNodes.length} узлов · {visibleEdges.length} рёбер ·{' '}
                <span className="text-[#ff4d4d]">{conflictCount}</span> конфликтов
              </span>
            </div>

            <div className="relative aspect-[4/3] w-full">
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                aria-hidden
              >
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path
                      d="M 10 0 L 0 0 0 10"
                      fill="none"
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="0.3"
                    />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
                {EDGES.map((edge) => {
                  const from = NODES.find((n) => n.id === edge.from)!
                  const to = NODES.find((n) => n.id === edge.to)!
                  const visible = edge.delay <= t
                  const stroke = edge.relation === 'conflicts' ? '#ff4d4d' : '#c4f542'
                  return (
                    <motion.line
                      key={`${edge.from}-${edge.to}-${cycle}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={stroke}
                      strokeWidth={edge.relation === 'conflicts' ? 0.45 : 0.3}
                      strokeDasharray={edge.relation === 'conflicts' ? '1.2 0.8' : undefined}
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={visible ? { pathLength: 1, opacity: 0.8 } : { pathLength: 0, opacity: 0 }}
                      transition={{ duration: 0.7, ease }}
                    />
                  )
                })}
                {NODES.map((n) => (
                  <motion.circle
                    key={`${n.id}-dot-${cycle}`}
                    cx={n.x}
                    cy={n.y}
                    r={1.2}
                    fill={nodeFill(n.kind)}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={n.delay <= t ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.4, ease }}
                  />
                ))}
              </svg>

              {NODES.map((n) => {
                const visible = n.delay <= t
                return (
                  <motion.div
                    key={`${n.id}-label-${cycle}`}
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.45, ease, delay: 0.1 }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  >
                    <div
                      className={`${nodeBg(
                        n.kind,
                      )} rounded-[8px] px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-[0_4px_18px_rgba(0,0,0,0.45)]`}
                    >
                      <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.08em] opacity-70">
                        {kindLabel(n.kind)}
                      </span>
                      {n.label}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="border-border text-dim grid grid-cols-3 border-t font-mono text-[11px] uppercase tracking-[0.08em]">
              <div className="border-border border-r px-4 py-3">
                <div className="text-accent">{visibleNodes.length}</div>
                <div>Узлов</div>
              </div>
              <div className="border-border border-r px-4 py-3">
                <div className="text-foreground">{visibleEdges.length}</div>
                <div>Рёбер</div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[#ff4d4d]">{conflictCount}</div>
                <div>Трещин</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
