import type { Tier, DialogTurn } from '../../../shared/types.js'

export interface LogikaSession {
  tier: Tier
  firstQuestion?: string
  dialog: DialogTurn[]
  step: number
  lastReportId?: string
  followupRequested?: boolean
  voiceSecondsUsedThisMonth: number
}

export const defaultSession = (): LogikaSession => ({
  tier: 'FREE',
  dialog: [],
  step: 0,
  voiceSecondsUsedThisMonth: 0,
})
