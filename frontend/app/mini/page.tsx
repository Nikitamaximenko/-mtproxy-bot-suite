"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Snowflake, Shield, Zap, Lock, Copy, Check, ExternalLink, X, RefreshCw } from "lucide-react"
import { getTelegramUser, openTelegramLink } from "@/lib/telegram"

type SubscriptionData = {
  active: boolean
  expires_at?: string | null
  proxy_link?: string | null
}

function FrostIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5L50 95M5 50L95 50M20 20L80 80M80 20L20 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
      <circle cx="50" cy="20" r="4" fill="currentColor" />
      <circle cx="50" cy="80" r="4" fill="currentColor" />
      <circle cx="20" cy="50" r="4" fill="currentColor" />
      <circle cx="80" cy="50" r="4" fill="currentColor" />
      <circle cx="28" cy="28" r="3" fill="currentColor" />
      <circle cx="72" cy="72" r="3" fill="currentColor" />
      <circle cx="72" cy="28" r="3" fill="currentColor" />
      <circle cx="28" cy="72" r="3" fill="currentColor" />
    </svg>
  )
}

function getTgIdFallbackFromUrl(): number | null {
  const tgId = new URLSearchParams(window.location.search).get("tg_id")
  const n = Number(tgId)
  return Number.isFinite(n) && n > 0 ? n : null
}

/* ── Payment Waiting Screen ── */
function PaymentModal({
  url,
  tgId,
  onClose,
  onPaid,
}: {
  url: string
  tgId: number
  onClose: () => void
  onPaid: (sub: SubscriptionData) => void
}) {
  const [checking, setChecking] = useState(false)
  const [opened, setOpened] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkPayment = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch(`/api/subscription?tg_id=${tgId}`, { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as SubscriptionData
      if (data.active) {
        onPaid(data)
      }
    } finally {
      setChecking(false)
    }
  }, [tgId, onPaid])

  useEffect(() => {
    pollRef.current = setInterval(checkPayment, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [checkPayment])

  const handleOpenPayment = () => {
    openTelegramLink(url)
    setOpened(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <FrostIcon className="w-6 h-6 text-primary" />
          <span className="text-sm font-semibold text-foreground">Оплата подписки</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-90 transition-all touch-manipulation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-2xl ice-block-solid flex items-center justify-center frost-glow">
          <Snowflake className="w-10 h-10 text-primary-foreground animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {opened ? "Ожидаем оплату" : "Переход к оплате"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {opened
              ? "Страница оплаты открыта в браузере.\nПосле оплаты вернитесь сюда — статус обновится автоматически."
              : "Сейчас откроется страница оплаты…"}
          </p>
        </div>

        {opened && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Проверяем статус каждые 5 сек…</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-card space-y-2">
        <button
          onClick={checkPayment}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl active:scale-95 transition-all frost-glow touch-manipulation disabled:opacity-60"
        >
          {checking ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {checking ? "Проверяем…" : "Я оплатил"}
        </button>
        <button
          onClick={handleOpenPayment}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground touch-manipulation"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Открыть страницу оплаты
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function MiniAppPage() {
  const tgUser = useMemo(() => getTelegramUser(), [])
  const [tgId, setTgId] = useState<number | null>(tgUser?.id ?? null)
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState("")
  const [paying, setPaying] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    if (!tgId) setTgId(getTgIdFallbackFromUrl())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(async () => {
    if (!tgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/subscription?tg_id=${tgId}`, { cache: "no-store" })
      const data = (await res.json()) as SubscriptionData
      setSub(res.ok ? data : null)
    } finally {
      setLoading(false)
    }
  }, [tgId])

  useEffect(() => { refresh() }, [refresh])

  const isPaid = !!sub?.active
  const proxyLink = sub?.proxy_link ?? null
  const expiresAt = sub?.expires_at ?? null

  const handlePay = async () => {
    if (!email || !tgId) return
    setPaying(true)
    setError(null)
    setErrorDetail(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: String(tgId),
          username: tgUser?.username,
          email,
        }),
      })
      const data = (await res.json()) as { error?: string; payment_url?: string; details?: string }
      if (!res.ok || !data?.payment_url) {
        if (data?.details) setErrorDetail(String(data.details).slice(0, 500))
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      setPaymentUrl(String(data.payment_url))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так")
    } finally {
      setPaying(false)
    }
  }

  const handleCopy = () => {
    if (!proxyLink) return
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePaymentConfirmed = useCallback((data: SubscriptionData) => {
    setSub(data)
    setPaymentUrl(null)
    setJustPaid(true)
  }, [])

  /* ── No tg_id ── */
  if (!tgId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-muted-foreground">
        <div>
          <FrostIcon className="w-16 h-16 text-primary mx-auto mb-4 animate-float" />
          <p className="text-lg">Откройте мини‑апп из Telegram</p>
        </div>
      </div>
    )
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FrostIcon className="w-12 h-12 text-primary animate-float" />
      </div>
    )
  }

  /* ── Payment modal overlay ── */
  const paymentModal = paymentUrl && tgId ? (
    <PaymentModal
      url={paymentUrl}
      tgId={tgId}
      onClose={() => { setPaymentUrl(null); refresh() }}
      onPaid={handlePaymentConfirmed}
    />
  ) : null

  /* ── Active subscription ── */
  if (isPaid) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <FrostIcon className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold text-foreground">Frosty</span>
          </div>

          {/* Success animation on fresh payment */}
          {justPaid && (
            <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-2xl text-center">
              <p className="text-sm font-medium text-foreground">Оплата прошла успешно!</p>
              <p className="text-xs text-muted-foreground mt-1">Подключите прокси ниже</p>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl ice-block-solid flex items-center justify-center mx-auto mb-4 frost-glow">
              <Snowflake className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-5 mx-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Статус</span>
                <span className="flex items-center gap-2 text-sm font-medium text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Активна
                </span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Следующий платёж</span>
                <span className="text-sm font-medium text-foreground">
                  {expiresAt ? new Date(expiresAt).toLocaleDateString("ru-RU") : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Тариф</span>
                <span className="text-sm font-medium text-foreground">299 ₽/мес</span>
              </div>
            </div>
          </div>

          {proxyLink && (
            <div className="bg-card border border-border/50 rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Ваша ссылка на прокси</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground active:scale-95 transition-all touch-manipulation"
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5 text-primary" /><span className="text-primary">Скопировано</span></>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" />Копировать</>
                  )}
                </button>
              </div>
              <div className="bg-secondary rounded-xl p-3 font-mono text-xs text-muted-foreground break-all leading-relaxed">
                {proxyLink}
              </div>
              <button
                onClick={() => openTelegramLink(proxyLink)}
                className="w-full mt-4 flex items-center justify-center gap-2.5 min-h-[52px] px-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl active:scale-95 transition-all frost-glow touch-manipulation"
              >
                <Snowflake className="w-5 h-5" />
                Подключить в Telegram
              </button>
            </div>
          )}

          <div className="bg-card border border-border/50 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Тариф</span>
              <span className="text-sm font-medium text-foreground">299 ₽/мес</span>
            </div>
            {expiresAt && (
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Следующий платёж</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(expiresAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-6">
            {[
              { icon: Shield, text: "Полная безопасность — без логов" },
              { icon: Zap, text: "Работает 24/7 автоматически" },
              { icon: Lock, text: "Не мешает VPN и другим приложениям" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50">
                <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── No subscription — sell ── */
  return (
    <>
      {paymentModal}
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <FrostIcon className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold text-foreground">Frosty</span>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Snowflake className="w-3.5 h-3.5" />
              Telegram без ограничений
            </div>
            <h1 className="text-3xl font-bold text-foreground leading-tight mb-3">
              Заморозьте
              <span className="block frozen-text">все ограничения</span>
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Один клик — и Telegram работает без блокировок.
              <br />Безопасно. Анонимно. Без VPN.
            </p>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {[
              { icon: Zap, title: "Один клик", desc: "Прокси добавляется автоматически" },
              { icon: Shield, title: "Безопасно", desc: "Без логов и отслеживания" },
              { icon: Lock, title: "Без VPN", desc: "Работает независимо от всего" },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border/50">
                <div className="w-11 h-11 flex-shrink-0 rounded-xl ice-block-solid flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-primary/30 rounded-2xl p-5 mb-6">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <span className="text-4xl font-bold frozen-text">299</span>
                <span className="text-base text-muted-foreground ml-1">₽/мес</span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                Выгодно
              </span>
            </div>

            <ul className="space-y-2.5 mb-5">
              {[
                "Telegram на максимальной скорости",
                "Подключение за 10 секунд",
                "Работает автоматически 24/7",
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <label className="text-xs text-muted-foreground mb-1.5 block">Email для чека</label>
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 mb-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />

            <button
              onClick={handlePay}
              disabled={!email || paying}
              className="group relative w-full flex items-center justify-center gap-2.5 min-h-[52px] px-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl transition-all active:scale-95 frost-glow-strong overflow-hidden touch-manipulation disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="absolute inset-0 animate-shimmer opacity-50" />
              <Snowflake className="w-5 h-5 relative z-10" />
              <span className="relative z-10">
                {paying ? "Создаём оплату…" : "ОПЛАТИТЬ 299 ₽"}
              </span>
            </button>

            {error && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-destructive text-center">{error}</p>
                {errorDetail && (
                  <p className="text-[10px] text-muted-foreground text-center break-words px-1">
                    {errorDetail}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Работает сейчас
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Без регистрации
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
