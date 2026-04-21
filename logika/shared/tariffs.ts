import type { Tier } from './types.js'

export const TARIFFS: Record<Tier, {
  name: string
  priceMonthly: number
  analysesPerMonth: number | 'unlimited'
  voice: boolean
  pdf: boolean
  history: 'none' | '30d' | 'unlimited'
}> = {
  free: {
    name: 'FREE',
    priceMonthly: 0,
    analysesPerMonth: 1,
    voice: false,
    pdf: false,
    history: 'none',
  },
  pro: {
    name: 'PRO',
    priceMonthly: 790,
    analysesPerMonth: 30,
    voice: false,
    pdf: true,
    history: '30d',
  },
  ultra: {
    name: 'ULTRA',
    priceMonthly: 1490,
    analysesPerMonth: 'unlimited',
    voice: true,
    pdf: true,
    history: 'unlimited',
  },
}

export function yearlyPrice(tier: Tier, discount = 0.3): number {
  return Math.round(TARIFFS[tier].priceMonthly * 12 * (1 - discount))
}

export function canUseVoice(tier: Tier): boolean {
  return TARIFFS[tier].voice
}

export function canDownloadPdf(tier: Tier): boolean {
  return TARIFFS[tier].pdf
}

export function remainsAnalyses(tier: Tier, used: number): number | 'unlimited' {
  const cap = TARIFFS[tier].analysesPerMonth
  if (cap === 'unlimited') return 'unlimited'
  return Math.max(0, cap - used)
}
