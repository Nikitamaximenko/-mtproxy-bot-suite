"use client"

import { useCallback, useEffect, useState } from "react"

type RefStat = {
  source: string
  count: number
}

type Stats = {
  total_users: number
  active_subscriptions: number
  expired_subscriptions: number
  pending_payments: number
  revenue_estimate: number
  referrals: RefStat[]
}

type ProxyStatus = {
  server: string
  port: number
  online: boolean
  latency_ms: number | null
}

type SubInfo = {
  id: number
  telegram_id: number
  payment_status: string
  expires_at: string | null
  created_at: string
  has_proxy: boolean
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    pending: "bg-yellow-100 text-yellow-800",
    expired: "bg-red-100 text-red-800",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

export default function AdminPage() {
  const [key, setKey] = useState("")
  const [authed, setAuthed] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [subs, setSubs] = useState<SubInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const headers = useCallback(() => ({ "x-admin-key": key }), [key])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [sRes, pRes, subRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: headers(), cache: "no-store" }),
        fetch("/api/admin/proxy-status", { headers: headers(), cache: "no-store" }),
        fetch("/api/admin/subscriptions", { headers: headers(), cache: "no-store" }),
      ])

      if (sRes.status === 403) {
        setAuthed(false)
        setError("Неверный ключ")
        return
      }

      const [sData, pData, subData] = await Promise.all([sRes.json(), pRes.json(), subRes.json()])
      setStats(sData)
      setProxy(pData)
      setSubs(subData.subscriptions || [])
      setAuthed(true)
    } catch {
      setError("Не удалось загрузить данные")
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    if (!authed) return
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [authed, fetchAll])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    fetchAll()
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Frosty Admin</h1>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? "⟳" : "Обновить"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Proxy Status */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Прокси-сервер</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            {proxy ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${proxy.online ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-lg font-medium">
                    {proxy.server}:{proxy.port}
                  </span>
                  <span className={`text-sm font-medium ${proxy.online ? "text-emerald-400" : "text-red-400"}`}>
                    {proxy.online ? "Online" : "Offline"}
                  </span>
                </div>
                {proxy.latency_ms !== null && (
                  <span className="text-sm text-gray-400">
                    Latency: <span className="text-white font-mono">{proxy.latency_ms}ms</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="text-gray-500">Загрузка…</div>
            )}
          </div>
        </section>

        {/* Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Аналитика</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Пользователей", value: stats?.total_users ?? "—", color: "text-blue-400" },
              { label: "Активных", value: stats?.active_subscriptions ?? "—", color: "text-emerald-400" },
              { label: "Истекших", value: stats?.expired_subscriptions ?? "—", color: "text-orange-400" },
              { label: "Ожидают оплату", value: stats?.pending_payments ?? "—", color: "text-yellow-400" },
              { label: "Выручка (≈)", value: stats ? `${stats.revenue_estimate.toLocaleString("ru-RU")} ₽` : "—", color: "text-green-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Subscriptions Table */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Подписки (последние 100)</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Telegram ID</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Истекает</th>
                    <th className="px-4 py-3 font-medium">Создана</th>
                    <th className="px-4 py-3 font-medium">Прокси</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-400">{s.id}</td>
                      <td className="px-4 py-3 font-mono">{s.telegram_id}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.payment_status} /></td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(s.expires_at)}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3">
                        {s.has_proxy ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {subs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Нет подписок
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Referral Sources */}
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
                      <tr key={r.source} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{r.source}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          t.me/FrostyBot?start={r.source}
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
