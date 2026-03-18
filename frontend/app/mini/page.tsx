"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Snowflake, Shield, Zap, Lock, Copy, Check, ExternalLink } from "lucide-react"
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

export default function MiniAppPage() {
  const tgUser = useMemo(() => getTelegramUser(), [])
  const [tgId, setTgId] = useState<number | null>(tgUser?.id ?? null)
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState("")
  const [paying, setPaying] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: tgId, username: tgUser?.username, email }),
      })
      const data = await res.json()
      if (!res.ok || !data?.payment_url) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FrostIcon className="w-12 h-12 text-primary animate-float" />
      </div>
    )
  }

  if (paymentUrl) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <FrostIcon className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold text-foreground">Frosty</span>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <iframe title="Оплата" src={paymentUrl} className="w-full h-[75vh] bg-background" />
          </div>
          <button
            onClick={() => openTelegramLink(paymentUrl)}
            className="w-full mt-3 flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 text-sm font-medium bg-secondary text-secondary-foreground rounded-xl active:scale-95 transition-all touch-manipulation"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть в браузере
          </button>
          <button
            onClick={() => { setPaymentUrl(null); refresh() }}
            className="w-full mt-2 py-3 text-sm text-muted-foreground touch-manipulation"
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  /* ── Active subscription ── */
  if (isPaid) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-sm mx-auto">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-8">
            <FrostIcon className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold text-foreground">Frosty</span>
          </div>

          {/* Status */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl ice-block-solid flex items-center justify-center mx-auto mb-4 frost-glow">
              <Snowflake className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Подписка активна</h1>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Ограничения заморожены</span>
            </div>
          </div>

          {/* Proxy link card */}
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

          {/* Subscription info */}
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

          {/* Features reminder */}
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
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <FrostIcon className="w-8 h-8 text-primary" />
          <span className="text-lg font-bold text-foreground">Frosty</span>
        </div>

        {/* Hero */}
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

        {/* Features */}
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

        {/* Price card + form */}
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

          {/* Email */}
          <label className="text-xs text-muted-foreground mb-1.5 block">Email для чека</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 mb-4 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />

          {/* CTA */}
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
            <p className="text-xs text-destructive text-center mt-3">{error}</p>
          )}
        </div>

        {/* Trust */}
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
  )
}
