import type { Tier } from './types'

export interface TariffConfig {
  tier: Tier
  monthlyRub: number
  yearlyDiscount: number
  analysesPerMonth: number | 'unlimited'
  voiceSecondsPerMonth: number
  pdfExport: boolean
  historyDays: number | 'forever'
  priority: boolean
}

export const TARIFFS: Record<Tier, TariffConfig> = {
  FREE: {
    tier: 'FREE',
    monthlyRub: 0,
    yearlyDiscount: 0,
    analysesPerMonth: 1,
    voiceSecondsPerMonth: 0,
    pdfExport: true,
    historyDays: 0,
    priority: false,
  },
  PRO: {
    tier: 'PRO',
    monthlyRub: 790,
    yearlyDiscount: 0.3,
    analysesPerMonth: 30,
    voiceSecondsPerMonth: 0,
    pdfExport: true,
    historyDays: 30,
    priority: false,
  },
  ULTRA: {
    tier: 'ULTRA',
    monthlyRub: 1490,
    yearlyDiscount: 0.3,
    analysesPerMonth: 'unlimited',
    voiceSecondsPerMonth: 60 * 30, // 30 minutes a month
    pdfExport: true,
    historyDays: 'forever',
    priority: true,
  },
}

export const yearlyPrice = (tier: Tier) => {
  const t = TARIFFS[tier]
  return Math.round(t.monthlyRub * 12 * (1 - t.yearlyDiscount))
}

export const canUseVoice = (tier: Tier) => tier === 'ULTRA'
export const canDownloadPdf = (tier: Tier) => TARIFFS[tier].pdfExport
export const remainsAnalyses = (tier: Tier, usedThisMonth: number): number | 'unlimited' => {
  const cap = TARIFFS[tier].analysesPerMonth
  return cap === 'unlimited' ? 'unlimited' : Math.max(0, cap - usedThisMonth)
}
