import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const lines = [
  { d: 'M 240 320 L 120 120', o: 0.9 },
  { d: 'M 240 320 L 200 80', o: 0.85 },
  { d: 'M 240 320 L 280 80', o: 0.85 },
  { d: 'M 240 320 L 360 120', o: 0.9 },
  { d: 'M 240 320 L 80 220', o: 0.7 },
  { d: 'M 240 320 L 400 220', o: 0.7 },
  { d: 'M 120 120 L 60 40', o: 0.5 },
  { d: 'M 120 120 L 100 20', o: 0.45 },
  { d: 'M 360 120 L 420 40', o: 0.5 },
  { d: 'M 360 120 L 380 20', o: 0.45 },
  { d: 'M 200 80 L 160 20', o: 0.4 },
  { d: 'M 280 80 L 320 20', o: 0.4 },
  { d: 'M 80 220 L 40 300', o: 0.45 },
  { d: 'M 400 220 L 440 300', o: 0.45 },
]

/** Абстрактная развилка: линии из точки, реакция на курсор (с throttling). */
export function HeroFork() {
  const ref = useRef<SVGSVGElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 100, damping: 28, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 100, damping: 28, mass: 0.4 })
  const raf = useRef(0)
  const pending = useRef({ x: 0, y: 0 })
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduceMotion) return

    const onMove = (e: MouseEvent) => {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      pending.current = {
        x: ((e.clientX - cx) / r.width) * 28,
        y: ((e.clientY - cy) / r.height) * 28,
      }
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        mx.set(pending.current.x)
        my.set(pending.current.y)
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [mx, my, reduceMotion])

  if (reduceMotion) {
    return (
      <svg
        viewBox="0 0 480 400"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
        aria-hidden
      >
        <defs>
          <radialGradient id="node-static" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c4f542" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c4f542" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="480" height="400" fill="url(#node-static)" opacity={0.35} />
        {lines.map((l, i) => (
          <path
            key={i}
            d={l.d}
            fill="none"
            stroke="#c4f542"
            strokeWidth={1.2}
            strokeOpacity={l.o}
          />
        ))}
        <circle cx={240} cy={320} r={5} fill="#c4f542" />
      </svg>
    )
  }

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 480 400"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
      aria-hidden
      style={{ x: sx, y: sy, willChange: 'transform' }}
    >
      <defs>
        <filter id="heroForkGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4f542" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c4f542" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="480" height="400" fill="url(#node)" opacity={0.35} />
      {lines.map((l, i) => (
        <motion.path
          key={i}
          d={l.d}
          fill="none"
          stroke="#c4f542"
          strokeWidth={1.2}
          strokeOpacity={l.o}
          filter="url(#heroForkGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 1.8,
            delay: i * 0.05,
            ease: [0.32, 0.72, 0, 1],
          }}
        />
      ))}
      <motion.circle
        cx={240}
        cy={320}
        r={5}
        fill="#c4f542"
        filter="url(#heroForkGlow)"
        animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
  )
}
