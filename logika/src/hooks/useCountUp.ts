import { useEffect, useState } from 'react'

export function useCountUp(
  end: number,
  active: boolean,
  durationMs = 1800,
): number {
  const [v, setV] = useState(0)

  useEffect(() => {
    if (!active) {
      setV(0)
      return
    }
    let start: number | null = null
    const step = (t: number) => {
      if (start === null) start = t
      const p = Math.min((t - start) / durationMs, 1)
      const eased = 1 - (1 - p) ** 3
      setV(Math.round(end * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [active, end, durationMs])

  return v
}
