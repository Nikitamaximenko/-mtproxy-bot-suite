"use client"

import type { ProxyStatus, Stats, VpnOnline } from "@/lib/admin"
import { formatNumber, formatRubles, isSubAccessActive, type SubInfo } from "@/lib/admin"

type Props = {
  stats: Stats | null
  proxy: ProxyStatus | null
  vpnOnline: VpnOnline | null
  subscribers?: SubInfo[]
}

export function AdminDashboardOverview({ stats, proxy, vpnOnline, subscribers = [] }: Props) {
  const paidNoVpn = subscribers.filter((s) => {
    if (!s.expires_at || new Date(s.expires_at) <= new Date()) return false
    if (s.payment_status !== "paid" && s.payment_status !== "trial") return false
    if (s.access_suspended || s.access_blocked_reason) return false
    return s.vpn_active !== true
  }).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3">MTProxy</p>
          {proxy ? (
            proxy.handshake === "not_configured" ? (
              <p className="text-sm text-muted-foreground">Отключён — только VLESS VPN.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      !proxy.online
                        ? "bg-destructive"
                        : proxy.degraded
                          ? "bg-warning animate-pulse"
                          : "bg-success animate-pulse"
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {proxy.server}:{proxy.port}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      !proxy.online
                        ? "text-destructive"
                        : proxy.degraded
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {!proxy.online ? "Offline" : proxy.degraded ? "Degraded" : "Online"}
                  </span>
                  {proxy.latency_ms != null ? (
                    <span className="text-sm text-muted-foreground font-mono">{proxy.latency_ms} ms</span>
                  ) : null}
                </div>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3">VLESS Reality VPN</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  vpnOnline !== null ? "bg-success animate-pulse" : "bg-muted"
                }`}
              />
              <span className="text-sm font-medium text-foreground">138.124.80.97</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-success">{vpnOnline?.online ?? "—"}</p>
              <p className="text-xs text-muted-foreground">онлайн в 3X-UI</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "В боте", value: formatNumber(stats?.tg_users ?? 0), tone: "text-primary" },
          { label: "Активных", value: formatNumber(stats?.active_subscriptions ?? 0), tone: "text-success" },
          { label: "Платящих", value: formatNumber(stats?.paying_customers ?? 0), tone: "text-success" },
          {
            label: "Выручка",
            value: stats?.revenue_estimate != null ? formatRubles(stats.revenue_estimate) : "—",
            tone: "text-foreground",
          },
          { label: "Ожидают оплату", value: formatNumber(stats?.pending_payments ?? 0), tone: "text-warning" },
          { label: "Истекли", value: formatNumber(stats?.expired_subscriptions ?? 0), tone: "text-muted-foreground" },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {paidNoVpn > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <strong>{paidNoVpn}</strong> пользователей с оплатой, но без активного VPN — смотрите фильтр «Проблема с VPN» в{" "}
          <a href="/admin/users" className="text-primary underline">
            Пользователях
          </a>
          .
        </div>
      ) : null}
    </div>
  )
}
