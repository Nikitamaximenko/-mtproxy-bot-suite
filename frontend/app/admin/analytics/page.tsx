"use client"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import {
  AdminAuthError,
  FunnelStats,
  ProxyStatus,
  Stats,
  UsersOverview,
  VpnClientsData,
  VpnOnline,
  clearStoredAdminKey,
  fetchAdminJson,
  formatNumber,
  formatRubles,
  formatTrafficGb,
  getStoredAdminKey,
} from "@/lib/admin"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  DollarSign,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const REFRESH_MS = 30000

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Users
}) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground mt-2">{value}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{hint}</p>
    </div>
  )
}

function HealthBadge({ proxy }: { proxy: ProxyStatus | null }) {
  if (!proxy) {
    return <span className="text-xs text-muted-foreground">Нет данных</span>
  }

  if (!proxy.online) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <span className="w-2 h-2 rounded-full bg-destructive" />
        Offline
      </span>
    )
  }

  if (proxy.degraded) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
        <span className="w-2 h-2 rounded-full bg-warning" />
        Degraded
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
      <span className="w-2 h-2 rounded-full bg-success" />
      Online
    </span>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [funnel, setFunnel] = useState<FunnelStats | null>(null)
  const [overview, setOverview] = useState<UsersOverview | null>(null)
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [vpnOnline, setVpnOnline] = useState<VpnOnline | null>(null)
  const [vpnClients, setVpnClients] = useState<VpnClientsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(
    async (adminKey: string) => {
      setLoading(true)
      setError("")
      try {
        const [statsData, funnelData, overviewData, proxyData, vpnOnlineData, vpnClientsData] =
          await Promise.all([
            fetchAdminJson<Stats>("/api/admin/stats", adminKey),
            fetchAdminJson<FunnelStats>("/api/admin/funnel", adminKey),
            fetchAdminJson<UsersOverview>("/api/admin/users-overview", adminKey),
            fetchAdminJson<ProxyStatus>("/api/admin/proxy-status", adminKey),
            fetchAdminJson<VpnOnline>("/api/admin/vpn-online", adminKey),
            fetchAdminJson<VpnClientsData>("/api/admin/vpn-clients", adminKey),
          ])

        setStats(statsData)
        setFunnel(funnelData)
        setOverview(overviewData)
        setProxy(proxyData)
        setVpnOnline(vpnOnlineData)
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

  const analyticsScoped =
    Boolean(stats?.analytics_scoped) ||
    Boolean(funnel?.analytics_scoped) ||
    Boolean(overview?.analytics_scoped)

  const trialClaimed = stats?.trial_offers_claimed ?? 0
  const trialConverted = stats?.trial_converted_to_paid ?? 0
  const trialConversionRate = trialClaimed > 0 ? Math.round((trialConverted / trialClaimed) * 100) : 0

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <div className="flex-1 lg:ml-64">
        <AdminHeader
          title="Аналитика"
          subtitle="Только live-статистика из backend и БД"
          note="Автообновление каждые 30 секунд"
        />

        <main className="p-4 lg:p-6 space-y-6">
          {analyticsScoped ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
              Метрики ограничены серверным списком <code>ANALYTICS_PRODUCTION_TG_IDS</code>, не всей базой.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading && !stats && !funnel ? (
            <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
              Загружаю live-метрики…
            </div>
          ) : null}

          {stats && funnel ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                  label="Telegram-пользователи"
                  value={formatNumber(stats.tg_users)}
                  hint={`Новых за 7 дней: ${formatNumber(funnel.tg_users_7d)}`}
                  icon={Users}
                />
                <MetricCard
                  label="Активные подписки"
                  value={formatNumber(stats.active_subscriptions)}
                  hint={`Истекли: ${formatNumber(stats.expired_subscriptions)} · ждут оплату: ${formatNumber(stats.pending_payments)}`}
                  icon={ShieldCheck}
                />
                <MetricCard
                  label="Выручка"
                  value={formatRubles(stats.revenue_estimate)}
                  hint="Оценка по завершённым оплаченным периодам"
                  icon={DollarSign}
                />
                <MetricCard
                  label="Пробный день"
                  value={`${formatNumber(trialConverted)} / ${formatNumber(trialClaimed)}`}
                  hint={`Конверсия в оплату: ${trialConversionRate}%`}
                  icon={Activity}
                />
              </div>

              <section className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Живая воронка</h2>
                    <p className="text-sm text-muted-foreground">Без синтетических графиков, только реальные счётчики</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {[
                    { label: "Запустили бота", value: funnel.tg_users, note: `7 дней: ${formatNumber(funnel.tg_users_7d)}` },
                    { label: "Дошли до checkout", value: funnel.tg_checkout, note: `7 дней: ${formatNumber(funnel.tg_checkout_7d)}` },
                    { label: "Получили ссылку оплаты", value: funnel.tg_payment_link, note: "Уникальные TG-пользователи" },
                    { label: "Оплатили", value: funnel.tg_paid, note: `7 дней: ${formatNumber(funnel.tg_paid_7d)}` },
                    { label: "Активны сейчас", value: funnel.active_now, note: "Оплата/триал + срок не истёк" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-secondary/50 border border-border p-4">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="text-2xl font-semibold text-foreground mt-2">{formatNumber(item.value)}</p>
                      <p className="text-xs text-muted-foreground mt-2">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-xl bg-secondary/50 border border-border p-4">
                    <p className="text-sm text-muted-foreground">Веб-пользователи</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">{formatNumber(funnel.web_users)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Оплатили: {formatNumber(funnel.web_paid)}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 border border-border p-4">
                    <p className="text-sm text-muted-foreground">Маркетинг nudges</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">
                      {formatNumber(funnel.nudge_1_sent)} / {formatNumber(funnel.nudge_2_sent)} / {formatNumber(funnel.nudge_3_sent)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">Конвертировали в оплату: {formatNumber(funnel.nudge_converted)}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 border border-border p-4">
                    <p className="text-sm text-muted-foreground">Отписались от маркетинга</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">{formatNumber(funnel.opted_out)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Всего записей users: {formatNumber(overview?.users_table_total ?? 0)}</p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Database className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="font-semibold text-foreground">Источники трафика</h2>
                      <p className="text-sm text-muted-foreground">Пользователи и оплата по реальным ref_source</p>
                    </div>
                  </div>

                  {funnel.source_stats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Источник не зафиксирован ни у одной записи.</p>
                  ) : (
                    <div className="space-y-3">
                      {funnel.source_stats.map((source) => {
                        const conversion = source.users > 0 ? Math.round((source.paid / source.users) * 100) : 0
                        return (
                          <div key={source.source ?? "unknown"} className="rounded-xl bg-secondary/50 border border-border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{source.source ?? "Без source"}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {formatNumber(source.users)} пользователей · {formatNumber(source.paid)} оплатили
                                </p>
                              </div>
                              <span className="text-sm font-medium text-primary">{conversion}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Clock3 className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="font-semibold text-foreground">Инфраструктура сейчас</h2>
                      <p className="text-sm text-muted-foreground">Текущее состояние MTProxy и VPN без выдуманных серверов</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-secondary/50 border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">MTProxy</p>
                          <p className="font-medium text-foreground mt-1">
                            {proxy ? `${proxy.server}:${proxy.port}` : "Нет данных"}
                          </p>
                        </div>
                        <HealthBadge proxy={proxy} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Латентность: {proxy?.latency_ms != null ? `${proxy.latency_ms} ms` : "—"} · handshake: {proxy?.handshake ?? "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-secondary/50 border border-border p-4">
                        <p className="text-sm text-muted-foreground">VPN online сейчас</p>
                        <p className="text-2xl font-semibold text-foreground mt-2">
                          {formatNumber(vpnOnline?.online ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Онлайн-сессии по backend endpoint `/vpn/online`</p>
                      </div>
                      <div className="rounded-xl bg-secondary/50 border border-border p-4">
                        <p className="text-sm text-muted-foreground">VPN-клиенты</p>
                        <p className="text-2xl font-semibold text-foreground mt-2">
                          {formatNumber(vpnClients?.active_count ?? 0)} / {formatNumber(vpnClients?.total ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Активны · трафик: {formatTrafficGb(vpnClients?.total_traffic_gb ?? 0)}
                        </p>
                      </div>
                    </div>

                    {proxy?.degraded ? (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
                        Порт отвечает, но поведение не похоже на нормальный MTProxy. Telegram-клиентам это может мешать.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
