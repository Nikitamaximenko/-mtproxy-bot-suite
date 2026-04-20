import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef } from 'react'

/** Абстрактная развилка: линии из точки, реакция на курсор */
export function HeroFork() {
  const ref = useRef<SVGSVGElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 120, damping: 24 })
  const sy = useSpring(my, { stiffness: 120, damping: 24 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      mx.set(((e.clientX - cx) / r.width) * 28)
      my.set(((e.clientY - cy) / r.height) * 28)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mx, my])

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

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 480 400"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
      aria-hidden
      style={{ x: sx, y: sy }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
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
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 2.4,
            delay: i * 0.06,
            ease: [0.32, 0.72, 0, 1],
          }}
        />
      ))}
      <motion.circle
        cx={240}
        cy={320}
        r={5}
        fill="#c4f542"
        filter="url(#glow)"
        animate={{ scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
  )
}
