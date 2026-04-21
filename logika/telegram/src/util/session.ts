import type { Tier, DialogTurn } from '../../../shared/types.js'

export interface LogikaSession {
  tier: Tier
  dialog: DialogTurn[]
  step: number
  lastReportId?: string
  voiceSecondsUsedThisMonth: number
}

export function initialSession(): LogikaSession {
  return {
    tier: 'free',
    dialog: [],
    step: 0,
    voiceSecondsUsedThisMonth: 0,
  }
}
