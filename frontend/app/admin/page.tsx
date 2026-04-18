"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

type RefStat = {
  source: string
  count: number
}

type Stats = {
  total_users: number
  tg_users: number
  marketing_opt_out_users: number
  active_subscriptions: number
  expired_subscriptions: number
  pending_payments: number
  revenue_estimate: number
  referrals: RefStat[]
  analytics_scoped?: boolean
}

type ProxyStatus = {
  server: string
  port: number
  online: boolean
  latency_ms: number | null
  degraded?: boolean
  handshake?: string
}

type VpnOnline = {
  online: number
}

type VpnClientInfo = {
  id: number
  telegram_id: number
  uuid_prefix: string
  uuid: string
  active: boolean
  traffic_used_gb: number
  traffic_limit_gb: number
  max_devices: number
  created_at: string
  last_sync_at: string | null
}

type VpnClientsData = {
  clients: VpnClientInfo[]
  total: number
  active_count: number
  total_traffic_gb: number
}

type SubInfo = {
  id: number
  telegram_id: number
  username?: string | null
  payment_status: string
  expires_at: string | null
  created_at: string
  has_proxy: boolean
  access_suspended?: boolean
  access_blocked_reason?: string | null
  // Реальное состояние VPN в 3X-UI (главный показатель доступа). null = записи
  // vpn_clients ещё нет (провижининг не сработал), true/false = клиент есть
  // и активен/деактивирован.
  vpn_active?: boolean | null
  vpn_uuid?: string | null
}

type SelfTestUserState = {
  exists: boolean
  sub_id: number | null
  payment_status: string | null
  expires_at: string | null
  access_suspended: boolean | null
  has_proxy: boolean | null
  vpn_active: boolean | null
}

type SelfTestUserResult = {
  telegram_id: number
  username: string | null
  before: SelfTestUserState
  after_deactivate: SelfTestUserState
  after_activate: SelfTestUserState
  deactivate_ok: boolean
  activate_ok: boolean
  ok: boolean
  error: string | null
}

type SelfTestResponse = {
  total: number
  passed: number
  failed: number
  mt_proxy_configured: boolean
  xray_configured: boolean
  results: SelfTestUserResult[]
}

type RegistryUser = {
  id: number
  telegram_id: number
  username: string | null
  ref_source: string | null
  created_at: string
}

type UsersOverview = {
  new_users: RegistryUser[]
  subscribers: SubInfo[]
  new_users_total: number
  subscribers_total: number
  users_table_total: number
  analytics_scoped?: boolean
}

type SourceStat = {
  source: string | null
  users: number
  paid: number
}

type SupportAiMessage = {
  id: number
  telegram_id: number
  username: string | null
  user_text: string
  assistant_text: string
  model: string | null
  duration_ms: number | null
  ok: boolean
  error: string | null
  created_at: string
}

type SupportAiMessagesData = {
  messages: SupportAiMessage[]
  total: number
}

type SupportAiDailyBucket = { day: string; count: number }
type SupportAiTopUser = {
  telegram_id: number
  username: string | null
  count: number
}

type SupportAiStats = {
  total: number
  last_24h: number
  last_7d: number
  unique_users_total: number
  unique_users_7d: number
  errors_total: number
  avg_duration_ms: number | null
  last_message_at: string | null
  daily_7d: SupportAiDailyBucket[]
  top_users_7d: SupportAiTopUser[]
}

type FunnelStats = {
  // TG funnel (unique users, tg_id > 0)
  tg_users: number
  tg_checkout: number
  tg_payment_link: number
  tg_paid: number
  active_now: number
  tg_users_7d: number
  tg_checkout_7d: number
  tg_paid_7d: number
  // Web users
  web_users: number
  web_paid: number
  // Source breakdown
  source_stats: SourceStat[]
  // Engagement
  nudge_1_sent: number
  nudge_2_sent: number
  nudge_3_sent: number
  nudge_converted: number
  opted_out: number
  analytics_scoped?: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    pending: "bg-yellow-100 text-yellow-800",
    expired: "bg-red-100 text-red-800",
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  )
}

/** Доступ как в API: paid, срок в будущем, без блокировки (suspend / причина блока). */
function isSubAccessActive(s: SubInfo): boolean {
  if (s.access_suspended) return false
  if (s.access_blocked_reason) return false
  if (s.payment_status !== "paid") return false
  if (!s.expires_at) return false
  return new Date(s.expires_at).getTime() > Date.now()
}

function AccessToggle({
  active,
  busy,
  onToggle,
}: {
  active: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Деактивировать подписку" : "Активировать подписку"}
        disabled={busy}
        onClick={onToggle}
        className={`relative h-7 w-12 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:opacity-50 ${
          active ? "bg-emerald-600" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
            active ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-xs text-gray-500 w-8 text-right">{busy ? "…" : active ? "Вкл" : "Выкл"}</span>
    </div>
  )
}

/** Во вкладке «Новые» активной подписки в данных нет — только выдача доступа. */
function GrantAccessButton({ busy, onGrant }: { busy: boolean; onGrant: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        disabled={busy}
        onClick={onGrant}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
      >
        {busy ? "…" : "Выдать доступ"}
      </button>
    </div>
  )
}

const STORAGE_KEY = "frosty_admin_key"

/** Реальные активные подписчики (prod): после purge в БД остаются только эти telegram_id. */
const PRODUCTION_TELEGRAM_IDS = [
  231115635, 1760841179, 1759725640, 195699085, 282345092, 1069768978,
] as const

/** API может отдать неполный объект — без этого рендер падает на funnel.source_stats.length */
function safeFunnel(raw: unknown): FunnelStats | null {
  if (raw == null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  const source_stats = Array.isArray(r.source_stats) ? (r.source_stats as SourceStat[]) : []
  return {
    tg_users: num(r.tg_users),
    tg_checkout: num(r.tg_checkout),
    tg_payment_link: num(r.tg_payment_link),
    tg_paid: num(r.tg_paid),
    active_now: num(r.active_now),
    tg_users_7d: num(r.tg_users_7d),
    tg_checkout_7d: num(r.tg_checkout_7d),
    tg_paid_7d: num(r.tg_paid_7d),
    web_users: num(r.web_users),
    web_paid: num(r.web_paid),
    source_stats,
    nudge_1_sent: num(r.nudge_1_sent),
    nudge_2_sent: num(r.nudge_2_sent),
    nudge_3_sent: num(r.nudge_3_sent),
    nudge_converted: num(r.nudge_converted),
    opted_out: num(r.opted_out),
    analytics_scoped: Boolean(r.analytics_scoped),
  }
}

export default function AdminPage() {
  const [key, setKey] = useState("")
  const [authed, setAuthed] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [vpnOnline, setVpnOnline] = useState<VpnOnline | null>(null)
  const [vpnClients, setVpnClients] = useState<VpnClientsData | null>(null)
  const [vpnDeactivatingId, setVpnDeactivatingId] = useState<number | null>(null)
  const [overview, setOverview] = useState<UsersOverview | null>(null)
  const [funnel, setFunnel] = useState<FunnelStats | null>(null)
  const [userTab, setUserTab] = useState<"new" | "subscribers">("new")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [remember, setRemember] = useState(true)
  const [activatingAdmin, setActivatingAdmin] = useState(false)
  const [pendingTgId, setPendingTgId] = useState<number | null>(null)
  const [broadcastText, setBroadcastText] = useState("")
  const [includeOptedOut, setIncludeOptedOut] = useState(false)
  const [broadcastBusy, setBroadcastBusy] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{
    total: number
    sent: number
    failed: number
    done: boolean
    error: string | null
  } | null>(null)
  const broadcastPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [buttonEnabled, setButtonEnabled] = useState(false)
  const [buttonText, setButtonText] = useState("")
  const [buttonUrl, setButtonUrl] = useState("")
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted_users: number; deleted_pending_subscriptions: number; kept_paid_subscriptions: number } | null>(null)
  const [purgeBusy, setPurgeBusy] = useState(false)
  const [selfTestBusy, setSelfTestBusy] = useState(false)
  const [selfTestResult, setSelfTestResult] = useState<SelfTestResponse | null>(null)
  const [supportStats, setSupportStats] = useState<SupportAiStats | null>(null)
  const [supportMessages, setSupportMessages] = useState<SupportAiMessagesData | null>(null)
  const [supportOnlyErrors, setSupportOnlyErrors] = useState(false)
  const [supportTgFilter, setSupportTgFilter] = useState("")
  const [supportExpandedId, setSupportExpandedId] = useState<number | null>(null)
  const [purgeResult, setPurgeResult] = useState<{
    deleted_users: number
    deleted_subscriptions: number
    deleted_vpn_peers: number
    deleted_vpn_clients: number
  } | null>(null)
  const ADMIN_TG_ID = 231115635

  const broadcastRecipientEstimate =
    stats == null
      ? null
      : includeOptedOut
        ? stats.tg_users
        : Math.max(0, stats.tg_users - stats.marketing_opt_out_users)

  const headers = useCallback(
    (overrideKey?: string) => ({ "x-admin-key": overrideKey ?? key }),
    [key],
  )

  const persistKey = useCallback(
    (activeKey: string) => {
      if (remember && activeKey) {
        try {
          localStorage.setItem(STORAGE_KEY, activeKey)
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
      }
    },
    [remember],
  )

  const fetchAll = useCallback(
    async (overrideKey?: string) => {
      const activeKey = overrideKey ?? key
      setLoading(true)
      setError("")
      try {
        const [sRes, pRes, ovRes, fRes, vRes, vcRes, ssRes, smRes] = await Promise.all([
          fetch("/api/admin/stats", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/proxy-status", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/users-overview", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/funnel", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/vpn-online", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/vpn-clients", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/support/stats", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/support/messages?limit=100", { headers: headers(activeKey), cache: "no-store" }),
        ])

        if (sRes.status === 403 || ovRes.status === 403) {
          setAuthed(false)
          setOverview(null)
          setFunnel(null)
          setError("Неверный ключ")
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {
            /* ignore */
          }
          return
        }

        const [sData, pData, ovData, fData, vData, vcData, ssData, smData] = await Promise.all([
          sRes.json(),
          pRes.json(),
          ovRes.json(),
          fRes.ok ? fRes.json() : Promise.resolve(null),
          vRes.ok ? vRes.json() : Promise.resolve(null),
          vcRes.ok ? vcRes.json() : Promise.resolve(null),
          ssRes.ok ? ssRes.json() : Promise.resolve(null),
          smRes.ok ? smRes.json() : Promise.resolve(null),
        ])
        const rawStats = sData as Stats & { marketing_opt_out_users?: number }
        setStats({
          ...rawStats,
          marketing_opt_out_users: rawStats.marketing_opt_out_users ?? 0,
        })
        setProxy(pData)
        setVpnOnline(vData as VpnOnline | null)
        setVpnClients(vcData as VpnClientsData | null)
        setOverview(ovData as UsersOverview)
        const funnelNorm = safeFunnel(fData)
        setFunnel(funnelNorm)
        setSupportStats(ssData as SupportAiStats | null)
        setSupportMessages(smData as SupportAiMessagesData | null)
        setAuthed(true)
        persistKey(activeKey)
      } catch (e) {
        setError("Не удалось загрузить данные")
      } finally {
        setLoading(false)
      }
    },
    [headers, key, persistKey],
  )

  const setUserSubscription = useCallback(
    async (telegramId: number, makeActive: boolean) => {
      setPendingTgId(telegramId)
      setError("")
      try {
        const segment = makeActive ? "activate" : "deactivate"
        const res = await fetch(`/api/admin/${segment}/${telegramId}`, {
          method: "POST",
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
          body: "{}",
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string | { msg?: string }[]
          error?: string
        }
        if (!res.ok) {
          let msg = `Ошибка ${res.status}`
          if (typeof data.detail === "string") msg = data.detail
          else if (Array.isArray(data.detail) && data.detail[0] && typeof data.detail[0] === "object") {
            const d = data.detail[0] as { msg?: string }
            if (d.msg) msg = d.msg
          } else if (typeof data.error === "string") msg = data.error
          if (res.status === 503) {
            msg = `${msg} · Проверь переменные MT_PROXY_SERVER / MT_PROXY_PORT / MT_PROXY_SECRET на бекенде (Railway).`
          } else if (res.status === 403) {
            msg = `${msg} · Неверный админ-ключ или бекенд не знает ADMIN_API_KEY.`
          }
          throw new Error(msg)
        }
        await fetchAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось изменить подписку")
      } finally {
        setPendingTgId(null)
      }
    },
    [fetchAll, headers],
  )

  const stopBroadcastPolling = useCallback(() => {
    if (broadcastPollRef.current) {
      clearInterval(broadcastPollRef.current)
      broadcastPollRef.current = null
    }
  }, [])

  const pollBroadcastStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/broadcast-status", {
        headers: headers(),
        cache: "no-store",
      })
      if (!res.ok) return
      const s = (await res.json()) as {
        running: boolean; done: boolean; total: number
        sent: number; failed: number; error: string | null
      }
      setBroadcastResult({ total: s.total, sent: s.sent, failed: s.failed, done: s.done, error: s.error })
      if (s.done || !s.running) {
        stopBroadcastPolling()
        setBroadcastBusy(false)
      }
    } catch { /* ignore poll errors */ }
  }, [headers, stopBroadcastPolling])

  const sendBroadcast = useCallback(async () => {
    const text = broadcastText.trim()
    if (!text || broadcastRecipientEstimate === null || broadcastRecipientEstimate === 0) return

    const ok = window.confirm(
      `Отправить сообщение ${broadcastRecipientEstimate} получателям в Telegram?\n\n` +
        (includeOptedOut
          ? "Включая отписавшихся от маркетинга."
          : "Без пользователей, отписавшихся от маркетинга (/stop)."),
    )
    if (!ok) return

    stopBroadcastPolling()
    setBroadcastBusy(true)
    setBroadcastResult(null)
    setError("")
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          include_opted_out: includeOptedOut,
          ...(buttonEnabled && buttonText.trim() && buttonUrl.trim()
            ? { button_text: buttonText.trim(), button_url: buttonUrl.trim() }
            : {}),
        }),
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string; ok?: boolean; queued?: boolean; total?: number
      }
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`)
      }
      // Рассылка поставлена в очередь — поллинг статуса каждые 2 сек
      setBroadcastResult({ total: data.total ?? 0, sent: 0, failed: 0, done: false, error: null })
      setBroadcastText("")
      broadcastPollRef.current = setInterval(() => void pollBroadcastStatus(), 2000)
      void pollBroadcastStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить рассылку")
      setBroadcastBusy(false)
    }
  }, [
    broadcastRecipientEstimate, broadcastText, buttonEnabled, buttonText, buttonUrl,
    headers, includeOptedOut, pollBroadcastStatus, stopBroadcastPolling,
  ])

  const cleanupWebUsers = useCallback(async () => {
    const ok = window.confirm(
      "Удалить всех веб-пользователей (telegram_id < 0) и их pending-подписки?\n" +
        "Paid/expired подписки сохранятся. Это необратимо."
    )
    if (!ok) return
    setCleanupBusy(true)
    setCleanupResult(null)
    setError("")
    try {
      const res = await fetch("/api/admin/cleanup-web-users", {
        method: "DELETE",
        headers: headers(),
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string
        deleted_users?: number
        deleted_pending_subscriptions?: number
        kept_paid_subscriptions?: number
      }
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`)
      }
      setCleanupResult({
        deleted_users: data.deleted_users ?? 0,
        deleted_pending_subscriptions: data.deleted_pending_subscriptions ?? 0,
        kept_paid_subscriptions: data.kept_paid_subscriptions ?? 0,
      })
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить очистку")
    } finally {
      setCleanupBusy(false)
    }
  }, [fetchAll, headers])

  const purgeExceptProduction = useCallback(async () => {
    const idsStr = PRODUCTION_TELEGRAM_IDS.join(", ")
    const ok = window.confirm(
      "УДАЛИТЬ из базы всех пользователей и подписки, КРОМЕ следующих telegram_id?\n\n" +
        idsStr +
        "\n\nБудут удалены строки в users, subscriptions, vpn_peers, vpn_clients. " +
        "Операция необратима. Продолжить?"
    )
    if (!ok) return
    const typed = window.prompt('Для подтверждения введите слово PURGE (заглавными):')
    if (typed !== "PURGE") {
      setError(typed === null ? "" : "Нужно ввести PURGE")
      return
    }
    setPurgeBusy(true)
    setPurgeResult(null)
    setError("")
    try {
      const res = await fetch("/api/admin/purge-except", {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ telegram_ids: [...PRODUCTION_TELEGRAM_IDS], confirm: "PURGE" }),
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string
        deleted_users?: number
        deleted_subscriptions?: number
        deleted_vpn_peers?: number
        deleted_vpn_clients?: number
      }
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`)
      }
      setPurgeResult({
        deleted_users: data.deleted_users ?? 0,
        deleted_subscriptions: data.deleted_subscriptions ?? 0,
        deleted_vpn_peers: data.deleted_vpn_peers ?? 0,
        deleted_vpn_clients: data.deleted_vpn_clients ?? 0,
      })
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить очистку")
    } finally {
      setPurgeBusy(false)
    }
  }, [fetchAll, headers])

  const fetchSupportMessages = useCallback(
    async (opts?: { tgId?: string; onlyErrors?: boolean }) => {
      const q = new URLSearchParams({ limit: "100" })
      const tgRaw = (opts?.tgId ?? supportTgFilter).trim()
      if (tgRaw) {
        const asNum = Number(tgRaw)
        if (Number.isFinite(asNum) && asNum > 0) q.set("tg_id", String(asNum))
      }
      if (opts?.onlyErrors ?? supportOnlyErrors) q.set("only_errors", "true")
      try {
        const res = await fetch(`/api/admin/support/messages?${q.toString()}`, {
          headers: headers(),
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as SupportAiMessagesData
        setSupportMessages(data)
      } catch {
        /* ignore */
      }
    },
    [headers, supportOnlyErrors, supportTgFilter],
  )

  const runSelfTest = useCallback(async () => {
    setSelfTestBusy(true)
    setSelfTestResult(null)
    setError("")
    try {
      const res = await fetch("/api/admin/self-test-toggle", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_ids: [...PRODUCTION_TELEGRAM_IDS] }),
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as Partial<SelfTestResponse> & {
        detail?: string
      }
      if (!res.ok) {
        let msg = typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`
        if (res.status === 503) {
          msg = `${msg} · Проверь MT_PROXY_SERVER/PORT/SECRET на бекенде.`
        } else if (res.status === 403) {
          msg = `${msg} · Неверный админ-ключ.`
        }
        throw new Error(msg)
      }
      setSelfTestResult(data as SelfTestResponse)
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить самотест")
    } finally {
      setSelfTestBusy(false)
    }
  }, [fetchAll, headers])

  /** Один раз при монтировании: пробуем ключ из localStorage и не показываем форму входа до проверки */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let saved = ""
      try {
        saved = localStorage.getItem(STORAGE_KEY) ?? ""
      } catch {
        /* ignore */
      }
      if (saved) {
        setKey(saved)
        await fetchAll(saved)
      }
      if (!cancelled) setBootstrapped(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!authed) return
    const interval = setInterval(() => {
      void fetchAll()
    }, 30000)
    return () => clearInterval(interval)
  }, [authed, fetchAll])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    void fetchAll()
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setAuthed(false)
    setOverview(null)
    setFunnel(null)
    setStats(null)
    setProxy(null)
    setVpnOnline(null)
    setVpnClients(null)
    setSupportStats(null)
    setSupportMessages(null)
    setKey("")
    setError("")
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center text-gray-400">
          <p className="text-lg">Загрузка…</p>
          <p className="text-sm mt-2">Проверяем сохранённый вход</p>
        </div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Frosty Admin</h1>
            <p className="text-sm text-gray-400 mt-1">Введите ключ администратора</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ADMIN_API_KEY"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-300 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4"
            />
            Запомнить на этом компьютере (localStorage)
          </label>
          <button
            type="submit"
            disabled={!key || loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Загрузка…" : "Войти"}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </form>
      </div>
    )
  }

  const newUsers = overview?.new_users ?? []
  const subscribers = overview?.subscribers ?? []
  const analyticsScoped =
    Boolean(stats?.analytics_scoped) ||
    Boolean(funnel?.analytics_scoped) ||
    Boolean(overview?.analytics_scoped)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-xl font-bold">Frosty Admin</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void fetchAll()}
                disabled={loading || activatingAdmin || pendingTgId !== null || broadcastBusy}
                className="px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading ? "⟳" : "Обновить"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActivatingAdmin(true)
                  try {
                    await setUserSubscription(ADMIN_TG_ID, true)
                  } finally {
                    setActivatingAdmin(false)
                  }
                }}
                disabled={loading || activatingAdmin || pendingTgId !== null || broadcastBusy}
                className="px-4 py-2 text-sm bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {activatingAdmin ? "Активация…" : "Вернуть подписку админа"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-900/60 border border-red-800 rounded-lg hover:bg-red-900 transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-800 pt-3 text-sm"
            aria-label="Дополнительные экраны админки"
          >
            <span className="text-gray-500">
              Экраны из merge (витрина UI, отдельно от данных ниже):
            </span>
            <Link
              href="/admin/analytics"
              className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
            >
              Аналитика
            </Link>
            <span className="text-gray-600">·</span>
            <Link
              href="/admin/servers"
              className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
            >
              Серверы
            </Link>
            <span className="text-gray-600">·</span>
            <Link
              href="/admin/users"
              className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
            >
              Пользователи
            </Link>
            <span className="text-gray-600">·</span>
            <Link href="/admin" className="text-gray-400 hover:text-gray-300">
              Этот дашборд (данные API)
            </Link>
          </nav>
        </div>
      </header>

      {analyticsScoped ? (
        <div className="border-b border-amber-800/60 bg-amber-950/40 px-6 py-2 text-center text-sm text-amber-100/95">
          Метрики (статы, воронка, обзор) считаются только по{" "}
          <code className="font-mono text-amber-50">ANALYTICS_PRODUCTION_TG_IDS</code> на сервере — не по всей базе.
        </div>
      ) : null}

      {error ? <p className="text-center text-red-400 text-sm py-2">{error}</p> : null}

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Инфраструктура</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="text-xs text-gray-400 mb-3 font-medium">📡 MTProxy</div>
              {proxy ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          !proxy.online
                            ? "bg-red-500"
                            : proxy.degraded
                              ? "bg-amber-400 animate-pulse"
                              : "bg-emerald-400 animate-pulse"
                        }`}
                      />
                      <span className="text-base font-medium">
                        {proxy.server}:{proxy.port}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          !proxy.online
                            ? "text-red-400"
                            : proxy.degraded
                              ? "text-amber-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {!proxy.online ? "Offline" : proxy.degraded ? "Degraded" : "Online"}
                      </span>
                    </div>
                    {proxy.latency_ms !== null && (
                      <span className="text-sm text-gray-400">
                        <span className="text-white font-mono">{proxy.latency_ms}ms</span>
                      </span>
                    )}
                  </div>
                  {!proxy.online && (
                    <div className="text-xs bg-red-950/50 border border-red-900 rounded-lg px-3 py-2 text-red-200">
                      TCP к <code className="font-mono">{proxy.server}:{proxy.port}</code> не открывается.
                      MTProxy-процесс не запущен или хост недоступен — проверь Railway/VPS, статус сервиса и
                      firewall. До исправления ни один пользователь не сможет подключиться, даже с тумблером «Вкл».
                    </div>
                  )}
                  {proxy.online && proxy.degraded && (
                    <div className="text-xs bg-amber-950/50 border border-amber-900 rounded-lg px-3 py-2 text-amber-200 space-y-1">
                      <div>
                        <strong>Порт открыт, но отвечает не MTProxy</strong>
                        {proxy.handshake ? (
                          <span className="text-amber-300/80"> ({proxy.handshake})</span>
                        ) : null}
                        .
                      </div>
                      <div>
                        Скорее всего: демон MTProxy не запущен и на порту стоит другой сервис, либо секрет
                        (<code className="font-mono">MT_PROXY_SECRET</code>) не совпадает с тем, что сконфигурирован
                        на сервере. Telegram-клиенты получают «Не удалось подключиться к прокси». Сначала чини
                        сервер, потом включай пользователей — иначе тумблер «Вкл» косметический.
                      </div>
                    </div>
                  )}
                  {proxy.online && !proxy.degraded && (
                    <div className="text-xs text-gray-500">
                      Сервер открыл порт и ведёт себя как MTProxy (молчит в ожидании клиентского хендшейка).
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">Загрузка…</div>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="text-xs text-gray-400 mb-3 font-medium">🛡 VLESS Reality VPN</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${vpnOnline !== null ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                  <span className="text-base font-medium">Finland · 138.124.80.97</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">{vpnOnline?.online ?? "—"}</div>
                  <div className="text-xs text-gray-500">онлайн сейчас</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1 text-gray-300">Сводка</h2>
          <p className="text-xs text-gray-500 mb-4">
            Подписки — уникальные пользователи Telegram (tg_id &gt; 0); веб-оформления не входят в эти числа. «Истекших» — без текущего доступа.
            Выручка ≈ число завершённых оплат в БД × цена (продления — отдельные строки).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                label: "Пользователей бота",
                value: stats?.tg_users ?? "—",
                sub: stats ? `+ ${stats.total_users - stats.tg_users} веб` : undefined,
                color: "text-blue-400",
              },
              {
                label: "Активных подписок",
                value: stats?.active_subscriptions ?? "—",
                sub: "уник. с доступом",
                color: "text-emerald-400",
              },
              {
                label: "Истекших",
                value: stats?.expired_subscriptions ?? "—",
                sub: "уник., без активного периода",
                color: "text-orange-400",
              },
              {
                label: "Ожидают оплату",
                value: stats?.pending_payments ?? "—",
                sub: "уник., нет активной подписки",
                color: "text-yellow-400",
              },
              {
                label: "Выручка (≈)",
                value: stats ? `${stats.revenue_estimate.toLocaleString("ru-RU")} ₽` : "—",
                sub: "по строкам оплат",
                color: "text-green-400",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
              </div>
            ))}
          </div>
        </section>

        {funnel && (
          <section>
            <h2 className="text-lg font-semibold mb-1 text-gray-300">Воронка (уникальные пользователи)</h2>
            <p className="text-xs text-gray-500 mb-4">
              Только реальные Telegram-пользователи (tg_id &gt; 0), дедуплицированы по telegram_id. % — конверсия к предыдущему шагу.
            </p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
              {(() => {
                type Step = { label: string; hint: string; total: number; week: number | null }
                const steps: Step[] = [
                  { label: "Запустили бота", hint: "уникальных /start", total: funnel.tg_users, week: funnel.tg_users_7d },
                  { label: "Открыли оформление", hint: "дошли до checkout", total: funnel.tg_checkout, week: funnel.tg_checkout_7d },
                  { label: "Получили ссылку оплаты", hint: "перешли к Lava", total: funnel.tg_payment_link, week: null },
                  { label: "Оплатили", hint: "подтверждённых платежей", total: funnel.tg_paid, week: funnel.tg_paid_7d },
                  { label: "Активны сейчас", hint: "paid + срок не истёк", total: funnel.active_now, week: null },
                ]
                // Find the step with the biggest absolute drop (worst conversion)
                let worstDropIdx = -1
                let worstDrop = 0
                for (let i = 1; i < steps.length; i++) {
                  const drop = steps[i - 1].total - steps[i].total
                  if (drop > worstDrop) { worstDrop = drop; worstDropIdx = i }
                }
                return steps.map((step, i) => {
                  const prev = i > 0 ? steps[i - 1].total : null
                  const pct = prev && prev > 0 ? Math.round((step.total / prev) * 100) : null
                  const barWidth = steps[0].total > 0 ? Math.round((step.total / steps[0].total) * 100) : 0
                  const isWorstDrop = i === worstDropIdx && worstDrop > 0
                  const pctColor =
                    pct === null ? "" : pct >= 60 ? "text-emerald-400" : pct >= 30 ? "text-yellow-400" : "text-red-400"
                  return (
                    <div key={step.label}>
                      <div className={`flex items-center justify-between text-sm mb-1 ${isWorstDrop ? "relative" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 font-medium">{step.label}</span>
                          <span className="text-gray-600 text-xs hidden sm:inline">({step.hint})</span>
                          {isWorstDrop && (
                            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full font-medium">
                              ⚠ узкое место
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {step.week !== null && (
                            <span className="text-gray-500 text-xs">7д: {step.week}</span>
                          )}
                          <span className="text-white font-bold font-mono w-12 text-right">{step.total}</span>
                          {pct !== null && (
                            <span className={`text-xs font-semibold w-12 text-right ${pctColor}`}>{pct}%</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isWorstDrop ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      {i < steps.length - 1 && (
                        <div className="text-gray-700 text-xs text-center mt-1 mb-1 select-none">↓</div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>

            {/* Web users + nudge stats */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Веб-пользователи</div>
                <div className="text-xl font-bold font-mono text-blue-400">{funnel.web_users}</div>
                <div className="text-xs text-gray-600 mt-1">из них оплатили: {funnel.web_paid}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Нуджи отправлены</div>
                <div className="text-xl font-bold font-mono text-cyan-400">{funnel.nudge_1_sent}</div>
                <div className="text-xs text-gray-600 mt-1">
                  после — купили: <span className={funnel.nudge_converted > 0 ? "text-emerald-400" : "text-gray-500"}>
                    {funnel.nudge_converted}
                  </span>
                  {funnel.nudge_1_sent > 0 && (
                    <span className="ml-1">({Math.round(funnel.nudge_converted / funnel.nudge_1_sent * 100)}%)</span>
                  )}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">2-й и 3-й нудж</div>
                <div className="text-xl font-bold font-mono text-cyan-400">{funnel.nudge_2_sent} / {funnel.nudge_3_sent}</div>
                <div className="text-xs text-gray-600 mt-1">через 24ч / 72ч</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Отписались от рассылки</div>
                <div className="text-xl font-bold font-mono text-red-400">{funnel.opted_out}</div>
                <div className="text-xs text-gray-600 mt-1">команда /stop</div>
              </div>
            </div>

            {/* Source conversion table */}
            {funnel.source_stats.length > 0 && (
              <div className="mt-3 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-300">Конверсия по источникам</span>
                  <span className="text-xs text-gray-500">пользователей → оплатили → %</span>
                </div>
                <div className="divide-y divide-gray-800">
                  {funnel.source_stats.map((s) => {
                    const conv = s.users > 0 ? Math.round(s.paid / s.users * 100) : 0
                    const convColor = conv >= 10 ? "text-emerald-400" : conv >= 3 ? "text-yellow-400" : "text-red-400"
                    return (
                      <div key={s.source ?? "__organic__"} className="flex items-center px-5 py-3 gap-4 text-sm">
                        <span className="text-gray-300 font-medium w-36 truncate">
                          {s.source ?? "органик (прямой)"}
                        </span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: s.users > 0 ? `${Math.min(100, Math.round(s.users / funnel.source_stats[0].users * 100))}%` : "0%" }}
                          />
                        </div>
                        <span className="text-gray-400 font-mono w-10 text-right">{s.users}</span>
                        <span className="text-emerald-400 font-mono w-8 text-right">{s.paid}</span>
                        <span className={`font-mono font-semibold w-10 text-right ${convColor}`}>{conv}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Cleanup test users */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {funnel.web_users > 0 && (
                <button
                  type="button"
                  onClick={() => void cleanupWebUsers()}
                  disabled={cleanupBusy}
                  className="px-4 py-2 text-sm rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {cleanupBusy ? "Удаление…" : `Очистить ${funnel.web_users} веб-пользователей`}
                </button>
              )}
              <button
                type="button"
                onClick={() => void purgeExceptProduction()}
                disabled={purgeBusy || cleanupBusy}
                className="px-4 py-2 text-sm rounded-xl bg-red-950/80 border border-red-800 text-red-200 hover:bg-red-900/80 disabled:opacity-50 transition-colors"
              >
                {purgeBusy ? "Очистка БД…" : "Удалить всех, кроме 5 prod (users + подписки + VPN)"}
              </button>
              {cleanupResult && (
                <span className="text-xs text-gray-500">
                  Удалено: {cleanupResult.deleted_users} пользователей, {cleanupResult.deleted_pending_subscriptions} pending-подписок
                  {cleanupResult.kept_paid_subscriptions > 0 && ` · сохранено paid: ${cleanupResult.kept_paid_subscriptions}`}
                </span>
              )}
              {purgeResult && (
                <span className="text-xs text-gray-500">
                  Purge: users {purgeResult.deleted_users}, подписок {purgeResult.deleted_subscriptions}, WG{" "}
                  {purgeResult.deleted_vpn_peers}, VLESS {purgeResult.deleted_vpn_clients}
                </span>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-2 text-gray-300">Рассылка в боте</h2>
          <p className="text-xs text-gray-500 mb-4">
            Одно сообщение всем пользователям из таблицы <code className="text-gray-400">users</code> через
            Telegram Bot API (<strong>HTML</strong>: <code className="text-gray-400">&lt;b&gt;</code>,{" "}
            <code className="text-gray-400">&lt;i&gt;</code>, <code className="text-gray-400">&lt;a href&gt;</code>
            , <code className="text-gray-400">&lt;code&gt;</code>). Макс. 4096 символов. Отправка с небольшой
            задержкой между чатами (~20/сек), при большой базе займёт время.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-400">
                Получателей (оценка):{" "}
                <strong className="text-white font-mono">
                  {broadcastRecipientEstimate === null ? "—" : broadcastRecipientEstimate}
                </strong>
              </span>
              {stats != null && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500">
                    всего в БД: {stats.total_users}, отписались от рассылок:{" "}
                    {stats.marketing_opt_out_users}
                  </span>
                </>
              )}
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none text-sm text-gray-300 max-w-xl">
              <input
                type="checkbox"
                checked={includeOptedOut}
                onChange={(e) => setIncludeOptedOut(e.target.checked)}
                disabled={broadcastBusy}
                className="mt-1 w-4 h-4 shrink-0"
              />
              <span>
                Включить пользователей, отписавшихся от маркетинга (<code className="text-gray-500">/stop</code>
                ). По умолчанию они <strong className="text-amber-400/90">не</strong> получают рассылку.
              </span>
            </label>
            <div>
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value.slice(0, 4096))}
                disabled={broadcastBusy}
                rows={6}
                placeholder="Текст для всех получателей…"
                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm resize-y min-h-[120px] disabled:opacity-60"
              />
              <div className="flex justify-end mt-1 text-xs text-gray-500">
                {broadcastText.length} / 4096
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={buttonEnabled}
                onChange={(e) => setButtonEnabled(e.target.checked)}
                disabled={broadcastBusy}
                className="w-4 h-4 shrink-0"
              />
              <span className="text-sm text-gray-300">Добавить кнопку</span>
            </label>
            {buttonEnabled && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value.slice(0, 64))}
                  disabled={broadcastBusy}
                  placeholder='Текст кнопки, напр. "Подключить →"'
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm disabled:opacity-60"
                />
                <input
                  type="url"
                  value={buttonUrl}
                  onChange={(e) => setButtonUrl(e.target.value.slice(0, 2048))}
                  disabled={broadcastBusy}
                  placeholder="URL кнопки, напр. https://t.me/frostytg_bot"
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm disabled:opacity-60"
                />
              </div>
            )}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void sendBroadcast()}
                disabled={
                  broadcastBusy ||
                  !broadcastText.trim() ||
                  broadcastRecipientEstimate === null ||
                  broadcastRecipientEstimate === 0
                }
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {broadcastBusy ? "Отправляем…" : "Отправить рассылку"}
              </button>

              {broadcastResult && (
                <div className="space-y-2">
                  {/* Progress bar */}
                  {broadcastResult.total > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>
                          {broadcastResult.done ? "Готово" : "Отправляем…"}{" "}
                          <span className="text-emerald-400 font-mono">{broadcastResult.sent}</span>
                          {" / "}
                          <span className="font-mono">{broadcastResult.total}</span>
                        </span>
                        {broadcastResult.failed > 0 && (
                          <span className="text-red-400">ошибок: {broadcastResult.failed}</span>
                        )}
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${broadcastResult.done ? "bg-emerald-500" : "bg-violet-500"}`}
                          style={{ width: `${Math.round(((broadcastResult.sent + broadcastResult.failed) / broadcastResult.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {broadcastResult.error && (
                    <p className="text-xs text-red-400">Ошибка: {broadcastResult.error}</p>
                  )}
                  {broadcastResult.done && !broadcastResult.error && (
                    <p className="text-xs text-emerald-400">
                      Рассылка завершена: {broadcastResult.sent} доставлено
                      {broadcastResult.failed > 0 ? `, ${broadcastResult.failed} не доставлено (бот заблокирован)` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1 text-gray-300">Самотест тумблера доступа</h2>
          <p className="text-xs text-gray-500 mb-4">
            Для каждого из {PRODUCTION_TELEGRAM_IDS.length} prod-юзеров прогоняется:{" "}
            <strong>снимок → выкл → снимок → вкл → снимок</strong>. В конце все они гарантированно в состоянии{" "}
            <strong>paid + доступ вкл + прокси выдан</strong> (если MT_PROXY_* настроены). Пользователи, которых
            ещё нет в БД, будут созданы и активированы на 30 дней.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => void runSelfTest()}
                disabled={selfTestBusy}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {selfTestBusy
                  ? "Выполняется…"
                  : `Запустить самотест (${PRODUCTION_TELEGRAM_IDS.length} prod)`}
              </button>
              {selfTestResult && (
                <span className="text-sm text-gray-400">
                  Результат:{" "}
                  <span className="text-emerald-400 font-semibold">{selfTestResult.passed} ok</span>
                  {selfTestResult.failed > 0 && (
                    <>
                      {" · "}
                      <span className="text-red-400 font-semibold">{selfTestResult.failed} fail</span>
                    </>
                  )}
                  {" · "}
                  MT_PROXY env:{" "}
                  <span
                    className={selfTestResult.mt_proxy_configured ? "text-emerald-400" : "text-red-400"}
                  >
                    {selfTestResult.mt_proxy_configured ? "ok" : "не настроен"}
                  </span>
                  {" · "}
                  3X-UI:{" "}
                  <span
                    className={selfTestResult.xray_configured ? "text-emerald-400" : "text-red-400"}
                  >
                    {selfTestResult.xray_configured ? "ok" : "не настроен"}
                  </span>
                </span>
              )}
            </div>

            {selfTestResult && selfTestResult.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-2 py-2 font-medium">Юзер</th>
                      <th className="px-2 py-2 font-medium">Было</th>
                      <th className="px-2 py-2 font-medium">После «выкл»</th>
                      <th className="px-2 py-2 font-medium">После «вкл»</th>
                      <th className="px-2 py-2 font-medium text-right">Итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selfTestResult.results.map((r) => {
                      const fmt = (s: SelfTestUserState): string => {
                        if (!s.exists && s.vpn_active === null) return "—"
                        const bits: string[] = []
                        if (s.exists) {
                          bits.push(s.payment_status ?? "?")
                          bits.push(s.access_suspended ? "suspended" : "active")
                          bits.push(s.has_proxy ? "+proxy" : "-proxy")
                        } else {
                          bits.push("no-sub")
                        }
                        if (s.vpn_active === true) bits.push("+vpn")
                        else if (s.vpn_active === false) bits.push("vpn:off")
                        else bits.push("no-vpn")
                        return bits.join(" · ")
                      }
                      return (
                        <tr
                          key={r.telegram_id}
                          className="border-b border-gray-800/50 align-top"
                        >
                          <td className="px-2 py-2">
                            <div className="font-mono text-gray-300">{r.telegram_id}</div>
                            <div className="text-gray-500">
                              {r.username ? `@${r.username}` : "—"}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-400">{fmt(r.before)}</td>
                          <td className="px-2 py-2 font-mono">
                            <span className={r.deactivate_ok ? "text-gray-300" : "text-red-400"}>
                              {fmt(r.after_deactivate)}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-mono">
                            <span className={r.activate_ok ? "text-emerald-300" : "text-red-400"}>
                              {fmt(r.after_activate)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            {r.ok ? (
                              <span className="text-emerald-400 font-semibold">OK</span>
                            ) : (
                              <span className="text-red-400 font-semibold" title={r.error ?? ""}>
                                FAIL
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {selfTestResult.results.some((r) => !r.ok) && (
                  <div className="mt-3 space-y-1">
                    {selfTestResult.results
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <div key={r.telegram_id} className="text-xs text-red-300">
                          <span className="font-mono">{r.telegram_id}</span>{" "}
                          {r.username ? `(@${r.username})` : ""}: {r.error ?? "unknown error"}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-300">Пользователи из БД</h2>
            <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1 w-fit">
              <button
                type="button"
                onClick={() => setUserTab("new")}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  userTab === "new" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Новые ({overview?.new_users_total ?? newUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUserTab("subscribers")}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  userTab === "subscribers"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Платные подписчики ({overview?.subscribers_total ?? subscribers.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            <strong>Новые</strong> — записи в <code className="text-gray-400">users</code> без оплаченной или
            истёкшей подписки (только pending или без подписок). <strong>Платные</strong> — когда-либо оплатили
            (paid/expired); показана последняя запись подписки.
            <span className="block mt-1">
              Тумблер <strong>Доступ</strong>: выкл — только снять прокси (оплаченные даты не меняются); вкл — вернуть
              доступ по текущему сроку или +30 дней, если период уже истёк.
            </span>
          </p>

          {userTab === "new" ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Telegram ID</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Ref</th>
                      <th className="px-4 py-3 font-medium">Регистрация</th>
                      <th className="px-4 py-3 font-medium text-right">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-gray-400">{u.id}</td>
                        <td className="px-4 py-3 font-mono">{u.telegram_id}</td>
                        <td className="px-4 py-3 text-gray-300">{u.username ? `@${u.username}` : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.ref_source ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <GrantAccessButton
                            busy={pendingTgId === u.telegram_id}
                            onGrant={() => void setUserSubscription(u.telegram_id, true)}
                          />
                        </td>
                      </tr>
                    ))}
                    {newUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          Нет пользователей в этой категории
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-4 py-3 font-medium">ID подписки</th>
                      <th className="px-4 py-3 font-medium">Telegram ID</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Истекает</th>
                      <th className="px-4 py-3 font-medium">Создана</th>
                      <th className="px-4 py-3 font-medium">Прокси</th>
                      <th className="px-4 py-3 font-medium">VPN</th>
                      <th className="px-4 py-3 font-medium text-right">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => {
                      const accessOn = isSubAccessActive(s)
                      const vpn = s.vpn_active
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-gray-400">{s.id}</td>
                          <td className="px-4 py-3 font-mono">{s.telegram_id}</td>
                          <td className="px-4 py-3 text-gray-300">
                            {s.username ? `@${s.username}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={s.payment_status} />
                            {s.access_blocked_reason ? (
                              <div
                                className="text-[10px] text-orange-300 mt-1 font-mono leading-tight"
                                title="Доступ заблокирован по правилу"
                              >
                                {s.access_blocked_reason}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{formatDate(s.expires_at)}</td>
                          <td className="px-4 py-3 text-gray-400">{formatDate(s.created_at)}</td>
                          <td className="px-4 py-3">
                            {s.has_proxy ? (
                              <span className="text-emerald-400">✓</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {vpn === true ? (
                              <span
                                className="text-emerald-400"
                                title={s.vpn_uuid ? `UUID: ${s.vpn_uuid}` : "VLESS-клиент активен в 3X-UI"}
                              >
                                ✓ активен
                              </span>
                            ) : vpn === false ? (
                              <span
                                className="text-orange-400"
                                title="Клиент есть в 3X-UI, но помечен inactive (toggle off или превышен трафик)"
                              >
                                ⏸ выкл
                              </span>
                            ) : (
                              <span
                                className="text-rose-400"
                                title="В vpn_clients нет записи — оплата прошла, но provisioning не сработал. Щёлкни тумблер, чтобы пересоздать."
                              >
                                ✗ нет
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AccessToggle
                              active={accessOn}
                              busy={pendingTgId === s.telegram_id}
                              onToggle={() =>
                                void setUserSubscription(s.telegram_id, !accessOn)
                              }
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          Нет платных подписчиков
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* VPN Clients section */}
        {vpnClients !== null && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-gray-300">VPN клиенты (VLESS)</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Всего клиентов</div>
                <div className="text-2xl font-bold text-blue-400">{vpnClients.total}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Активных</div>
                <div className="text-2xl font-bold text-emerald-400">{vpnClients.active_count}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Отключённых</div>
                <div className="text-2xl font-bold text-orange-400">{vpnClients.total - vpnClients.active_count}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">Суммарный трафик</div>
                <div className="text-2xl font-bold text-cyan-400">{vpnClients.total_traffic_gb.toFixed(2)} GB</div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-4 py-3 font-medium">Telegram ID</th>
                      <th className="px-4 py-3 font-medium">UUID</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Трафик</th>
                      <th className="px-4 py-3 font-medium">Создан</th>
                      <th className="px-4 py-3 font-medium">Синхронизирован</th>
                      <th className="px-4 py-3 font-medium text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vpnClients.clients.map((c) => (
                      <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono">{c.telegram_id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400" title={c.uuid}>
                          {c.uuid_prefix}…
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-700 text-gray-400"}`}>
                            {c.active ? "Активен" : "Отключён"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                          {c.traffic_used_gb.toFixed(3)} GB
                          {c.traffic_limit_gb > 0 && <span className="text-gray-500"> / {c.traffic_limit_gb} GB</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.last_sync_at ? formatDate(c.last_sync_at) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {c.active ? (
                            <button
                              type="button"
                              disabled={vpnDeactivatingId === c.telegram_id}
                              onClick={async () => {
                                setVpnDeactivatingId(c.telegram_id)
                                try {
                                  const res = await fetch(`/api/admin/vpn-clients/${c.telegram_id}/deactivate`, {
                                    method: "POST",
                                    headers: { ...headers(), "Content-Type": "application/json" },
                                    body: "{}",
                                    cache: "no-store",
                                  })
                                  if (res.ok) await fetchAll()
                                } finally {
                                  setVpnDeactivatingId(null)
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/60 text-red-300 hover:bg-red-900 disabled:opacity-50 transition-colors"
                            >
                              {vpnDeactivatingId === c.telegram_id ? "…" : "Деактивировать"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {vpnClients.clients.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          VPN клиентов нет
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-1 text-gray-300">ИИ-поддержка</h2>
          <p className="text-xs text-gray-500 mb-4">
            Диалоги пользователей с ИИ-ботом поддержки (OpenRouter). Записываются автоматически после
            каждого ответа — видно вопрос, ответ, модель, длительность и ошибки.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              {
                label: "Сообщений всего",
                value: supportStats?.total ?? "—",
                sub: supportStats?.last_message_at
                  ? `последнее ${formatDate(supportStats.last_message_at)}`
                  : "нет сообщений",
                color: "text-blue-400",
              },
              {
                label: "За 24 часа",
                value: supportStats?.last_24h ?? "—",
                sub: supportStats ? `за 7д: ${supportStats.last_7d}` : undefined,
                color: "text-emerald-400",
              },
              {
                label: "Уникальных 7д",
                value: supportStats?.unique_users_7d ?? "—",
                sub: supportStats ? `всего: ${supportStats.unique_users_total}` : undefined,
                color: "text-purple-400",
              },
              {
                label: "Ошибок",
                value: supportStats?.errors_total ?? "—",
                sub:
                  supportStats?.avg_duration_ms != null
                    ? `avg ${(supportStats.avg_duration_ms / 1000).toFixed(1)} s`
                    : "avg —",
                color:
                  supportStats && supportStats.errors_total > 0
                    ? "text-red-400"
                    : "text-gray-400",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
              >
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                {c.sub && <div className="text-xs text-gray-500 mt-1">{c.sub}</div>}
              </div>
            ))}
          </div>

          {supportStats && supportStats.daily_7d.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
              <div className="text-xs text-gray-500 mb-3 font-medium">Сообщений по дням (7д)</div>
              {(() => {
                const maxVal = Math.max(1, ...supportStats.daily_7d.map((d) => d.count))
                return (
                  <div className="flex items-end gap-2 h-28">
                    {supportStats.daily_7d.map((b) => {
                      const h = Math.round((b.count / maxVal) * 100)
                      const short = b.day.slice(5)
                      return (
                        <div
                          key={b.day}
                          className="flex-1 flex flex-col items-center justify-end gap-1"
                          title={`${b.day}: ${b.count}`}
                        >
                          <div className="text-xs text-gray-400 font-mono">{b.count}</div>
                          <div
                            className="w-full bg-blue-600/80 rounded-t"
                            style={{ height: `${Math.max(4, h)}%` }}
                          />
                          <div className="text-[10px] text-gray-500 font-mono">{short}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {supportStats && supportStats.top_users_7d.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
              <div className="text-xs text-gray-500 mb-3 font-medium">Топ пользователей (7д)</div>
              <div className="flex flex-wrap gap-2">
                {supportStats.top_users_7d.map((u) => (
                  <button
                    key={u.telegram_id}
                    type="button"
                    onClick={() => {
                      const tgStr = String(u.telegram_id)
                      setSupportTgFilter(tgStr)
                      void fetchSupportMessages({ tgId: tgStr })
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                    title="Фильтровать список по этому пользователю"
                  >
                    {u.username ? `@${u.username}` : u.telegram_id}
                    <span className="ml-2 text-blue-400">{u.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              type="text"
              inputMode="numeric"
              value={supportTgFilter}
              onChange={(e) => setSupportTgFilter(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchSupportMessages()
              }}
              placeholder="Фильтр по Telegram ID…"
              className="px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 outline-none focus:border-blue-500 w-56"
            />
            <button
              type="button"
              onClick={() => void fetchSupportMessages()}
              className="px-3 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Применить
            </button>
            {supportTgFilter && (
              <button
                type="button"
                onClick={() => {
                  setSupportTgFilter("")
                  void fetchSupportMessages({ tgId: "" })
                }}
                className="px-3 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Сбросить
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-300 select-none ml-auto">
              <input
                type="checkbox"
                checked={supportOnlyErrors}
                onChange={(e) => {
                  setSupportOnlyErrors(e.target.checked)
                  void fetchSupportMessages({ onlyErrors: e.target.checked })
                }}
                className="w-4 h-4"
              />
              Только ошибки
            </label>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">Когда</th>
                    <th className="px-4 py-3 font-medium">Пользователь</th>
                    <th className="px-4 py-3 font-medium">Вопрос</th>
                    <th className="px-4 py-3 font-medium">Ответ</th>
                    <th className="px-4 py-3 font-medium text-right">Метрики</th>
                  </tr>
                </thead>
                <tbody>
                  {(supportMessages?.messages ?? []).map((m) => {
                    const expanded = supportExpandedId === m.id
                    const shrink = (s: string, n: number) =>
                      !expanded && s.length > n ? `${s.slice(0, n)}…` : s
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-gray-800/50 align-top transition-colors ${
                          expanded ? "bg-gray-800/30" : "hover:bg-gray-800/20"
                        } ${!m.ok ? "bg-red-950/10" : ""}`}
                        onClick={() =>
                          setSupportExpandedId(expanded ? null : m.id)
                        }
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs">{m.telegram_id}</div>
                          {m.username && (
                            <div className="text-xs text-gray-500">@{m.username}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-200 whitespace-pre-wrap max-w-md">
                          {shrink(m.user_text, 220)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 whitespace-pre-wrap max-w-md">
                          {shrink(m.assistant_text, 220)}
                          {!m.ok && m.error && (
                            <div className="mt-1 text-xs text-red-400 font-mono">
                              {m.error}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 text-right whitespace-nowrap">
                          {m.duration_ms != null && (
                            <div className="font-mono">{m.duration_ms} ms</div>
                          )}
                          {m.model && (
                            <div className="font-mono text-gray-600 truncate max-w-[160px]">
                              {m.model}
                            </div>
                          )}
                          {!m.ok && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                              ошибка
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!supportMessages || supportMessages.messages.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Сообщений пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {supportMessages && supportMessages.total > supportMessages.messages.length && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-800">
                Показаны последние {supportMessages.messages.length} из {supportMessages.total}.
              </div>
            )}
          </div>
        </section>

        {stats?.referrals && stats.referrals.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-gray-300">Источники трафика</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-4 py-3 font-medium">Источник</th>
                      <th className="px-4 py-3 font-medium">Ссылка</th>
                      <th className="px-4 py-3 font-medium text-right">Пользователей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.referrals.map((r) => (
                      <tr
                        key={r.source}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{r.source}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          t.me/frostytg_bot?start={r.source}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-blue-400 font-bold">{r.count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
