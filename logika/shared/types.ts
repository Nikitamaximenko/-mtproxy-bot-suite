/**
 * Shared types between the Logika web app and the Telegram bot.
 * Keep this layer React-free and framework-agnostic.
 */

export type Tier = 'FREE' | 'PRO' | 'ULTRA'

export type LawKey = 'identity' | 'noncontradiction' | 'excludedMiddle' | 'sufficientReason'

export type LawVerdict = 'passed' | 'partial' | 'failed'

export interface LawResult {
  key: LawKey
  title: string
  formula: string
  verdict: LawVerdict
  explanation: string
}

export interface Bias {
  key: string
  name: string
  description: string
}

export interface Alternative {
  code: string
  title: string
  description: string
  riskNote?: string
}

export interface ArgumentNode {
  id: string
  kind: 'claim' | 'premise' | 'motive' | 'conflict'
  label: string
}

export interface ArgumentEdge {
  from: string
  to: string
  kind: 'supports' | 'conflicts'
}

export interface ArgumentMap {
  nodes: ArgumentNode[]
  edges: ArgumentEdge[]
}

export interface DialogTurn {
  role: 'user' | 'bot'
  text: string
  audioDurationMs?: number
  source?: 'text' | 'voice'
}

export interface AnalysisRequest {
  userId: string
  tier: Tier
  firstQuestion: string
  dialog: DialogTurn[]
  requestedAt: string
  source: 'web' | 'telegram'
}

export interface AnalysisReport {
  id: string
  userId: string
  question: string
  score: number
  verdictHeadline: string
  verdictSummary: string
  structuralSummary: string
  laws: LawResult[]
  biases: Bias[]
  alternatives: Alternative[]
  argumentMap: ArgumentMap
  createdAt: string
  source: 'web' | 'telegram'
}

export interface Subscription {
  userId: string
  tier: Tier
  activeUntil: string | null
  provider: 'lava' | 'prodamus' | 'telegram-stars' | null
  recurring: boolean
}

export interface VoiceUsage {
  userId: string
  monthKey: string
  secondsUsed: number
  monthlyLimitSec: number
}
