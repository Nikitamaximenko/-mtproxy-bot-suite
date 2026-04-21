import { useEffect, useState } from 'react'
import type { Tier } from '../../shared/types'

const KEY = 'logika_tier'

/**
 * Tier state. For now backed by localStorage so we can ship ULTRA-gated UI
 * without waiting for the backend /v1/me to include subscription info.
 * Wire to backend later by replacing readTier/writeTier.
 */
export function readTier(): Tier {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'pro' || v === 'ultra') return v
  } catch {
    /* ignore */
  }
  return 'free'
}

export function writeTier(t: Tier): void {
  try {
    localStorage.setItem(KEY, t)
    window.dispatchEvent(new CustomEvent('logika:tier', { detail: t }))
  } catch {
    /* ignore */
  }
}

export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>(() => readTier())
  useEffect(() => {
    const onTier = (e: Event) => {
      const detail = (e as CustomEvent<Tier>).detail
      if (detail === 'free' || detail === 'pro' || detail === 'ultra') setTier(detail)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setTier(readTier())
    }
    window.addEventListener('logika:tier', onTier)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('logika:tier', onTier)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return tier
}

export function canUseVoice(tier: Tier): boolean {
  return tier === 'ultra'
}
