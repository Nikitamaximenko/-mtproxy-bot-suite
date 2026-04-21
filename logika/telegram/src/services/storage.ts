import type { AnalysisReport, Subscription } from '../../../shared/types.js'

/**
 * Minimal storage interface so the bot can run against either Postgres
 * (production, via Prisma) or an in-memory Map (dev / tests).
 *
 * Recommended Prisma tables:
 *   User(id, tg_id, phone, created_at)
 *   Subscription(user_id, tier, active_until, provider, recurring)
 *   Report(id, user_id, payload_json, created_at, source)
 *   Followup(id, user_id, report_id, scheduled_at, fired_at)
 *   VoiceUsage(user_id, month_key, seconds_used)
 */
export interface Storage {
  getSubscription(userId: string): Promise<Subscription | null>
  setSubscription(sub: Subscription): Promise<void>
  saveReport(r: AnalysisReport): Promise<void>
  listReports(userId: string, limit?: number): Promise<AnalysisReport[]>
  scheduleFollowup(userId: string, reportId: string, at: Date): Promise<void>
}

export class InMemoryStorage implements Storage {
  private subs = new Map<string, Subscription>()
  private reports = new Map<string, AnalysisReport[]>()
  private followups: { userId: string; reportId: string; at: Date }[] = []

  async getSubscription(userId: string) {
    return this.subs.get(userId) ?? null
  }
  async setSubscription(sub: Subscription) {
    this.subs.set(sub.userId, sub)
  }
  async saveReport(r: AnalysisReport) {
    const arr = this.reports.get(r.userId) ?? []
    arr.unshift(r)
    this.reports.set(r.userId, arr)
  }
  async listReports(userId: string, limit = 20) {
    return (this.reports.get(userId) ?? []).slice(0, limit)
  }
  async scheduleFollowup(userId: string, reportId: string, at: Date) {
    this.followups.push({ userId, reportId, at })
  }
}

export const storage: Storage = new InMemoryStorage()
