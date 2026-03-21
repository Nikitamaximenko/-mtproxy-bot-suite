"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Manrope } from "next/font/google"
import { Check, Copy, ExternalLink, RefreshCw, X } from "lucide-react"
import { getTelegramUser, openTelegramLink } from "@/lib/telegram"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] })

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

const MINI_TG_STORAGE_KEY = "frosty_mini_tg_id"

function getTgIdFallbackFromUrl(): number | null {
  const tgId = new URLSearchParams(window.location.search).get("tg_id")
  const n = Number(tgId)
  return Number.isFinite(n) && n > 0 ? n : null
}

function readStoredTgId(): number | null {
  if (typeof window === "undefined") return null
  try {
    const s = sessionStorage.getItem(MINI_TG_STORAGE_KEY)
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Если открыли /mini в обычном браузере — запрос ID вместо пустого экрана */
function TgIdFallbackScreen({ onContinue }: { onContinue: (id: number) => void }) {
  const [raw, setRaw] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = () => {
    const n = Number(String(raw).replace(/\s/g, ""))
    if (!Number.isFinite(n) || n < 1) {
      setLocalError("Введите числовой Telegram ID (например 123456789)")
      return
    }
    try {
      sessionStorage.setItem(MINI_TG_STORAGE_KEY, String(n))
    } catch {
      /* ignore */
    }
    try {
      const u = new URL(window.location.href)
      u.searchParams.set("tg_id", String(n))
      window.history.replaceState({}, "", u.toString())
    } catch {
      /* ignore */
    }
    setLocalError(null)
    onContinue(n)
  }

  return (
    <div className={`${manrope.className} min-h-screen flex items-center justify-center px-4 py-10`} style={{ background: "#FFFFFF" }}>
      <div className="w-full max-w-sm space-y-6 text-center">
        <FrostIcon className="w-14 h-14 mx-auto" style={{ color: "#2AABEE" } as React.CSSProperties} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Frosty — оплата</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "#6B7280" }}>
            Из Telegram страница откроется сама. В браузере укажите свой{" "}
            <span className="font-medium" style={{ color: "#111827" }}>Telegram ID</span> — тот же, к которому привяжется подписка.
          </p>
        </div>
        <div className="p-4 text-left space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
          <label className="block text-xs font-medium" style={{ color: "#6B7280" }}>Telegram ID</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Например 591337712"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value)
              setLocalError(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full h-11 px-4 text-sm outline-none transition-all"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              color: "#111827",
            }}
          />
          {localError ? <p className="text-xs" style={{ color: "#EF4444" }}>{localError}</p> : null}
          <button
            type="button"
            onClick={submit}
            className="w-full font-bold touch-manipulation active:scale-[0.98] transition-transform"
            style={{
              background: "#2AABEE",
              color: "#FFFFFF",
              height: "56px",
              borderRadius: "14px",
              fontSize: "17px",
            }}
          >
            Продолжить
          </button>
        </div>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          Как узнать ID: напишите боту{" "}
          <a
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2AABEE" }}
            className="underline underline-offset-2"
          >
            @userinfobot
          </a>
          .
        </p>
      </div>
    </div>
  )
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
  const [opened, setOpened] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleOpenPayment = useCallback(() => {
    openTelegramLink(url)
    setOpened(true)
  }, [url])

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

  return (
    <div className={`${manrope.className} fixed inset-0 z-50 flex flex-col`} style={{ background: "#FFFFFF" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div className="flex items-center gap-2">
          <FrostIcon className="w-5 h-5" style={{ color: "#2AABEE" } as React.CSSProperties} />
          <span className="text-sm font-semibold" style={{ color: "#111827" }}>Оплата подписки</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full touch-manipulation active:scale-90 transition-all"
          style={{ background: "#F7F8FA", color: "#6B7280" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="text-5xl">❄️</div>
        <div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#111827" }}>
            {opened ? "Ожидаем оплату" : "Переход к оплате"}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
            {opened
              ? "Страница оплаты открыта в браузере. После оплаты вернитесь сюда — статус обновится автоматически."
              : "Сейчас откроется страница оплаты…"}
          </p>
        </div>
        {opened && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Проверяем статус каждые 5 сек…</span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid #F3F4F6" }}>
        <button
          type="button"
          onClick={handleOpenPayment}
          className="w-full flex items-center justify-center gap-2 font-bold touch-manipulation active:scale-95 transition-all"
          style={{
            background: "#2AABEE",
            color: "#FFFFFF",
            height: "56px",
            borderRadius: "14px",
            fontSize: "17px",
          }}
        >
          <ExternalLink className="w-4 h-4" />
          Открыть страницу оплаты
        </button>
        <button
          type="button"
          onClick={checkPayment}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 font-medium touch-manipulation active:scale-95 transition-all disabled:opacity-60"
          style={{
            background: "#F7F8FA",
            color: "#374151",
            height: "48px",
            borderRadius: "14px",
            fontSize: "15px",
          }}
        >
          {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {checking ? "Проверяем…" : "Проверить оплату"}
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
  const [emailTouched, setEmailTouched] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payingSBP, setPayingSBP] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [justPaid, setJustPaid] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const showEmailError = emailTouched && email.length > 0 && !isEmailValid

  useEffect(() => {
    if (tgId) return
    const urlId = getTgIdFallbackFromUrl()
    if (urlId) {
      setTgId(urlId)
      return
    }
    const stored = readStoredTgId()
    if (stored) setTgId(stored)
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
      const payUrl = String(data.payment_url)
      openTelegramLink(payUrl)
      setPaymentUrl(payUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так")
    } finally {
      setPaying(false)
    }
  }

  const handlePaySBP = async () => {
    if (!email || !tgId) return
    setPayingSBP(true)
    setError(null)
    setErrorDetail(null)
    try {
      const res = await fetch("/api/checkout-sbp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: String(tgId),
          username: tgUser?.username,
        }),
      })
      const data = (await res.json()) as { error?: string; payment_url?: string }
      if (!res.ok || !data?.payment_url) {
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      const payUrl = String(data.payment_url)
      openTelegramLink(payUrl)
      setPaymentUrl(payUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так")
    } finally {
      setPayingSBP(false)
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

  /* ── No tg_id (браузер без WebApp) ── */
  if (!tgId) {
    return <TgIdFallbackScreen onContinue={setTgId} />
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={`${manrope.className} min-h-screen flex items-center justify-center`} style={{ background: "#FFFFFF" }}>
        <FrostIcon className="w-10 h-10 animate-float" style={{ color: "#2AABEE" } as React.CSSProperties} />
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
      <div className={`${manrope.className} min-h-screen px-4 py-6`} style={{ background: "#FFFFFF" }}>
        <div className="max-w-sm mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <FrostIcon className="w-6 h-6" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="text-base font-bold" style={{ color: "#111827" }}>Frosty</span>
          </div>

          {justPaid && (
            <div className="mb-5 p-4 text-center" style={{ background: "#F0FDF4", borderRadius: "16px" }}>
              <p className="text-sm font-semibold" style={{ color: "#16A34A" }}>✅ Оплата прошла успешно!</p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Подключите прокси ниже</p>
            </div>
          )}

          {/* Status card */}
          <div className="p-5 mb-4" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: "#6B7280" }}>Статус</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#2AABEE" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2AABEE" }} />
                Активна
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: "#6B7280" }}>Следующий платёж</span>
              <span className="text-sm font-medium" style={{ color: "#111827" }}>
                {expiresAt ? new Date(expiresAt).toLocaleDateString("ru-RU") : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "#6B7280" }}>Тариф</span>
              <span className="text-sm font-medium" style={{ color: "#111827" }}>299 ₽/мес</span>
            </div>
          </div>

          {/* Proxy link card */}
          {proxyLink && (
            <div className="p-5 mb-4" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "#111827" }}>Ваша ссылка на прокси</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-medium touch-manipulation active:scale-95 transition-all"
                  style={{ color: copied ? "#2AABEE" : "#6B7280" }}
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5" />Скопировано</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" />Копировать</>
                  )}
                </button>
              </div>
              <div className="p-3 font-mono text-xs break-all leading-relaxed" style={{ background: "#FFFFFF", borderRadius: "10px", color: "#6B7280" }}>
                {proxyLink}
              </div>
              <button
                onClick={() => openTelegramLink(proxyLink)}
                className="w-full mt-4 flex items-center justify-center gap-2 font-bold touch-manipulation active:scale-95 transition-all"
                style={{
                  background: "#2AABEE",
                  color: "#FFFFFF",
                  height: "56px",
                  borderRadius: "14px",
                  fontSize: "17px",
                }}
              >
                Подключить в Telegram
              </button>
            </div>
          )}

          {/* Features */}
          <div className="flex flex-col gap-2">
            {[
              "🔒 Без логов — содержимое сообщений не хранится",
              "⚡ Работает 24/7 автоматически",
              "📡 Не мешает VPN и другим приложениям",
            ].map((text, i) => (
              <div key={i} className="px-4 py-3 text-sm" style={{ background: "#F7F8FA", borderRadius: "12px", color: "#6B7280" }}>
                {text}
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
      <div className={`${manrope.className} min-h-screen px-4 py-6`} style={{ background: "#FFFFFF" }}>
        <div className="max-w-sm mx-auto">

          {/* 1. Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <FrostIcon className="w-6 h-6" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="text-base font-bold" style={{ color: "#111827" }}>Frosty</span>
          </div>

          {/* 2. Heading */}
          <h1 className="text-center font-bold leading-tight mb-3" style={{ fontSize: "32px", color: "#111827" }}>
            Telegram работает.<br />Даже когда заблокирован.
          </h1>

          {/* 3. Subtitle */}
          <p className="text-center mb-8" style={{ fontSize: "16px", fontWeight: 400, color: "#6B7280", lineHeight: "1.5" }}>
            Персональный прокси только для тебя — не общий с тысячами незнакомцев
          </p>

          {/* 4. Features */}
          <div className="flex flex-col gap-3 mb-8">
            {[
              "⚡ Только твой сервер — без очередей и чужих пользователей",
              "🔒 Без VPN — работает прямо в Telegram, ничего не нужно включать",
              "📡 Стабильно 24/7 — мы следим за сервером, ты просто пользуешься",
            ].map((text, i) => (
              <div key={i} className="px-4 py-3.5 text-sm font-medium" style={{ background: "#F7F8FA", borderRadius: "16px", color: "#374151" }}>
                {text}
              </div>
            ))}
          </div>

          {/* 5. Price */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-bold" style={{ fontSize: "40px", color: "#111827" }}>299 ₽</span>
              <span className="text-base" style={{ color: "#6B7280" }}>/мес</span>
            </div>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>= 10 ₽ в день · Отмена в любой момент</p>
          </div>

          {/* Email */}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>Email для чека</label>
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailTouched(true) }}
              onBlur={() => setEmailTouched(true)}
              className="w-full h-11 px-4 text-sm outline-none transition-all"
              style={{
                background: "#F7F8FA",
                border: showEmailError ? "1px solid #EF4444" : "1px solid transparent",
                borderRadius: "12px",
                color: "#111827",
              }}
            />
            {showEmailError && (
              <p className="text-xs mt-1.5" style={{ color: "#EF4444" }}>Введите корректный email (например, you@mail.ru)</p>
            )}
          </div>

          {/* 6. CTA Button */}
          <button
            onClick={() => setShowPayModal(true)}
            disabled={!email || !isEmailValid || paying || payingSBP}
            className="w-full font-bold touch-manipulation active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
            style={{
              background: "#2AABEE",
              color: "#FFFFFF",
              height: "56px",
              borderRadius: "14px",
              fontSize: "17px",
            }}
          >
            Подключить за 299 ₽ →
          </button>

          {error && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-center" style={{ color: "#EF4444" }}>{error}</p>
              {errorDetail && (
                <p className="text-xs text-center break-words px-1" style={{ color: "#6B7280" }}>{errorDetail}</p>
              )}
            </div>
          )}

          {/* 7. Payment note */}
          <p className="text-center text-xs mt-3" style={{ color: "#6B7280" }}>
            Оплата картой или СБП через Lava
          </p>
          <p className="text-center text-xs mt-1" style={{ color: "#6B7280" }}>
            Отмена в любой момент — напишите в поддержку
          </p>

          {/* Payment method modal */}
          {showPayModal && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => setShowPayModal(false)}
            >
              <div
                className="w-full max-w-sm px-4 pb-8 pt-6"
                style={{ background: "#FFFFFF", borderRadius: "20px 20px 0 0" }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-center text-base font-semibold mb-5" style={{ color: "#111827" }}>
                  Как хотите оплатить?
                </p>
                <button
                  onClick={() => { setShowPayModal(false); void handlePay() }}
                  disabled={paying}
                  className="w-full font-bold touch-manipulation active:scale-[0.98] transition-transform disabled:opacity-50"
                  style={{
                    background: "#2AABEE",
                    color: "#FFFFFF",
                    height: "52px",
                    borderRadius: "14px",
                    fontSize: "16px",
                    marginBottom: "10px",
                  }}
                >
                  {paying ? "Создаём оплату…" : "Картой / СБП с автопродлением"}
                </button>
                <button
                  onClick={() => { setShowPayModal(false); void handlePaySBP() }}
                  disabled={payingSBP}
                  className="w-full font-medium touch-manipulation active:scale-[0.98] transition-transform disabled:opacity-50"
                  style={{
                    background: "#F7F8FA",
                    color: "#374151",
                    height: "52px",
                    borderRadius: "14px",
                    fontSize: "16px",
                    border: "1px solid #E5E7EB",
                    marginBottom: "12px",
                  }}
                >
                  {payingSBP ? "Создаём оплату…" : "СБП / Перевод через банк"}
                </button>
                <button
                  onClick={() => setShowPayModal(false)}
                  className="w-full text-sm touch-manipulation"
                  style={{ color: "#6B7280" }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
