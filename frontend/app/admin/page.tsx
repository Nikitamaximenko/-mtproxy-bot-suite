"use client"

import { AdminDashboardOverview } from "@/components/admin/AdminDashboardOverview"
import { AdminPageChrome } from "@/components/admin/AdminPageChrome"
import { AdminQuickNav } from "@/components/admin/AdminQuickNav"
import {
  CheckoutStats,
  ProxyStatus,
  Stats,
  UsersOverview,
  VpnOnline,
} from "@/lib/admin"
import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "frosty_admin_key"
const ADMIN_TG_ID = 231115635
const REFRESH_MS = 30000

export default function AdminPage() {
  const [key, setKey] = useState("")
  const [authed, setAuthed] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [vpnOnline, setVpnOnline] = useState<VpnOnline | null>(null)
  const [overview, setOverview] = useState<UsersOverview | null>(null)
  const [checkoutStats, setCheckoutStats] = useState<CheckoutStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [remember, setRemember] = useState(true)
  const [activatingAdmin, setActivatingAdmin] = useState(false)

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

  const fetchDashboard = useCallback(
    async (overrideKey?: string) => {
      const activeKey = overrideKey ?? key
      setLoading(true)
      setError("")
      try {
        const [sRes, pRes, vRes, ovRes, csRes] = await Promise.all([
          fetch("/api/admin/stats", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/proxy-status", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/vpn-online", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/users-overview", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/checkout/stats", { headers: headers(activeKey), cache: "no-store" }),
        ])

        if (sRes.status === 403 || ovRes.status === 403) {
          setAuthed(false)
          setOverview(null)
          setCheckoutStats(null)
          setError("Неверный ключ")
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {
            /* ignore */
          }
          return
        }

        const [sData, pData, vData, ovData, csData] = await Promise.all([
          sRes.json(),
          pRes.json(),
          vRes.ok ? vRes.json() : Promise.resolve(null),
          ovRes.json(),
          csRes.ok ? csRes.json() : Promise.resolve(null),
        ])
        const rawStats = sData as Stats & { marketing_opt_out_users?: number }
        setStats({
          ...rawStats,
          marketing_opt_out_users: rawStats.marketing_opt_out_users ?? 0,
        })
        setProxy(pData as ProxyStatus)
        setVpnOnline(vData as VpnOnline | null)
        setOverview(ovData as UsersOverview)
        setCheckoutStats(csData as CheckoutStats | null)
        setAuthed(true)
        persistKey(activeKey)
      } catch {
        setError("Не удалось загрузить данные")
      } finally {
        setLoading(false)
      }
    },
    [headers, key, persistKey],
  )

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
        await fetchDashboard(saved)
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
      void fetchDashboard()
    }, REFRESH_MS)
    return () => clearInterval(interval)
  }, [authed, fetchDashboard])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    void fetchDashboard()
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setAuthed(false)
    setStats(null)
    setProxy(null)
    setVpnOnline(null)
    setOverview(null)
    setCheckoutStats(null)
    setKey("")
    setError("")
  }

  const activateAdminSub = async () => {
    setActivatingAdmin(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/activate/${ADMIN_TG_ID}`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`)
      }
      await fetchDashboard()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось активировать подписку")
    } finally {
      setActivatingAdmin(false)
    }
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-muted-foreground">Загрузка…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Frosty Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Введите ключ администратора</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ADMIN_API_KEY"
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4"
            />
            Запомнить на этом компьютере
          </label>
          <button
            type="submit"
            disabled={!key || loading}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Загрузка…" : "Войти"}
          </button>
          {error ? <p className="text-destructive text-sm text-center">{error}</p> : null}
        </form>
      </div>
    )
  }

  const analyticsScoped = Boolean(stats?.analytics_scoped) || Boolean(overview?.analytics_scoped)
  const subscribers = overview?.subscribers ?? []
  const paidNoVpn = subscribers.filter((s) => {
    if (!s.expires_at || new Date(s.expires_at) <= new Date()) return false
    if (s.payment_status !== "paid" && s.payment_status !== "trial") return false
    if (s.access_suspended || s.access_blocked_reason) return false
    return s.vpn_active !== true
  }).length

  const toolbar = (
    <>
      <button
        type="button"
        onClick={() => void fetchDashboard()}
        disabled={loading || activatingAdmin}
        className="px-3 py-1.5 text-sm bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50"
      >
        {loading ? "⟳" : "Обновить"}
      </button>
      <button
        type="button"
        onClick={() => void activateAdminSub()}
        disabled={loading || activatingAdmin}
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {activatingAdmin ? "…" : "Подписка админа"}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className="px-3 py-1.5 text-sm border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10"
      >
        Выйти
      </button>
    </>
  )

  return (
    <AdminPageChrome
      title="Сводка"
      subtitle="Статус сервисов и быстрый переход в разделы"
      note={loading ? "Обновление…" : "Live с VPS"}
      toolbar={toolbar}
      onLogout={handleLogout}
    >
      {analyticsScoped ? (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Метрики ограничены <code className="font-mono">ANALYTICS_PRODUCTION_TG_IDS</code> на сервере.
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm mb-4">{error}</p> : null}

      <div className="space-y-6">
        <AdminDashboardOverview
          stats={stats}
          proxy={proxy}
          vpnOnline={vpnOnline}
          subscribers={subscribers}
        />
        <AdminQuickNav checkoutErrors24h={checkoutStats?.errors_24h} vpnProblems={paidNoVpn} />
      </div>
    </AdminPageChrome>
  )
}
