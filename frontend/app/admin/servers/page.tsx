"use client"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import {
  AdminAuthError,
  ProxyStatus,
  Stats,
  VpnClientsData,
  VpnOnline,
  clearStoredAdminKey,
  fetchAdminJson,
  formatAdminDate,
  formatNumber,
  formatTrafficGb,
  getStoredAdminKey,
} from "@/lib/admin"
import {
  AlertTriangle,
  Clock3,
  Search,
  Server,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

const REFRESH_MS = 30000

function proxyStateLabel(proxy: ProxyStatus | null) {
  if (!proxy) return "Нет данных"
  if (!proxy.online) return "Offline"
  if (proxy.degraded) return "Degraded"
  return "Online"
}

function subscriptionLabel(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return "Оплачено"
    case "trial":
      return "Триал"
    case "expired":
      return "Истекло"
    case "pending":
      return "Ожидает оплату"
    default:
      return "—"
  }
}

export default function ServersPage() {
  const router = useRouter()
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [vpnOnline, setVpnOnline] = useState<VpnOnline | null>(null)
  const [vpnClients, setVpnClients] = useState<VpnClientsData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(
    async (adminKey: string) => {
      setLoading(true)
      setError("")
      try {
        const [proxyData, vpnOnlineData, vpnClientsData, statsData] = await Promise.all([
          fetchAdminJson<ProxyStatus>("/api/admin/proxy-status", adminKey),
          fetchAdminJson<VpnOnline>("/api/admin/vpn-online", adminKey),
          fetchAdminJson<VpnClientsData>("/api/admin/vpn-clients", adminKey),
          fetchAdminJson<Stats>("/api/admin/stats", adminKey),
        ])
        setProxy(proxyData)
        setVpnOnline(vpnOnlineData)
        setVpnClients(vpnClientsData)
        setStats(statsData)
      } catch (err) {
        if (err instanceof AdminAuthError) {
          clearStoredAdminKey()
          router.replace("/admin")
          return
        }
        setError(err instanceof Error ? err.message : "Не удалось загрузить live-данные")
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  useEffect(() => {
    const adminKey = getStoredAdminKey()
    if (!adminKey) {
      router.replace("/admin")
      return
    }
    void loadData(adminKey)
  }, [loadData, router])

  useEffect(() => {
    const adminKey = getStoredAdminKey()
    if (!adminKey) return
    const timer = setInterval(() => {
      void loadData(adminKey)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadData])

  const filteredClients = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    const clients = vpnClients?.clients ?? []
    if (!normalized) return clients
    return clients.filter((client) => {
      return (
        String(client.telegram_id).includes(normalized) ||
        client.uuid.toLowerCase().includes(normalized) ||
        client.uuid_prefix.toLowerCase().includes(normalized)
      )
    })
  }, [searchQuery, vpnClients?.clients])

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <div className="flex-1 lg:ml-64">
        <AdminHeader
          title="Серверы"
          subtitle="Текущее состояние MTProxy и VPN без выдуманных нод"
          note="Автообновление каждые 30 секунд"
        />

        <main className="p-4 lg:p-6 space-y-6">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Server className="w-4 h-4" />
                MTProxy
              </div>
              <p className="text-2xl font-semibold text-foreground">{proxyStateLabel(proxy)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {proxy ? `${proxy.server}:${proxy.port}` : "Нет подключения"}
              </p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" />
                VPN online сейчас
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(vpnOnline?.online ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Из endpoint `/vpn/online`</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShieldCheck className="w-4 h-4" />
                VPN-клиенты
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(vpnClients?.active_count ?? 0)} / {formatNumber(vpnClients?.total ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Активные / всего</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wifi className="w-4 h-4" />
                Трафик
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatTrafficGb(vpnClients?.total_traffic_gb ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Активных подписок: {formatNumber(stats?.active_subscriptions ?? 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-foreground">MTProxy</h2>
                <p className="text-sm text-muted-foreground">Реальное состояние TCP/handshake, без фиктивных uptime-графиков</p>
              </div>

              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Состояние</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      !proxy?.online
                        ? "bg-destructive/10 text-destructive"
                        : proxy.degraded
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                    }`}
                  >
                    {proxyStateLabel(proxy)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Адрес</span>
                  <span className="text-sm text-foreground">{proxy ? `${proxy.server}:${proxy.port}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Latency</span>
                  <span className="text-sm text-foreground">{proxy?.latency_ms != null ? `${proxy.latency_ms} ms` : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Handshake</span>
                  <span className="text-sm text-foreground">{proxy?.handshake ?? "—"}</span>
                </div>
              </div>

              {proxy?.degraded ? (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
                  Порт открыт, но ответ не похож на корректный MTProxy. Это надо проверять на сервере.
                </div>
              ) : null}
            </section>

            <section className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-foreground">VPN Reality</h2>
                <p className="text-sm text-muted-foreground">Сводка по реально созданным клиентам и их трафику</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-secondary/50 border border-border p-4">
                  <p className="text-sm text-muted-foreground">Сейчас online</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">{formatNumber(vpnOnline?.online ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 border border-border p-4">
                  <p className="text-sm text-muted-foreground">Клиенты без user-записи</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">
                    {formatNumber((vpnClients?.clients ?? []).filter((client) => !client.user_exists).length)}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 border border-border p-4">
                  <p className="text-sm text-muted-foreground">Активные клиенты</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">{formatNumber(vpnClients?.active_count ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 border border-border p-4">
                  <p className="text-sm text-muted-foreground">Суммарный трафик</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">{formatTrafficGb(vpnClients?.total_traffic_gb ?? 0)}</p>
                </div>
              </div>
            </section>
          </div>

          <section className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">VPN-клиенты</h2>
                <p className="text-sm text-muted-foreground">Список из `vpn_clients`, уже со сведённым статусом подписки</p>
              </div>
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по Telegram ID или UUID"
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            {loading && !vpnClients ? (
              <div className="rounded-xl bg-secondary/50 border border-border px-4 py-10 text-center text-muted-foreground">
                Загружаю live-список клиентов…
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-3 pr-4 font-medium">Telegram ID</th>
                    <th className="py-3 pr-4 font-medium">UUID</th>
                    <th className="py-3 pr-4 font-medium">Клиент</th>
                    <th className="py-3 pr-4 font-medium">Подписка</th>
                    <th className="py-3 pr-4 font-medium">Трафик</th>
                    <th className="py-3 pr-4 font-medium">Лимит</th>
                    <th className="py-3 font-medium">Последний sync</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="border-b border-border last:border-0">
                      <td className="py-4 pr-4 align-top text-sm text-foreground">{client.telegram_id}</td>
                      <td className="py-4 pr-4 align-top">
                        <div className="text-sm text-foreground font-mono">{client.uuid_prefix}…</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatAdminDate(client.created_at)}</div>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${client.active ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                          {client.active ? "Активен" : "Выключен"}
                        </span>
                        <p className="text-xs text-muted-foreground mt-2">{client.user_exists ? "user есть" : "без user-записи"}</p>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <p className="text-sm text-foreground">{subscriptionLabel(client.subscription_status)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {client.subscription_access_suspended ? "Доступ снят вручную" : formatAdminDate(client.subscription_expires_at ?? null)}
                        </p>
                      </td>
                      <td className="py-4 pr-4 align-top text-sm text-foreground">{formatTrafficGb(client.traffic_used_gb)}</td>
                      <td className="py-4 pr-4 align-top text-sm text-foreground">
                        {client.traffic_limit_gb > 0 ? `${formatNumber(client.traffic_limit_gb)} ГБ` : "Без лимита"}
                      </td>
                      <td className="py-4 align-top">
                        <div className="inline-flex items-center gap-2 text-sm text-foreground">
                          <Clock3 className="w-4 h-4 text-muted-foreground" />
                          {formatAdminDate(client.last_sync_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        По этому фильтру клиентов нет.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
