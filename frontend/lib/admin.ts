export const ADMIN_STORAGE_KEY = "frosty_admin_key"

export type RefStat = {
  source: string
  count: number
}

export type Stats = {
  total_users: number
  tg_users: number
  marketing_opt_out_users: number
  active_subscriptions: number
  expired_subscriptions: number
  pending_payments: number
  revenue_estimate: number
  trial_offers_claimed?: number
  trial_converted_to_paid?: number
  referrals: RefStat[]
  analytics_scoped?: boolean
}

export type SourceStat = {
  source: string | null
  users: number
  paid: number
}

export type FunnelStats = {
  tg_users: number
  tg_checkout: number
  tg_payment_link: number
  tg_paid: number
  active_now: number
  tg_users_7d: number
  tg_checkout_7d: number
  tg_paid_7d: number
  web_users: number
  web_paid: number
  source_stats: SourceStat[]
  nudge_1_sent: number
  nudge_2_sent: number
  nudge_3_sent: number
  nudge_converted: number
  opted_out: number
  analytics_scoped?: boolean
}

export type ProxyStatus = {
  server: string
  port: number
  online: boolean
  latency_ms: number | null
  degraded?: boolean
  handshake?: string
}

export type VpnOnline = {
  online: number
}

export type VpnClientInfo = {
  id: number
  telegram_id: number
  uuid_prefix: string
  uuid: string
  active: boolean
  user_exists: boolean
  subscription_status?: string | null
  subscription_expires_at?: string | null
  subscription_access_suspended?: boolean
  traffic_used_gb: number
  traffic_limit_gb: number
  max_devices: number
  created_at: string
  last_sync_at: string | null
}

export type VpnClientsData = {
  clients: VpnClientInfo[]
  total: number
  active_count: number
  total_traffic_gb: number
}

export type SubInfo = {
  id: number
  telegram_id: number
  username?: string | null
  payment_status: string
  expires_at: string | null
  created_at: string
  has_proxy: boolean
  access_suspended?: boolean
  access_blocked_reason?: string | null
  autopay_enabled?: boolean
  vpn_active?: boolean | null
  vpn_uuid?: string | null
}

export type RegistryUserInfo = {
  id: number
  telegram_id: number
  username: string | null
  ref_source: string | null
  created_at: string
}

export type UsersOverview = {
  new_users: RegistryUserInfo[]
  subscribers: SubInfo[]
  new_users_total: number
  subscribers_total: number
  users_table_total: number
  analytics_scoped?: boolean
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("ru-RU")

export class AdminAuthError extends Error {
  constructor(message = "Неверный ключ администратора") {
    super(message)
    this.name = "AdminAuthError"
  }
}

function parsePayload(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

function getErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (typeof record.detail === "string" && record.detail.trim()) return record.detail
    if (typeof record.error === "string" && record.error.trim()) return record.error
  }
  return `Ошибка ${status}`
}

export async function fetchAdminJson<T>(path: string, key: string): Promise<T> {
  const res = await fetch(path, {
    headers: { "x-admin-key": key },
    cache: "no-store",
  })
  const text = await res.text()
  const payload = parsePayload(text)
  if (res.status === 403) {
    throw new AdminAuthError()
  }
  if (!res.ok) {
    throw new Error(getErrorMessage(payload, res.status))
  }
  return payload as T
}

export function getStoredAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function clearStoredAdminKey() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function formatAdminDate(value: string | null): string {
  if (!value) return "—"
  return dateTimeFormatter.format(new Date(value))
}

export function formatAdminDateOnly(value: string | null): string {
  if (!value) return "—"
  return dateFormatter.format(new Date(value))
}

export function formatRubles(value: number): string {
  return rubFormatter.format(value)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatTrafficGb(value: number): string {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} ТБ`
  }
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ГБ`
}

export function isSubAccessActive(sub: Pick<SubInfo, "payment_status" | "expires_at" | "access_suspended" | "access_blocked_reason">): boolean {
  if (sub.access_suspended) return false
  if (sub.access_blocked_reason) return false
  if (sub.payment_status !== "paid" && sub.payment_status !== "trial") return false
  if (!sub.expires_at) return false
  return new Date(sub.expires_at).getTime() > Date.now()
}
