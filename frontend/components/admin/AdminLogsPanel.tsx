"use client"

import {
  AdminAuthError,
  CheckoutLogsData,
  CheckoutStats,
  SupportAiMessagesData,
  SupportAiStats,
  checkoutStageLabel,
  fetchAdminJson,
  formatAdminDate,
} from "@/lib/admin"
import { useCallback, useEffect, useState } from "react"

type Tab = "checkout" | "support"

type AdminLogsPanelProps = {
  adminKey: string
  onError: (msg: string) => void
}

function shortenText(text: string, max: number, expanded: boolean) {
  if (expanded || text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string
  value: string | number
  sub?: string
  tone?: "default" | "success" | "warning" | "danger"
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground"

  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${valueClass}`}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </div>
  )
}

export function AdminLogsPanel({ adminKey, onError }: AdminLogsPanelProps) {
  const [tab, setTab] = useState<Tab>("checkout")

  const [checkoutStats, setCheckoutStats] = useState<CheckoutStats | null>(null)
  const [checkoutLogs, setCheckoutLogs] = useState<CheckoutLogsData | null>(null)
  const [checkoutOnlyErrors, setCheckoutOnlyErrors] = useState(false)
  const [checkoutTgFilter, setCheckoutTgFilter] = useState("")
  const [checkoutSearch, setCheckoutSearch] = useState("")
  const [checkoutExpandedId, setCheckoutExpandedId] = useState<number | null>(null)

  const [supportStats, setSupportStats] = useState<SupportAiStats | null>(null)
  const [supportMessages, setSupportMessages] = useState<SupportAiMessagesData | null>(null)
  const [supportOnlyErrors, setSupportOnlyErrors] = useState(false)
  const [supportTgFilter, setSupportTgFilter] = useState("")
  const [supportSearch, setSupportSearch] = useState("")
  const [supportExpandedId, setSupportExpandedId] = useState<number | null>(null)

  const handleFetchError = useCallback(
    (err: unknown) => {
      if (err instanceof AdminAuthError) {
        onError(err.message)
        return
      }
      onError(err instanceof Error ? err.message : "Не удалось загрузить логи")
    },
    [onError],
  )

  const loadCheckout = useCallback(
    async (opts?: { tgId?: string; onlyErrors?: boolean; search?: string }) => {
      if (!adminKey) return
      const q = new URLSearchParams({ limit: "100" })
      const tgRaw = (opts?.tgId ?? checkoutTgFilter).trim()
      if (tgRaw) {
        const asNum = Number(tgRaw)
        if (Number.isFinite(asNum) && asNum > 0) q.set("tg_id", String(asNum))
      }
      const searchRaw = (opts?.search ?? checkoutSearch).trim()
      if (searchRaw) q.set("search", searchRaw)
      if (opts?.onlyErrors ?? checkoutOnlyErrors) q.set("only_errors", "true")

      try {
        const [logsData, statsData] = await Promise.all([
          fetchAdminJson<CheckoutLogsData>(`/api/admin/checkout/logs?${q.toString()}`, adminKey),
          fetchAdminJson<CheckoutStats>("/api/admin/checkout/stats", adminKey),
        ])
        setCheckoutLogs(logsData)
        setCheckoutStats(statsData)
      } catch (err) {
        handleFetchError(err)
      }
    },
    [adminKey, checkoutOnlyErrors, checkoutSearch, checkoutTgFilter, handleFetchError],
  )

  const loadSupport = useCallback(
    async (opts?: { tgId?: string; onlyErrors?: boolean; search?: string; offset?: number }) => {
      if (!adminKey) return
      const q = new URLSearchParams({ limit: "300" })
      const tgRaw = (opts?.tgId ?? supportTgFilter).trim()
      if (tgRaw) {
        const asNum = Number(tgRaw)
        if (Number.isFinite(asNum) && asNum > 0) q.set("tg_id", String(asNum))
      }
      const searchRaw = (opts?.search ?? supportSearch).trim()
      if (searchRaw) q.set("search", searchRaw)
      if (opts?.offset) q.set("offset", String(opts.offset))
      if (opts?.onlyErrors ?? supportOnlyErrors) q.set("only_errors", "true")

      try {
        const [messagesData, statsData] = await Promise.all([
          fetchAdminJson<SupportAiMessagesData>(`/api/admin/support/messages?${q.toString()}`, adminKey),
          fetchAdminJson<SupportAiStats>("/api/admin/support/stats", adminKey),
        ])
        setSupportMessages(messagesData)
        setSupportStats(statsData)
      } catch (err) {
        handleFetchError(err)
      }
    },
    [adminKey, handleFetchError, supportOnlyErrors, supportSearch, supportTgFilter],
  )

  useEffect(() => {
    if (!adminKey) return
    if (tab === "checkout") {
      void loadCheckout()
    } else {
      void loadSupport()
    }
  }, [adminKey, tab, checkoutOnlyErrors, supportOnlyErrors, loadCheckout, loadSupport])

  const dailyBuckets =
    supportStats?.daily_30d?.length ? supportStats.daily_30d : (supportStats?.daily_7d ?? [])
  const topUsers =
    supportStats?.top_users_30d?.length ? supportStats.top_users_30d : (supportStats?.top_users_7d ?? [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("checkout")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "checkout" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Оплаты
        </button>
        <button
          type="button"
          onClick={() => setTab("support")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "support" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Поддержка ИИ
        </button>
      </div>

      {tab === "checkout" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Событий всего"
              value={checkoutStats?.total ?? "—"}
              sub={
                checkoutStats?.last_success_at
                  ? `последний успех ${formatAdminDate(checkoutStats.last_success_at)}`
                  : "успехов пока нет"
              }
            />
            <StatCard
              label="За 24 часа"
              value={checkoutStats?.last_24h ?? "—"}
              sub={checkoutStats ? `ошибок: ${checkoutStats.errors_24h}` : undefined}
              tone="success"
            />
            <StatCard
              label="Ошибок всего"
              value={checkoutStats?.errors_total ?? "—"}
              sub={
                checkoutStats?.last_error_at
                  ? `последняя ${formatAdminDate(checkoutStats.last_error_at)}`
                  : "ошибок нет"
              }
              tone={checkoutStats && checkoutStats.errors_total > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Fallback за 24ч"
              value={checkoutStats?.fallback_24h ?? "—"}
              sub="Lava не дала нормальную ссылку"
              tone={checkoutStats && checkoutStats.fallback_24h > 0 ? "warning" : "default"}
            />
          </div>

          {checkoutStats && checkoutStats.stage_24h.length > 0 ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-3 font-medium">Этапы checkout за 24 часа</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checkoutStats.stage_24h.map((stage) => (
                  <div
                    key={stage.stage}
                    className="rounded-lg border border-border bg-secondary/40 px-4 py-3"
                  >
                    <div className="text-sm text-foreground">{checkoutStageLabel(stage.stage)}</div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">{stage.stage}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      всего <span className="text-foreground font-semibold">{stage.total}</span>
                      {" · "}
                      ошибок{" "}
                      <span className={stage.errors > 0 ? "text-destructive font-semibold" : ""}>
                        {stage.errors}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={checkoutTgFilter}
              onChange={(e) => setCheckoutTgFilter(e.target.value.replace(/[^\d-]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCheckout()
              }}
              placeholder="Telegram ID…"
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg w-40"
            />
            <input
              type="text"
              value={checkoutSearch}
              onChange={(e) => setCheckoutSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCheckout()
              }}
              placeholder="payment_id / token…"
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg w-72 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void loadCheckout()}
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Применить
            </button>
            {checkoutTgFilter ? (
              <button
                type="button"
                onClick={() => {
                  setCheckoutTgFilter("")
                  void loadCheckout({ tgId: "" })
                }}
                className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Сбросить
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-muted-foreground select-none ml-auto">
              <input
                type="checkbox"
                checked={checkoutOnlyErrors}
                onChange={(e) => setCheckoutOnlyErrors(e.target.checked)}
                className="w-4 h-4"
              />
              Только ошибки
            </label>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Когда</th>
                    <th className="px-4 py-3 font-medium">Этап</th>
                    <th className="px-4 py-3 font-medium">Пользователь</th>
                    <th className="px-4 py-3 font-medium">Ошибка / ссылка</th>
                    <th className="px-4 py-3 font-medium text-right">Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {(checkoutLogs?.logs ?? []).map((log) => {
                    const expanded = checkoutExpandedId === log.id
                    return (
                      <tr
                        key={log.id}
                        className={`border-b border-border/60 align-top transition-colors cursor-pointer ${
                          expanded ? "bg-secondary/50" : "hover:bg-secondary/30"
                        } ${!log.ok ? "bg-destructive/5" : ""}`}
                        onClick={() => setCheckoutExpandedId(expanded ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatAdminDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-foreground">{checkoutStageLabel(log.stage)}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">{log.stage}</div>
                          {log.provider ? (
                            <div className="text-xs text-muted-foreground mt-1">{log.provider}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs">{log.telegram_id ?? "—"}</div>
                          {log.username ? (
                            <div className="text-xs text-muted-foreground">@{log.username}</div>
                          ) : null}
                          {log.email || log.customer_email ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              {log.customer_email || log.email}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-pre-wrap max-w-xl">
                          {log.error ? (
                            <div className="text-destructive font-mono text-xs mb-1">{log.error}</div>
                          ) : null}
                          {log.payment_url ? (
                            <a
                              href={log.payment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline break-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortenText(log.payment_url, 160, expanded)}
                            </a>
                          ) : null}
                          {log.details ? (
                            <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                              {shortenText(log.details, 260, expanded)}
                            </div>
                          ) : null}
                          {!log.error && !log.payment_url && !log.details ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground text-right whitespace-nowrap">
                          <div className="font-mono">{log.source}</div>
                          {log.payment_token ? (
                            <div className="mt-1 font-mono">{log.payment_token.slice(0, 8)}…</div>
                          ) : null}
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              log.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {log.ok ? "ok" : "error"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {(!checkoutLogs || checkoutLogs.logs.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Checkout-логов пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {checkoutLogs && checkoutLogs.total > checkoutLogs.logs.length ? (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                Показаны последние {checkoutLogs.logs.length} из {checkoutLogs.total}.
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {supportStats && (supportStats.last_24h ?? 0) === 0 && (supportStats.total ?? 0) > 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
              Нет диалогов 24ч. Последнее:{" "}
              {supportStats.last_message_at ? formatAdminDate(supportStats.last_message_at) : "—"}.
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Сообщений всего"
              value={supportStats?.total ?? "—"}
              sub={
                supportStats?.last_message_at
                  ? `последнее ${formatAdminDate(supportStats.last_message_at)}`
                  : "нет сообщений"
              }
            />
            <StatCard
              label="За 24 часа"
              value={supportStats?.last_24h ?? "—"}
              sub={supportStats ? `за 30д: ${supportStats.last_30d ?? supportStats.last_7d}` : undefined}
              tone="success"
            />
            <StatCard
              label="Уникальных 30д"
              value={supportStats?.unique_users_30d ?? supportStats?.unique_users_7d ?? "—"}
              sub={supportStats ? `всего: ${supportStats.unique_users_total}` : undefined}
            />
            <StatCard
              label="Ошибок"
              value={supportStats?.errors_total ?? "—"}
              sub={
                supportStats?.avg_duration_ms != null
                  ? `avg ${(supportStats.avg_duration_ms / 1000).toFixed(1)} s`
                  : "avg —"
              }
              tone={supportStats && supportStats.errors_total > 0 ? "danger" : "default"}
            />
          </div>

          {supportStats && dailyBuckets.length > 0 ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-3 font-medium">
                Сообщений по дням ({supportStats.period_days ?? 30}д)
              </div>
              {(() => {
                const maxVal = Math.max(1, ...dailyBuckets.map((d) => d.count))
                return (
                  <div className="flex items-end gap-1 h-28 overflow-x-auto">
                    {dailyBuckets.map((b) => {
                      const h = Math.round((b.count / maxVal) * 100)
                      const short = b.day.slice(5)
                      return (
                        <div
                          key={b.day}
                          className="flex-1 flex flex-col items-center justify-end gap-1 min-w-[28px]"
                          title={`${b.day}: ${b.count}`}
                        >
                          <div className="text-xs text-muted-foreground font-mono">{b.count}</div>
                          <div
                            className="w-full bg-primary/70 rounded-t"
                            style={{ height: `${Math.max(4, h)}%` }}
                          />
                          <div className="text-[10px] text-muted-foreground font-mono">{short}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ) : null}

          {supportStats && topUsers.length > 0 ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-3 font-medium">
                Топ пользователей ({supportStats.period_days ?? 30}д) — клик фильтрует таблицу
              </div>
              <div className="flex flex-wrap gap-2">
                {topUsers.map((u) => (
                  <button
                    key={u.telegram_id}
                    type="button"
                    onClick={() => {
                      const tgStr = String(u.telegram_id)
                      setSupportTgFilter(tgStr)
                      void loadSupport({ tgId: tgStr })
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors"
                    title="Фильтровать список по этому пользователю"
                  >
                    {u.username ? `@${u.username}` : u.telegram_id}
                    <span className="ml-2 text-primary">{u.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={supportTgFilter}
              onChange={(e) => setSupportTgFilter(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadSupport()
              }}
              placeholder="Telegram ID…"
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg w-40"
            />
            <input
              type="text"
              value={supportSearch}
              onChange={(e) => setSupportSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadSupport()
              }}
              placeholder="username / текст…"
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg w-48"
            />
            <button
              type="button"
              onClick={() => void loadSupport()}
              className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Применить
            </button>
            {supportTgFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSupportTgFilter("")
                  void loadSupport({ tgId: "" })
                }}
                className="px-3 py-2 text-sm bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Сбросить
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-muted-foreground select-none ml-auto">
              <input
                type="checkbox"
                checked={supportOnlyErrors}
                onChange={(e) => setSupportOnlyErrors(e.target.checked)}
                className="w-4 h-4"
              />
              Только ошибки
            </label>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
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
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-border/60 align-top transition-colors cursor-pointer ${
                          expanded ? "bg-secondary/50" : "hover:bg-secondary/30"
                        } ${!m.ok ? "bg-destructive/5" : ""}`}
                        onClick={() => setSupportExpandedId(expanded ? null : m.id)}
                      >
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatAdminDate(m.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs">{m.telegram_id}</div>
                          {m.username ? (
                            <div className="text-xs text-muted-foreground">@{m.username}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-pre-wrap max-w-md">
                          {shortenText(m.user_text, 220, expanded)}
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-pre-wrap max-w-md">
                          {shortenText(m.assistant_text, 220, expanded)}
                          {!m.ok && m.error ? (
                            <div className="mt-1 text-xs text-destructive font-mono">{m.error}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground text-right whitespace-nowrap">
                          {m.duration_ms != null ? (
                            <div className="font-mono">{m.duration_ms} ms</div>
                          ) : null}
                          {m.model ? (
                            <div className="font-mono truncate max-w-[160px]">{m.model}</div>
                          ) : null}
                          {!m.ok ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                              ошибка
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                  {(!supportMessages || supportMessages.messages.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Сообщений пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {supportMessages && supportMessages.total > supportMessages.messages.length ? (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border flex items-center justify-between gap-2">
                <span>
                  Показаны {supportMessages.messages.length} из {supportMessages.total} (новые сверху).
                </span>
                <button
                  type="button"
                  className="text-primary hover:text-primary/80"
                  onClick={() =>
                    void loadSupport({ offset: supportMessages.messages.length })
                  }
                >
                  Загрузить ещё
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
