"use client"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import {
  AdminAuthError,
  RegistryUserInfo,
  Stats,
  SubInfo,
  UsersOverview,
  VpnClientInfo,
  VpnClientsData,
  clearStoredAdminKey,
  fetchAdminJson,
  formatAdminDate,
  formatNumber,
  getStoredAdminKey,
  isSubAccessActive,
} from "@/lib/admin"
import { CreditCard, Search, ShieldCheck, UserPlus, Users, Wifi } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

const REFRESH_MS = 30000

type SubscriberFilter = "all" | "active" | "expired" | "suspended" | "vpn_problem"

function paymentLabel(status: string) {
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
      return status
  }
}

function paymentColor(status: string) {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success"
    case "trial":
      return "bg-sky-500/10 text-sky-600"
    case "expired":
      return "bg-destructive/10 text-destructive"
    case "pending":
      return "bg-warning/10 text-warning"
    default:
      return "bg-secondary text-foreground"
  }
}

function accessState(sub: SubInfo): SubscriberFilter | "inactive" {
  if (sub.access_suspended || sub.access_blocked_reason) return "suspended"
  if (isSubAccessActive(sub)) return "active"
  if (sub.expires_at && new Date(sub.expires_at).getTime() <= Date.now()) return "expired"
  if (sub.vpn_active !== true) return "vpn_problem"
  return "inactive"
}

function accessLabel(sub: SubInfo) {
  const state = accessState(sub)
  switch (state) {
    case "active":
      return "Доступ активен"
    case "expired":
      return "Срок истёк"
    case "suspended":
      return "Отключено вручную"
    case "vpn_problem":
      return "Есть оплата, но VPN не активен"
    default:
      return "Нет доступа"
  }
}

function vpnLabel(sub: SubInfo, client: VpnClientInfo | null) {
  if (sub.vpn_active === true || client?.active) return "VPN активен"
  if (sub.vpn_active === false || client) return "VPN выключен"
  return "VPN не выдан"
}

function userMatchesSearch(value: { telegram_id: number; username?: string | null }, search: string) {
  const normalized = search.trim().toLowerCase()
  if (!normalized) return true
  return (
    String(value.telegram_id).includes(normalized) ||
    (value.username ?? "").toLowerCase().includes(normalized)
  )
}

export default function UsersPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<UsersOverview | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [vpnClients, setVpnClients] = useState<VpnClientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"subscribers" | "new">("subscribers")
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<SubscriberFilter>("all")

  const loadData = useCallback(
    async (adminKey: string) => {
      setLoading(true)
      setError("")
      try {
        const [overviewData, statsData, vpnClientsData] = await Promise.all([
          fetchAdminJson<UsersOverview>("/api/admin/users-overview", adminKey),
          fetchAdminJson<Stats>("/api/admin/stats", adminKey),
          fetchAdminJson<VpnClientsData>("/api/admin/vpn-clients", adminKey),
        ])
        setOverview(overviewData)
        setStats(statsData)
        setVpnClients(vpnClientsData)
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

  const vpnMap = useMemo(
    () => new Map((vpnClients?.clients ?? []).map((client) => [client.telegram_id, client])),
    [vpnClients],
  )

  const filteredSubscribers = useMemo(() => {
    const subscribers = overview?.subscribers ?? []
    return subscribers.filter((sub) => {
      if (!userMatchesSearch(sub, searchQuery)) return false
      if (filter === "all") return true
      return accessState(sub) === filter
    })
  }, [filter, overview?.subscribers, searchQuery])

  const filteredNewUsers = useMemo(() => {
    const newUsers = overview?.new_users ?? []
    return newUsers.filter((user) => userMatchesSearch(user, searchQuery))
  }, [overview?.new_users, searchQuery])

  const analyticsScoped = Boolean(overview?.analytics_scoped) || Boolean(stats?.analytics_scoped)

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <div className="flex-1 lg:ml-64">
        <AdminHeader
          title="Пользователи"
          subtitle="Реестр пользователей и доступов по live-данным"
          note="Автообновление каждые 30 секунд"
        />

        <main className="p-4 lg:p-6 space-y-6">
          {analyticsScoped ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
              Обзор пользователей ограничен серверным списком <code>ANALYTICS_PRODUCTION_TG_IDS</code>.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="w-4 h-4" />
                Всего в users
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(overview?.users_table_total ?? 0)}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <CreditCard className="w-4 h-4" />
                С оплатой в истории
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(overview?.subscribers_total ?? 0)}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <UserPlus className="w-4 h-4" />
                Без оплаченной истории
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(overview?.new_users_total ?? 0)}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShieldCheck className="w-4 h-4" />
                Активный доступ
              </div>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(stats?.active_subscriptions ?? 0)}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setTab("subscribers")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    tab === "subscribers" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Подписчики
                </button>
                <button
                  type="button"
                  onClick={() => setTab("new")}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    tab === "new" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Новые / без оплаты
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative min-w-[260px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Поиск по username или Telegram ID"
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                  />
                </div>

                {tab === "subscribers" ? (
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as SubscriberFilter)}
                    className="px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm"
                  >
                    <option value="all">Все статусы</option>
                    <option value="active">Доступ активен</option>
                    <option value="expired">Истекли</option>
                    <option value="suspended">Отключены вручную</option>
                    <option value="vpn_problem">Проблема с VPN</option>
                  </select>
                ) : null}
              </div>
            </div>

            {loading && !overview ? (
              <div className="rounded-xl bg-secondary/50 border border-border px-4 py-10 text-center text-muted-foreground">
                Загружаю реальный список пользователей…
              </div>
            ) : null}

            {tab === "subscribers" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-3 pr-4 font-medium">Пользователь</th>
                      <th className="py-3 pr-4 font-medium">Оплата</th>
                      <th className="py-3 pr-4 font-medium">Доступ</th>
                      <th className="py-3 pr-4 font-medium">VPN / MTProxy</th>
                      <th className="py-3 pr-4 font-medium">Истекает</th>
                      <th className="py-3 font-medium">Автоплатёж</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscribers.map((sub) => {
                      const vpnClient = vpnMap.get(sub.telegram_id) ?? null
                      return (
                        <tr key={sub.id} className="border-b border-border last:border-0">
                          <td className="py-4 pr-4 align-top">
                            <p className="font-medium text-foreground">{sub.username || "Без username"}</p>
                            <p className="text-sm text-muted-foreground mt-1">ID: {sub.telegram_id}</p>
                            <p className="text-xs text-muted-foreground mt-1">Запись подписки: {formatAdminDate(sub.created_at)}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${paymentColor(sub.payment_status)}`}>
                              {paymentLabel(sub.payment_status)}
                            </span>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <p className="text-sm text-foreground">{accessLabel(sub)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sub.access_blocked_reason || (sub.access_suspended ? "manual" : "—")}
                            </p>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <p className="text-sm text-foreground">{vpnLabel(sub, vpnClient)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              MTProxy: {sub.has_proxy ? "выдан" : "нет"}{vpnClient ? ` · UUID ${vpnClient.uuid_prefix}` : ""}
                            </p>
                          </td>
                          <td className="py-4 pr-4 align-top text-sm text-foreground">{formatAdminDate(sub.expires_at)}</td>
                          <td className="py-4 align-top">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${sub.autopay_enabled ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                              {sub.autopay_enabled ? "Включён" : "Нет"}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          По этому фильтру пользователей нет.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-3 pr-4 font-medium">Пользователь</th>
                      <th className="py-3 pr-4 font-medium">Источник</th>
                      <th className="py-3 pr-4 font-medium">Создан</th>
                      <th className="py-3 pr-4 font-medium">VPN</th>
                      <th className="py-3 font-medium">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNewUsers.map((user: RegistryUserInfo) => {
                      const vpnClient = vpnMap.get(user.telegram_id) ?? null
                      return (
                        <tr key={user.id} className="border-b border-border last:border-0">
                          <td className="py-4 pr-4 align-top">
                            <p className="font-medium text-foreground">{user.username || "Без username"}</p>
                            <p className="text-sm text-muted-foreground mt-1">ID: {user.telegram_id}</p>
                          </td>
                          <td className="py-4 pr-4 align-top text-sm text-foreground">{user.ref_source || "—"}</td>
                          <td className="py-4 pr-4 align-top text-sm text-foreground">{formatAdminDate(user.created_at)}</td>
                          <td className="py-4 pr-4 align-top">
                            <div className="inline-flex items-center gap-2 text-sm text-foreground">
                              <Wifi className="w-4 h-4 text-muted-foreground" />
                              {vpnClient ? (vpnClient.active ? "VPN активен" : "VPN выключен") : "Нет клиента"}
                            </div>
                          </td>
                          <td className="py-4 align-top text-sm text-muted-foreground">
                            Без оплаченной истории в subscriptions
                          </td>
                        </tr>
                      )
                    })}
                    {filteredNewUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-muted-foreground">
                          По этому фильтру пользователей нет.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
