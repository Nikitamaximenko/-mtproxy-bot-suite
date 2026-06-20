"use client"

import { TelegramClickbaitPreview } from "@/components/admin/TelegramClickbaitPreview"
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

type ClickbaitTemplate = {
  key: string
  title: string
  message_html: string
}

type ClickbaitTemplatesResponse = {
  button_text: string
  price_rub: number
  templates: ClickbaitTemplate[]
}

type DailyRunRow = {
  id: number
  run_date: string | null
  template_key: string
  status: string
  total_recipients: number
  sent: number
  failed: number
  clicks: number
  conversions: number
  click_rate_pct: number
  conversion_rate_pct: number
  finished_at: string | null
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
  const [clickbaitTemplates, setClickbaitTemplates] = useState<ClickbaitTemplatesResponse | null>(
    null,
  )
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [massBusy, setMassBusy] = useState(false)
  const [testBusyKey, setTestBusyKey] = useState<string | null>(null)
  const [massProgress, setMassProgress] = useState<{
    runId: number
    total: number
    sent: number
    failed: number
    done: boolean
    template_key: string
  } | null>(null)
  const dailyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [dailyRuns, setDailyRuns] = useState<DailyRunRow[]>([])
  const [dailyMeta, setDailyMeta] = useState<{ enabled: boolean; hour_msk: number } | null>(null)
  const [dailyListBusy, setDailyListBusy] = useState(false)
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
    stats == null ? null : Math.max(0, stats.tg_users - stats.marketing_opt_out_users)

  const loadClickbaitTemplates = useCallback(async () => {
    if (!adminKey) return
    setTemplatesLoading(true)
    try {
      const data = await fetchAdminJson<ClickbaitTemplatesResponse>(
        "/api/admin/daily-broadcasts/templates",
        adminKey,
      )
      setClickbaitTemplates(data)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить шаблоны B/C")
    } finally {
      setTemplatesLoading(false)
    }
  }, [adminKey, onError])

  const loadDailyBroadcasts = useCallback(async () => {
    if (!adminKey) return
    setDailyListBusy(true)
    try {
      const data = await fetchAdminJson<{
        runs: DailyRunRow[]
        enabled: boolean
        hour_msk: number
      }>("/api/admin/daily-broadcasts", adminKey)
      setDailyRuns(data.runs ?? [])
      setDailyMeta({ enabled: data.enabled, hour_msk: data.hour_msk })
      return data.runs ?? []
    } catch {
      return []
    } finally {
      setDailyListBusy(false)
    }
  }, [adminKey])

  useEffect(() => {
    void loadClickbaitTemplates()
    void loadDailyBroadcasts()
  }, [loadClickbaitTemplates, loadDailyBroadcasts])

  const stopDailyPolling = useCallback(() => {
    if (dailyPollRef.current) {
      clearInterval(dailyPollRef.current)
      dailyPollRef.current = null
    }
  }, [])

  useEffect(() => () => stopDailyPolling(), [stopDailyPolling])

  const pollMassRun = useCallback(
    async (runId: number) => {
      const runs = await loadDailyBroadcasts()
      const run = runs.find((r) => r.id === runId)
      if (!run) return
      setMassProgress({
        runId: run.id,
        total: run.total_recipients,
        sent: run.sent,
        failed: run.failed,
        done: Boolean(run.finished_at) || run.status === "done" || run.status === "failed",
        template_key: run.template_key,
      })
      if (run.finished_at || run.status === "done" || run.status === "failed") {
        stopDailyPolling()
        setMassBusy(false)
      }
    },
    [loadDailyBroadcasts, stopDailyPolling],
  )

  const sendTestTemplate = useCallback(
    async (templateKey: string) => {
      if (!adminKey) return
      setTestBusyKey(templateKey)
      onError("")
      try {
        await fetchAdminJson<{ ok: boolean; started: boolean }>(
          "/api/admin/daily-broadcasts/test-send",
          adminKey,
          {
            method: "POST",
            body: JSON.stringify({
              template_key: templateKey,
              telegram_ids: [...PRODUCTION_TELEGRAM_IDS],
            }),
          },
        )
        setTimeout(() => void loadDailyBroadcasts(), 2000)
      } catch (e) {
        onError(e instanceof Error ? e.message : `Не удалось отправить тест ${templateKey}`)
      } finally {
        setTestBusyKey(null)
      }
    },
    [adminKey, loadDailyBroadcasts, onError],
  )

  const sendMassTemplate = useCallback(
    async (templateKey?: string) => {
      if (!adminKey || broadcastRecipientEstimate === null || broadcastRecipientEstimate === 0) return
      const label = templateKey ? `шаблон ${templateKey}` : "следующий шаблон по очереди"
      const ok = window.confirm(
        `Отправить ${label} всем ${broadcastRecipientEstimate} получателям?\n\n` +
          "CTA ведёт в оплату в боте. Без отписавшихся (/stop).",
      )
      if (!ok) return

      stopDailyPolling()
      setMassBusy(true)
      setMassProgress(null)
      onError("")
      try {
        const q = templateKey ? `?template_key=${templateKey}` : ""
        const data = await fetchAdminJson<{ started: boolean; run_id?: number; total?: number }>(
          `/api/admin/daily-broadcasts/run-now${q}`,
          adminKey,
          { method: "POST" },
        )
        if (data.run_id) {
          setMassProgress({
            runId: data.run_id,
            total: data.total ?? broadcastRecipientEstimate,
            sent: 0,
            failed: 0,
            done: false,
            template_key: templateKey ?? "?",
          })
          dailyPollRef.current = setInterval(() => void pollMassRun(data.run_id!), 2000)
          void pollMassRun(data.run_id)
        } else {
          setMassBusy(false)
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Не удалось запустить рассылку")
        setMassBusy(false)
      }
    },
    [adminKey, broadcastRecipientEstimate, onError, pollMassRun, stopDailyPolling],
  )

  const [cleanupBusy, setCleanupBusy] = useState(false)

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
        <h2 className="text-sm font-medium text-muted-foreground">Кликбейт-рассылки B – H</h2>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Получателей (массовая):{" "}
              <strong className="text-foreground font-mono">
                {broadcastRecipientEstimate === null ? "—" : formatNumber(broadcastRecipientEstimate)}
              </strong>
            </span>
            {dailyMeta && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">
                  авто {dailyMeta.enabled ? "вкл" : "выкл"} · {dailyMeta.hour_msk}:00 МСK · ротация B→H
                </span>
              </>
            )}
            {clickbaitTemplates && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">
                  цена в тексте: <span className="font-mono">{clickbaitTemplates.price_rub} ₽</span>
                </span>
              </>
            )}
          </div>

          {templatesLoading && !clickbaitTemplates && (
            <p className="text-sm text-muted-foreground">Загрузка шаблонов…</p>
          )}

          {clickbaitTemplates && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {clickbaitTemplates.templates.map((tpl) => (
                <div key={tpl.key} className="space-y-4">
                  <TelegramClickbaitPreview
                    templateKey={tpl.key}
                    title={tpl.title}
                    messageHtml={tpl.message_html}
                    buttonText={clickbaitTemplates.button_text}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={testBusyKey !== null || massBusy}
                      onClick={() => void sendTestTemplate(tpl.key)}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {testBusyKey === tpl.key
                        ? "Отправляем…"
                        : `Тест себе (${PRODUCTION_TELEGRAM_IDS.length} prod)`}
                    </button>
                    <button
                      type="button"
                      disabled={massBusy || testBusyKey !== null || broadcastRecipientEstimate === 0}
                      onClick={() => void sendMassTemplate(tpl.key)}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {massBusy ? "Рассылка…" : `Всем — ${tpl.key}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button
              type="button"
              disabled={massBusy || testBusyKey !== null || broadcastRecipientEstimate === 0}
              onClick={() => void sendMassTemplate()}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-secondary disabled:opacity-50"
            >
              Следующий по очереди (B→…→H)
            </button>
            <button
              type="button"
              disabled={dailyListBusy}
              onClick={() => {
                void loadClickbaitTemplates()
                void loadDailyBroadcasts()
              }}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-secondary disabled:opacity-50"
            >
              Обновить
            </button>
          </div>

          {massProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {massProgress.done ? "Готово" : "Отправляем…"} · шаблон{" "}
                  <span className="font-mono">{massProgress.template_key}</span>
                </span>
                <span>
                  <span className="text-success font-mono">{massProgress.sent}</span>
                  {" / "}
                  <span className="font-mono">{massProgress.total}</span>
                  {massProgress.failed > 0 && (
                    <span className="text-destructive ml-2">ошибок: {massProgress.failed}</span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    massProgress.done ? "bg-success" : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((massProgress.sent + massProgress.failed) / Math.max(massProgress.total, 1)) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {dailyRuns.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Дата</th>
                    <th className="py-2 pr-3">Шаблон</th>
                    <th className="py-2 pr-3">Тип</th>
                    <th className="py-2 pr-3">Sent</th>
                    <th className="py-2 pr-3">Fail</th>
                    <th className="py-2 pr-3">Клики</th>
                    <th className="py-2 pr-3">Оплаты</th>
                    <th className="py-2 pr-3">CR%</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRuns.slice(0, 14).map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-mono">{r.run_date ?? "—"}</td>
                      <td className="py-2 pr-3">{r.template_key}</td>
                      <td className="py-2 pr-3">
                        {r.status === "test" ? (
                          <span className="text-warning">тест</span>
                        ) : (
                          r.status
                        )}
                      </td>
                      <td className="py-2 pr-3">{formatNumber(r.sent)}</td>
                      <td className="py-2 pr-3">{formatNumber(r.failed)}</td>
                      <td className="py-2 pr-3">{formatNumber(r.clicks)}</td>
                      <td className="py-2 pr-3">{formatNumber(r.conversions)}</td>
                      <td className="py-2 pr-3">{r.conversion_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
