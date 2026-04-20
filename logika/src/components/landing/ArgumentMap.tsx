import { motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type NodeKind = 'claim' | 'premise' | 'motive' | 'conflict'

type Node = {
  id: string
  x: number
  y: number
  kind: NodeKind
  label: string
  delay: number
}

type Edge = {
  from: string
  to: string
  kind: 'supports' | 'conflicts'
  delay: number
}

const nodes: Node[] = [
  { id: 'c1', x: 50, y: 12, kind: 'claim', label: 'Хочу уволиться', delay: 0.1 },
  { id: 'p1', x: 14, y: 38, kind: 'premise', label: 'Надоела рутина', delay: 0.9 },
  { id: 'p2', x: 86, y: 38, kind: 'premise', label: 'Нужна стабильность', delay: 1.4 },
  { id: 'm1', x: 30, y: 70, kind: 'motive', label: 'Страх выгорания', delay: 2.0 },
  { id: 'm2', x: 70, y: 70, kind: 'motive', label: 'Страх потери', delay: 2.5 },
  { id: 'x1', x: 50, y: 92, kind: 'conflict', label: 'Противоречие', delay: 3.2 },
]

const edges: Edge[] = [
  { from: 'c1', to: 'p1', kind: 'supports', delay: 0.5 },
  { from: 'c1', to: 'p2', kind: 'supports', delay: 1.0 },
  { from: 'p1', to: 'm1', kind: 'supports', delay: 1.6 },
  { from: 'p2', to: 'm2', kind: 'supports', delay: 2.1 },
  { from: 'm1', to: 'x1', kind: 'conflicts', delay: 2.7 },
  { from: 'm2', to: 'x1', kind: 'conflicts', delay: 2.9 },
  { from: 'p1', to: 'p2', kind: 'conflicts', delay: 3.0 },
]

const steps = [
  { at: 0, label: 'Слушаю ответ' },
  { at: 0.5, label: 'Извлекаю утверждение' },
  { at: 1.4, label: 'Нахожу скрытые премисы' },
  { at: 2.2, label: 'Вижу мотивы' },
  { at: 3.0, label: 'Обнаружено противоречие' },
]

const colorFor = (k: NodeKind) => {
  if (k === 'claim') return '#c4f542'
  if (k === 'conflict') return '#ff4d4d'
  if (k === 'motive') return '#9a9aa4'
  return '#f5f5f7'
}

export function ArgumentMap() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.45, once: false })
  const [t, setT] = useState(0)
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    if (!inView) return
    let raf = 0
    let start = performance.now()
    const total = 4.2
    const loop = (now: number) => {
      const elapsed = (now - start) / 1000
      if (elapsed >= total + 1.2) {
        start = now
        setCycle((c) => c + 1)
      }
      setT(Math.min(elapsed, total))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  const visibleNodes = nodes.filter((n) => n.delay <= t)
  const visibleEdges = edges.filter((e) => e.delay <= t)
  const currentStep = [...steps].reverse().find((s) => s.at <= t) ?? steps[0]

  return (
    <section
      ref={ref}
      className="border-border bg-background relative border-y py-[120px] md:py-[200px]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#c4f542" strokeWidth="0.08" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative mx-auto grid max-w-[1280px] gap-12 px-4 md:grid-cols-[minmax(0,360px)_1fr] md:gap-16 md:px-6">
        <div className="md:sticky md:top-28 md:self-start">
          <p className="text-accent font-mono text-[13px] uppercase tracking-[0.12em]">
            Карта аргумента
          </p>
          <h2 className="mt-5 text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.02] tracking-[-0.02em]">
            Пока ты пишешь —<br />
            Логика рисует.
          </h2>
          <p className="text-muted mt-6 text-lg leading-relaxed">
            Каждое твоё предложение распадается на <span className="text-foreground">утверждения,
            премисы и мотивы</span>. Связи рисуются в реальном времени. Противоречие —
            подсвечивается <span className="text-danger">красным</span> до того, как ты дошёл до конца.
          </p>

          <div className="border-border bg-card mt-10 rounded-[12px] border p-5">
            <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">Шаг</p>
            <p className="mt-2 font-mono text-[15px]" key={`${currentStep.label}-${cycle}`}>
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="inline-block"
              >
                <span className="text-accent">●</span>{' '}
                <span className="text-foreground">{currentStep.label}</span>
              </motion.span>
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              <div className="flex items-center gap-2">
                <span className="bg-accent inline-block h-2 w-2 rounded-full" />
                <span className="text-muted">утвержд.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-foreground inline-block h-2 w-2 rounded-full" />
                <span className="text-muted">премиса</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-danger inline-block h-2 w-2 rounded-full" />
                <span className="text-muted">конфликт</span>
              </div>
            </div>
          </div>

          <p className="text-dim mt-6 font-mono text-[11px] uppercase tracking-[0.08em]">
            Ни один чат-бот так не делает.
          </p>
        </div>

        <div
          className="border-border bg-card relative aspect-[4/3] min-h-[360px] overflow-hidden rounded-[16px] border md:aspect-[5/4]"
          aria-label="Демонстрация карты аргумента"
        >
          <div className="border-border absolute left-0 right-0 top-0 flex items-center justify-between border-b px-4 py-3">
            <span className="text-dim font-mono text-[11px] uppercase tracking-[0.08em]">
              argument-map · live
            </span>
            <span className="text-accent font-mono text-[11px] uppercase tracking-[0.08em]">
              {Math.round(Math.min((t / 4.2) * 100, 100))}%
            </span>
          </div>

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.2" />
                <feComposite in2="SourceGraphic" operator="over" />
              </filter>
              <filter id="conflict-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.4" />
              </filter>
            </defs>

            {visibleEdges.map((e) => {
              const a = nodes.find((n) => n.id === e.from)!
              const b = nodes.find((n) => n.id === e.to)!
              const stroke = e.kind === 'conflicts' ? '#ff4d4d' : '#c4f542'
              const opacity = e.kind === 'conflicts' ? 0.8 : 0.45
              return (
                <motion.line
                  key={`${e.from}-${e.to}-${cycle}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={0.35}
                  strokeDasharray={e.kind === 'conflicts' ? '1.5 1' : undefined}
                  strokeOpacity={opacity}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                />
              )
            })}
          </svg>

          {visibleNodes.map((n) => {
            const c = colorFor(n.kind)
            return (
              <motion.div
                key={`${n.id}-${cycle}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: 12,
                      height: 12,
                      background: c,
                      boxShadow: `0 0 14px ${c}66, 0 0 2px ${c}`,
                    }}
                    animate={
                      n.kind === 'conflict'
                        ? { scale: [1, 1.25, 1] }
                        : { scale: [1, 1.06, 1] }
                    }
                    transition={{
                      duration: n.kind === 'conflict' ? 1.1 : 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  <span
                    className="whitespace-nowrap rounded-[4px] px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.06em]"
                    style={{
                      background: 'rgba(10,10,11,0.85)',
                      color: n.kind === 'conflict' ? '#ff4d4d' : '#f5f5f7',
                      border: `1px solid ${n.kind === 'conflict' ? '#ff4d4d55' : '#222226'}`,
                    }}
                  >
                    {n.label}
                  </span>
                </div>
              </motion.div>
            )
          })}

          <div className="border-border bg-elevated/70 absolute bottom-0 left-0 right-0 border-t px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em]">
              <span className="text-muted">
                узлов: <span className="text-foreground">{visibleNodes.length}</span> · связей:{' '}
                <span className="text-foreground">{visibleEdges.length}</span>
              </span>
              <span className="text-danger">
                {visibleEdges.filter((e) => e.kind === 'conflicts').length > 0
                  ? `конфликтов: ${visibleEdges.filter((e) => e.kind === 'conflicts').length}`
                  : 'конфликтов: 0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
