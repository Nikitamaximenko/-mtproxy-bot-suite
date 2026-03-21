"use client"

import { useCallback, useEffect, useState } from "react"

type RefStat = {
  source: string
  count: number
}

type Stats = {
  total_users: number
  marketing_opt_out_users: number
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
  username?: string | null
  payment_status: string
  expires_at: string | null
  created_at: string
  has_proxy: boolean
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

/** Доступ как в API: paid и срок в будущем */
function isSubAccessActive(s: SubInfo): boolean {
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

export default function AdminPage() {
  const [key, setKey] = useState("")
  const [authed, setAuthed] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [proxy, setProxy] = useState<ProxyStatus | null>(null)
  const [overview, setOverview] = useState<UsersOverview | null>(null)
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
  } | null>(null)
  const [buttonEnabled, setButtonEnabled] = useState(false)
  const [buttonText, setButtonText] = useState("")
  const [buttonUrl, setButtonUrl] = useState("")
  const ADMIN_TG_ID = 231115635

  const broadcastRecipientEstimate =
    stats == null
      ? null
      : includeOptedOut
        ? stats.total_users
        : Math.max(0, stats.total_users - stats.marketing_opt_out_users)

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
        const [sRes, pRes, ovRes] = await Promise.all([
          fetch("/api/admin/stats", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/proxy-status", { headers: headers(activeKey), cache: "no-store" }),
          fetch("/api/admin/users-overview", { headers: headers(activeKey), cache: "no-store" }),
        ])

        if (sRes.status === 403 || ovRes.status === 403) {
          setAuthed(false)
          setOverview(null)
          setError("Неверный ключ")
          try {
            localStorage.removeItem(STORAGE_KEY)
          } catch {
            /* ignore */
          }
          return
        }

        const [sData, pData, ovData] = await Promise.all([sRes.json(), pRes.json(), ovRes.json()])
        const rawStats = sData as Stats & { marketing_opt_out_users?: number }
        setStats({
          ...rawStats,
          marketing_opt_out_users: rawStats.marketing_opt_out_users ?? 0,
        })
        setProxy(pData)
        setOverview(ovData as UsersOverview)
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

    setBroadcastBusy(true)
    setBroadcastResult(null)
    setError("")
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
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
        detail?: string
        total?: number
        sent?: number
        failed?: number
      }
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : `Ошибка ${res.status}`)
      }
      if (
        typeof data.total !== "number" ||
        typeof data.sent !== "number" ||
        typeof data.failed !== "number"
      ) {
        throw new Error("Некорректный ответ сервера")
      }
      setBroadcastResult({ total: data.total, sent: data.sent, failed: data.failed })
      setBroadcastText("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить рассылку")
    } finally {
      setBroadcastBusy(false)
    }
  }, [
    broadcastRecipientEstimate,
    broadcastText,
    buttonEnabled,
    buttonText,
    buttonUrl,
    headers,
    includeOptedOut,
  ])

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
    setStats(null)
    setProxy(null)
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
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
      </header>

      {error ? <p className="text-center text-red-400 text-sm py-2">{error}</p> : null}

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Прокси-сервер</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            {proxy ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${proxy.online ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`}
                  />
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

        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Аналитика</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Пользователей", value: stats?.total_users ?? "—", color: "text-blue-400" },
              {
                label: "В таблице users",
                value: overview?.users_table_total ?? "—",
                color: "text-cyan-400",
              },
              { label: "Активных подписок", value: stats?.active_subscriptions ?? "—", color: "text-emerald-400" },
              { label: "Истекших", value: stats?.expired_subscriptions ?? "—", color: "text-orange-400" },
              { label: "Ожидают оплату", value: stats?.pending_payments ?? "—", color: "text-yellow-400" },
              {
                label: "Выручка (≈)",
                value: stats ? `${stats.revenue_estimate.toLocaleString("ru-RU")} ₽` : "—",
                color: "text-green-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </section>

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
                  placeholder="URL кнопки, напр. https://t.me/FrostyBot"
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder:text-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm disabled:opacity-60"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
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
                {broadcastBusy ? "Отправка…" : "Отправить рассылку"}
              </button>
              {broadcastResult ? (
                <span className="text-sm text-gray-400">
                  Готово: отправлено <strong className="text-emerald-400">{broadcastResult.sent}</strong> из{" "}
                  <strong className="text-white">{broadcastResult.total}</strong>
                  {broadcastResult.failed > 0 ? (
                    <>
                      , ошибок:{" "}
                      <strong className="text-red-400">{broadcastResult.failed}</strong>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
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
              Тумблер <strong>Доступ</strong>: вкл — ручная активация (+30 дней), выкл — отзыв (как /admin/deactivate).
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
                      <th className="px-4 py-3 font-medium text-right">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => {
                      const accessOn = isSubAccessActive(s)
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
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
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
