"use client"

import {
  FunnelStats,
  PRODUCTION_TELEGRAM_IDS,
  Stats,
  fetchAdminJson,
  formatNumber,
} from "@/lib/admin"
import { useCallback, useEffect, useRef, useState } from "react"

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

type BroadcastStatus = {
  running: boolean
  done: boolean
  total: number
  sent: number
  failed: number
  error: string | null
}

type BroadcastStartResponse = {
  ok?: boolean
  queued?: boolean
  total?: number
}

type AdminOperationsPanelProps = {
  adminKey: string
  stats: Stats | null
  onRefresh: () => void
  onError: (msg: string) => void
}

function safeFunnelWebUsers(raw: FunnelStats | null): number {
  if (!raw || typeof raw.web_users !== "number") return 0
  return raw.web_users
}

function formatSelfTestState(s: SelfTestUserState): string {
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

export function AdminOperationsPanel({
  adminKey,
  stats,
  onRefresh,
  onError,
}: AdminOperationsPanelProps) {
  const [webUsers, setWebUsers] = useState(0)
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
  const [cleanupResult, setCleanupResult] = useState<{
    deleted_users: number
    deleted_pending_subscriptions: number
    kept_paid_subscriptions: number
  } | null>(null)
  const [purgeBusy, setPurgeBusy] = useState(false)
  const [purgeResult, setPurgeResult] = useState<{
    deleted_users: number
    deleted_subscriptions: number
    deleted_vpn_peers: number
    deleted_vpn_clients: number
  } | null>(null)
  const [selfTestBusy, setSelfTestBusy] = useState(false)
  const [selfTestResult, setSelfTestResult] = useState<SelfTestResponse | null>(null)

  const broadcastRecipientEstimate =
    stats == null
      ? null
      : includeOptedOut
        ? stats.tg_users
        : Math.max(0, stats.tg_users - stats.marketing_opt_out_users)

  const loadFunnel = useCallback(async () => {
    if (!adminKey) return
    try {
      const funnel = await fetchAdminJson<FunnelStats>("/api/admin/funnel", adminKey)
      setWebUsers(safeFunnelWebUsers(funnel))
    } catch {
      /* funnel optional for cleanup label */
    }
  }, [adminKey])

  useEffect(() => {
    void loadFunnel()
  }, [loadFunnel])

  const stopBroadcastPolling = useCallback(() => {
    if (broadcastPollRef.current) {
      clearInterval(broadcastPollRef.current)
      broadcastPollRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopBroadcastPolling()
  }, [stopBroadcastPolling])

  const pollBroadcastStatus = useCallback(async () => {
    if (!adminKey) return
    try {
      const s = await fetchAdminJson<BroadcastStatus>("/api/admin/broadcast-status", adminKey)
      setBroadcastResult({
        total: s.total,
        sent: s.sent,
        failed: s.failed,
        done: s.done,
        error: s.error,
      })
      if (s.done || !s.running) {
        stopBroadcastPolling()
        setBroadcastBusy(false)
      }
    } catch {
      /* ignore poll errors */
    }
  }, [adminKey, stopBroadcastPolling])

  const sendBroadcast = useCallback(async () => {
    const text = broadcastText.trim()
    if (!text || broadcastRecipientEstimate === null || broadcastRecipientEstimate === 0 || !adminKey) {
      return
    }

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
    onError("")
    try {
      const data = await fetchAdminJson<BroadcastStartResponse>("/api/admin/broadcast", adminKey, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          include_opted_out: includeOptedOut,
          ...(buttonEnabled && buttonText.trim() && buttonUrl.trim()
            ? { button_text: buttonText.trim(), button_url: buttonUrl.trim() }
            : {}),
        }),
      })
      setBroadcastResult({ total: data.total ?? 0, sent: 0, failed: 0, done: false, error: null })
      setBroadcastText("")
      broadcastPollRef.current = setInterval(() => void pollBroadcastStatus(), 2000)
      void pollBroadcastStatus()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось запустить рассылку")
      setBroadcastBusy(false)
    }
  }, [
    adminKey,
    broadcastRecipientEstimate,
    broadcastText,
    buttonEnabled,
    buttonText,
    buttonUrl,
    includeOptedOut,
    onError,
    pollBroadcastStatus,
    stopBroadcastPolling,
  ])

  const cleanupWebUsers = useCallback(async () => {
    if (!adminKey) return
    const ok = window.confirm(
      "Удалить всех веб-пользователей (telegram_id < 0) и их pending-подписки?\n" +
        "Paid/expired подписки сохранятся. Это необратимо.",
    )
    if (!ok) return
    setCleanupBusy(true)
    setCleanupResult(null)
    onError("")
    try {
      const data = await fetchAdminJson<{
        deleted_users?: number
        deleted_pending_subscriptions?: number
        kept_paid_subscriptions?: number
      }>("/api/admin/cleanup-web-users", adminKey, { method: "DELETE" })
      setCleanupResult({
        deleted_users: data.deleted_users ?? 0,
        deleted_pending_subscriptions: data.deleted_pending_subscriptions ?? 0,
        kept_paid_subscriptions: data.kept_paid_subscriptions ?? 0,
      })
      onRefresh()
      void loadFunnel()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось выполнить очистку")
    } finally {
      setCleanupBusy(false)
    }
  }, [adminKey, loadFunnel, onError, onRefresh])

  const purgeExceptProduction = useCallback(async () => {
    if (!adminKey) return
    const idsStr = PRODUCTION_TELEGRAM_IDS.join(", ")
    const ok = window.confirm(
      "УДАЛИТЬ из базы всех пользователей и подписки, КРОМЕ следующих telegram_id?\n\n" +
        idsStr +
        "\n\nБудут удалены строки в users, subscriptions, vpn_peers, vpn_clients. " +
        "Операция необратима. Продолжить?",
    )
    if (!ok) return
    const typed = window.prompt('Для подтверждения введите слово PURGE (заглавными):')
    if (typed !== "PURGE") {
      onError(typed === null ? "" : "Нужно ввести PURGE")
      return
    }
    setPurgeBusy(true)
    setPurgeResult(null)
    onError("")
    try {
      const data = await fetchAdminJson<{
        deleted_users?: number
        deleted_subscriptions?: number
        deleted_vpn_peers?: number
        deleted_vpn_clients?: number
      }>("/api/admin/purge-except", adminKey, {
        method: "POST",
        body: JSON.stringify({
          telegram_ids: [...PRODUCTION_TELEGRAM_IDS],
          confirm: "PURGE",
        }),
      })
      setPurgeResult({
        deleted_users: data.deleted_users ?? 0,
        deleted_subscriptions: data.deleted_subscriptions ?? 0,
        deleted_vpn_peers: data.deleted_vpn_peers ?? 0,
        deleted_vpn_clients: data.deleted_vpn_clients ?? 0,
      })
      onRefresh()
      void loadFunnel()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось выполнить очистку")
    } finally {
      setPurgeBusy(false)
    }
  }, [adminKey, loadFunnel, onError, onRefresh])

  const runSelfTest = useCallback(async () => {
    if (!adminKey) return
    setSelfTestBusy(true)
    setSelfTestResult(null)
    onError("")
    try {
      const data = await fetchAdminJson<SelfTestResponse>("/api/admin/self-test-toggle", adminKey, {
        method: "POST",
        body: JSON.stringify({ telegram_ids: [...PRODUCTION_TELEGRAM_IDS] }),
      })
      setSelfTestResult(data)
      onRefresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось запустить самотест")
    } finally {
      setSelfTestBusy(false)
    }
  }, [adminKey, onError, onRefresh])

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Рассылка в боте</h2>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Получателей (оценка):{" "}
              <strong className="text-foreground font-mono">
                {broadcastRecipientEstimate === null ? "—" : formatNumber(broadcastRecipientEstimate)}
              </strong>
            </span>
            {stats != null && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">
                  всего в БД: {formatNumber(stats.total_users)}, отписались от рассылок:{" "}
                  {formatNumber(stats.marketing_opt_out_users)}
                </span>
              </>
            )}
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none text-sm text-foreground max-w-xl">
            <input
              type="checkbox"
              checked={includeOptedOut}
              onChange={(e) => setIncludeOptedOut(e.target.checked)}
              disabled={broadcastBusy}
              className="mt-1 w-4 h-4 shrink-0"
            />
            <span>
              Включить пользователей, отписавшихся от маркетинга (
              <code className="text-muted-foreground">/stop</code>). По умолчанию они{" "}
              <strong className="text-warning">не</strong> получают рассылку.
            </span>
          </label>
          <div>
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value.slice(0, 4096))}
              disabled={broadcastBusy}
              rows={6}
              placeholder="Текст для всех получателей…"
              className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-sm resize-y min-h-[120px] disabled:opacity-60"
            />
            <div className="flex justify-end mt-1 text-xs text-muted-foreground">
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
            <span className="text-sm text-foreground">Добавить кнопку</span>
          </label>
          {buttonEnabled && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value.slice(0, 64))}
                disabled={broadcastBusy}
                placeholder='Текст кнопки, напр. "Подключить →"'
                className="w-full px-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm disabled:opacity-60"
              />
              <input
                type="url"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value.slice(0, 2048))}
                disabled={broadcastBusy}
                placeholder="URL кнопки, напр. https://t.me/frostytg_bot"
                className="w-full px-4 py-2 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm disabled:opacity-60"
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
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {broadcastBusy ? "Отправляем…" : "Отправить рассылку"}
            </button>

            {broadcastResult && (
              <div className="space-y-2">
                {broadcastResult.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {broadcastResult.done ? "Готово" : "Отправляем…"}{" "}
                        <span className="text-success font-mono">{broadcastResult.sent}</span>
                        {" / "}
                        <span className="font-mono text-foreground">{broadcastResult.total}</span>
                      </span>
                      {broadcastResult.failed > 0 && (
                        <span className="text-destructive">ошибок: {broadcastResult.failed}</span>
                      )}
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          broadcastResult.done ? "bg-success" : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.round(
                            ((broadcastResult.sent + broadcastResult.failed) / broadcastResult.total) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {broadcastResult.error && (
                  <p className="text-xs text-destructive">Ошибка: {broadcastResult.error}</p>
                )}
                {broadcastResult.done && !broadcastResult.error && (
                  <p className="text-xs text-success">
                    Рассылка завершена: {broadcastResult.sent} доставлено
                    {broadcastResult.failed > 0
                      ? `, ${broadcastResult.failed} не доставлено (бот заблокирован)`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Самотест доступа ({PRODUCTION_TELEGRAM_IDS.length} prod)
        </h2>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => void runSelfTest()}
              disabled={selfTestBusy}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-success text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {selfTestBusy
                ? "Выполняется…"
                : `Запустить самотест (${PRODUCTION_TELEGRAM_IDS.length} prod)`}
            </button>
            {selfTestResult && (
              <span className="text-sm text-muted-foreground">
                Результат:{" "}
                <span className="text-success font-semibold">{selfTestResult.passed} ok</span>
                {selfTestResult.failed > 0 && (
                  <>
                    {" · "}
                    <span className="text-destructive font-semibold">{selfTestResult.failed} fail</span>
                  </>
                )}
                {" · "}
                MT_PROXY env:{" "}
                <span
                  className={selfTestResult.mt_proxy_configured ? "text-success" : "text-destructive"}
                >
                  {selfTestResult.mt_proxy_configured ? "ok" : "не настроен"}
                </span>
                {" · "}
                3X-UI:{" "}
                <span className={selfTestResult.xray_configured ? "text-success" : "text-destructive"}>
                  {selfTestResult.xray_configured ? "ok" : "не настроен"}
                </span>
              </span>
            )}
          </div>

          {selfTestResult && selfTestResult.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-2 py-2 font-medium">Юзер</th>
                    <th className="px-2 py-2 font-medium">Было</th>
                    <th className="px-2 py-2 font-medium">После «выкл»</th>
                    <th className="px-2 py-2 font-medium">После «вкл»</th>
                    <th className="px-2 py-2 font-medium text-right">Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {selfTestResult.results.map((r) => (
                    <tr key={r.telegram_id} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2">
                        <div className="font-mono text-foreground">{r.telegram_id}</div>
                        <div className="text-muted-foreground">
                          {r.username ? `@${r.username}` : "—"}
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-muted-foreground">
                        {formatSelfTestState(r.before)}
                      </td>
                      <td className="px-2 py-2 font-mono">
                        <span className={r.deactivate_ok ? "text-foreground" : "text-destructive"}>
                          {formatSelfTestState(r.after_deactivate)}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono">
                        <span className={r.activate_ok ? "text-success" : "text-destructive"}>
                          {formatSelfTestState(r.after_activate)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {r.ok ? (
                          <span className="text-success font-semibold">OK</span>
                        ) : (
                          <span className="text-destructive font-semibold" title={r.error ?? ""}>
                            FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selfTestResult.results.some((r) => !r.ok) && (
                <div className="mt-3 space-y-1">
                  {selfTestResult.results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <div key={r.telegram_id} className="text-xs text-destructive">
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

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Очистка базы</h2>
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4 flex-wrap">
            {webUsers > 0 && (
              <button
                type="button"
                onClick={() => void cleanupWebUsers()}
                disabled={cleanupBusy}
                className="px-4 py-2 text-sm rounded-xl bg-secondary border border-border text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
              >
                {cleanupBusy ? "Удаление…" : `Очистить ${webUsers} веб-пользователей`}
              </button>
            )}
            <button
              type="button"
              onClick={() => void purgeExceptProduction()}
              disabled={purgeBusy || cleanupBusy}
              className="px-4 py-2 text-sm rounded-xl bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
            >
              {purgeBusy
                ? "Очистка БД…"
                : `Удалить всех, кроме ${PRODUCTION_TELEGRAM_IDS.length} prod (users + подписки + VPN)`}
            </button>
            {cleanupResult && (
              <span className="text-xs text-muted-foreground">
                Удалено: {cleanupResult.deleted_users} пользователей,{" "}
                {cleanupResult.deleted_pending_subscriptions} pending-подписок
                {cleanupResult.kept_paid_subscriptions > 0
                  ? ` · сохранено paid: ${cleanupResult.kept_paid_subscriptions}`
                  : ""}
              </span>
            )}
            {purgeResult && (
              <span className="text-xs text-muted-foreground">
                Purge: users {purgeResult.deleted_users}, подписок {purgeResult.deleted_subscriptions}, WG{" "}
                {purgeResult.deleted_vpn_peers}, VLESS {purgeResult.deleted_vpn_clients}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Prod ID: {PRODUCTION_TELEGRAM_IDS.join(", ")}
          </p>
        </div>
      </section>
    </div>
  )
}
