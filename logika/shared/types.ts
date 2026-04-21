export type Tier = 'free' | 'pro' | 'ultra'

export type LawKey = 'identity' | 'noncontradiction' | 'excluded-middle' | 'sufficient-reason'

export type LawVerdict = 'ok' | 'partial' | 'violated'

export interface LawResult {
  key: LawKey
  verdict: LawVerdict
  note: string
}

export interface Bias {
  key: string
  title: string
  note: string
}

export interface Alternative {
  title: string
  rationale: string
}

export interface ArgumentNode {
  id: string
  kind: 'claim' | 'premise' | 'motive' | 'conflict'
  text: string
}

export interface ArgumentEdge {
  from: string
  to: string
  relation: 'supports' | 'conflicts'
}

export interface ArgumentMap {
  nodes: ArgumentNode[]
  edges: ArgumentEdge[]
}

export interface DialogTurn {
  role: 'user' | 'bot'
  text: string
}

export interface AnalysisRequest {
  userId: string
  tier: Tier
  dialog: DialogTurn[]
  voice?: { seconds: number; transcript: string }
}

export interface AnalysisReport {
  id: string
  userId: string
  createdAt: string
  question: string
  summary: string
  score: number
  verdict: string
  laws: LawResult[]
  biases: Bias[]
  alternatives: Alternative[]
  quote?: { text: string; author: string }
  argument: ArgumentMap
  followup?: { message: string; daysFromNow: number }
  mirror: { userWords: string; structured: { p1: string; p2: string; conclusion: string; check: string } }
}

export interface Subscription {
  userId: string
  tier: Tier
  activeUntil: string
  provider: 'telegram-stars' | 'lava' | 'prodamus'
  recurring: boolean
}

export interface VoiceUsage {
  userId: string
  monthKey: string
  secondsUsed: number
}
