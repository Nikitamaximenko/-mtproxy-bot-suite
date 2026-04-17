"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Manrope } from "next/font/google"
import { Check, Copy, ExternalLink, RefreshCw, Shield, X } from "lucide-react"
import { getTelegramUser, openTelegramLink } from "@/lib/telegram"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] })

/** Второй поток оплаты (Prodamus / СБП). По умолчанию скрыт — см. NEXT_PUBLIC_ENABLE_PRODAMUS_CHECKOUT и backend ENABLE_PRODAMUS_CHECKOUT. */
const ENABLE_PRODAMUS_SBP = process.env.NEXT_PUBLIC_ENABLE_PRODAMUS_CHECKOUT === "true"

type SubscriptionData = {
  active: boolean
  expires_at?: string | null
  proxy_link?: string | null
  suspended?: boolean
}

type VpnData = {
  available: boolean
  reason?: string | null
  vless_link: string | null
  uuid: string | null
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

const WEB_EMAIL_KEY = "frosty_email"

function readStoredEmail(): string | null {
  try { return localStorage.getItem(WEB_EMAIL_KEY) ?? null } catch { return null }
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
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [justPaid, setJustPaid] = useState(false)
  const [isWeb, setIsWeb] = useState<boolean | null>(null)
  const [webEmail, setWebEmail] = useState<string | null>(null)

  // VPN state
  const [activeTab, setActiveTab] = useState<"proxy" | "vpn">("proxy")
  const [vpn, setVpn] = useState<VpnData | null>(null)
  const [vpnLoading, setVpnLoading] = useState(false)
  const [vpnLinkCopied, setVpnLinkCopied] = useState(false)


  // VPN server ping
  const [vpnPing, setVpnPing] = useState<{ online: boolean; latency_ms: number | null } | null>(null)

  useEffect(() => {
    const checkPing = async () => {
      try {
        const r = await fetch("/api/vpn-ping")
        const d = await r.json() as { online: boolean; latency_ms: number | null }
        setVpnPing(d)
      } catch {
        setVpnPing({ online: false, latency_ms: null })
      }
    }
    checkPing()
    const interval = setInterval(checkPing, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Сигналим Telegram'у, что WebApp готов — он скрывает splash и красит
    // header под Mini App. Без ready() у пользователя ещё 300-800ms висит
    // серый экран, пока Telegram сам не решит что всё ок.
    try {
      window?.Telegram?.WebApp?.ready?.()
      window?.Telegram?.WebApp?.expand?.()
    } catch {
      /* ignore: SDK может ещё не подгрузиться — это не фатально */
    }

    const params = new URLSearchParams(window.location.search)
    const hasTgIdInUrl = params.has("tg_id")
    const hasTgWebApp = !!(window?.Telegram?.WebApp?.version)
    const inTelegram = hasTgIdInUrl || hasTgWebApp
    setIsWeb(!inTelegram)
  }, [])

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const showEmailError = emailTouched && email.length > 0 && !isEmailValid

  useEffect(() => {
    if (tgId) return
    const urlId = getTgIdFallbackFromUrl()
    if (urlId) { setTgId(urlId); return }
    const stored = readStoredTgId()
    if (stored) setTgId(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(async () => {
    // Case 1: Telegram user — look up by tg_id
    if (tgId) {
      setLoading(true)
      try {
        const res = await fetch(`/api/subscription?tg_id=${tgId}`, { cache: "no-store" })
        const data = (await res.json()) as SubscriptionData
        setSub(res.ok ? data : null)
      } finally {
        setLoading(false)
      }
      return
    }

    // Case 2: Web user returning — check localStorage email
    const storedEmail = readStoredEmail()
    if (storedEmail) {
      setWebEmail(storedEmail)
      setLoading(true)
      try {
        const res = await fetch(`/api/subscription?email=${encodeURIComponent(storedEmail)}`, { cache: "no-store" })
        const data = (await res.json()) as SubscriptionData
        if (res.ok && data?.active) {
          setSub(data)
          setLoading(false)
          return
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }

    setLoading(false)
  }, [tgId])

  useEffect(() => { void refresh() }, [refresh])

  const fetchVpn = useCallback(async () => {
    if (!tgId) return
    setVpnLoading(true)
    try {
      const res = await fetch(`/api/vpn?tg_id=${tgId}`, { cache: "no-store" })
      if (res.ok) setVpn((await res.json()) as VpnData)
    } finally {
      setVpnLoading(false)
    }
  }, [tgId])

  useEffect(() => {
    if (activeTab === "vpn" && !vpn && tgId) void fetchVpn()
  }, [activeTab, vpn, tgId, fetchVpn])

  const handleCopyVlessLink = () => {
    if (!vpn?.vless_link) return
    navigator.clipboard.writeText(vpn.vless_link)
    setVpnLinkCopied(true)
    setTimeout(() => setVpnLinkCopied(false), 2000)
  }

  const isPaid = !!sub?.active
  const proxyLink = sub?.proxy_link ?? null
  const expiresAt = sub?.expires_at ?? null
  const suspendedButPaid = !!sub?.suspended && !!sub?.expires_at && !sub?.active

  const handlePay = async () => {
    if (!email || (!isWeb && !tgId)) return
    setPaying(true)
    setError(null)
    setErrorDetail(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: tgId ? String(tgId) : "0",
          username: tgUser?.username || null,
          customer_email: email,
        }),
      })
      const data = (await res.json()) as { error?: string; payment_url?: string; details?: string }
      if (!res.ok || !data?.payment_url) {
        if (data?.details) setErrorDetail(String(data.details).slice(0, 500))
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      const payUrl = String(data.payment_url)
      if (isWeb) {
        localStorage.setItem("frosty_email", email)
        window.location.href = payUrl
        return
      }
      openTelegramLink(payUrl)
      setPaymentUrl(payUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так")
    } finally {
      setPaying(false)
    }
  }

  const handlePaySBP = async () => {
    if (!email || (!isWeb && !tgId)) return
    setPayingSBP(true)
    setError(null)
    setErrorDetail(null)
    try {
      const res = await fetch("/api/checkout-sbp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: tgId ? String(tgId) : "0",
          username: tgUser?.username || null,
          customer_email: email,
        }),
      })
      const data = (await res.json()) as { error?: string; payment_url?: string }
      if (!res.ok || !data?.payment_url) {
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      const payUrl = String(data.payment_url)
      if (isWeb) {
        localStorage.setItem("frosty_email", email)
        window.location.href = payUrl
        return
      }
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

  /* ── Loader на самом первом рендере ──
     Без этого guard'а было так: при первом рендере isWeb === null, tgId === null,
     sub === null, loading === true → JSX ниже рендерил продажный экран, хотя мы
     на самом деле ещё не успели понять, Telegram это юзер или браузер. Пользователи
     с активной подпиской ловили «мигание» продажного экрана, а при медленной сети
     видели его дольше и думали что мини-апп «их не узнал».

     Теперь показываем лоадер, пока:
       — isWeb ещё не определён (useEffect не отработал), ИЛИ
       — мы в Telegram-контексте (isWeb === false) и подписка ещё не загружена. */
  if (isWeb === null || (isWeb === false && loading && sub === null)) {
    return (
      <div className={`${manrope.className} min-h-screen flex items-center justify-center`} style={{ background: "#FFFFFF" }}>
        <FrostIcon className="w-10 h-10 animate-float" style={{ color: "#2AABEE" } as React.CSSProperties} />
      </div>
    )
  }

  /* ── Браузер без tg_id (не из Telegram) — запрашиваем ID ── */
  if (isWeb === false && !tgId) {
    return <TgIdFallbackScreen onContinue={setTgId} />
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
          <div className="flex items-center justify-center gap-2 mb-6">
            <FrostIcon className="w-6 h-6" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="text-base font-bold" style={{ color: "#111827" }}>Frosty</span>
          </div>

          {justPaid && (
            <div className="mb-5 p-4 text-center" style={{ background: "#F0FDF4", borderRadius: "16px" }}>
              <p className="text-sm font-semibold" style={{ color: "#16A34A" }}>✅ Оплата прошла успешно!</p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Подключите прокси и VPN ниже</p>
            </div>
          )}

          {/* Status card */}
          <div className="p-4 mb-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: "#111827" }}>Подписка 2 в 1</span>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Прокси для Telegram + VPN для всего</p>
              </div>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#16A34A" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#16A34A" }} />
                Активна
              </span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB", margin: "12px 0" }} />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: "#6B7280" }}>Действует до</span>
              <span className="text-xs font-semibold" style={{ color: "#111827" }}>
                {expiresAt ? new Date(expiresAt).toLocaleDateString("ru-RU") : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#6B7280" }}>Тариф</span>
              <span className="text-xs font-semibold" style={{ color: "#111827" }}>299 ₽/мес</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mb-5 p-1" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
            {(["proxy", "vpn"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-sm font-semibold touch-manipulation transition-all"
                style={{
                  borderRadius: "11px",
                  background: activeTab === tab ? "#FFFFFF" : "transparent",
                  color: activeTab === tab ? "#111827" : "#6B7280",
                  boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {tab === "proxy" ? "📡 Telegram" : "🛡 VPN"}
              </button>
            ))}
          </div>

          {/* ── Proxy tab ── */}
          {activeTab === "proxy" && (
            <div className="space-y-3">
              <div className="px-1 mb-1">
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  MTProxy снимает блокировку прямо внутри Telegram — без дополнительных приложений. Включается в один клик.
                </p>
              </div>
              {proxyLink ? (
                <div className="p-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ color: "#111827" }}>Ваша ссылка на прокси</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs font-medium touch-manipulation active:scale-95 transition-all"
                      style={{ color: copied ? "#2AABEE" : "#6B7280" }}
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" />Скопировано</> : <><Copy className="w-3.5 h-3.5" />Копировать</>}
                    </button>
                  </div>
                  <div className="p-3 font-mono text-xs break-all leading-relaxed" style={{ background: "#FFFFFF", borderRadius: "10px", color: "#6B7280" }}>
                    {proxyLink}
                  </div>
                  <button
                    onClick={() => openTelegramLink(proxyLink)}
                    className="w-full mt-4 flex items-center justify-center gap-2 font-bold touch-manipulation active:scale-95 transition-all"
                    style={{ background: "#2AABEE", color: "#FFFFFF", height: "56px", borderRadius: "14px", fontSize: "17px" }}
                  >
                    Подключить в Telegram
                  </button>
                </div>
              ) : (
                <div className="p-5 text-center space-y-2" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <p className="text-sm font-semibold" style={{ color: "#111827" }}>Ссылка временно недоступна здесь</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    Откройте бота и нажмите <strong style={{ color: "#2AABEE" }}>«✅ Статус»</strong> — там вашу персональную ссылку на прокси всегда можно скопировать и подключить одним кликом.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {[
                  "⚡ Работает только внутри Telegram — не затрагивает другие приложения",
                  "🔒 Без логов — мы не видим содержимое сообщений",
                  "📡 Персональный сервер — не делишь скорость с чужими",
                ].map((t, i) => (
                  <div key={i} className="px-4 py-3 text-sm" style={{ background: "#F7F8FA", borderRadius: "12px", color: "#6B7280" }}>{t}</div>
                ))}
              </div>
              <div className="px-1 pt-1">
                <p className="text-xs" style={{ color: "#9CA3AF" }}>
                  Нужен доступ к Instagram, TikTok, YouTube? Переключитесь на вкладку <strong style={{ color: "#6B7280" }}>VPN</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── VPN tab ── */}
          {activeTab === "vpn" && (
            <div className="space-y-4">
              <div className="px-1 mb-1">
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  VLESS Reality VPN открывает доступ к любым заблокированным сайтам — Instagram, TikTok, YouTube и всему остальному. Работает через приложение Happ.
                </p>
              </div>

              {vpnLoading && !vpn ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#2AABEE" }} />
                </div>
              ) : !vpn?.available ? (
                <div className="p-6 text-center space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <div className="text-3xl">🚧</div>
                  <p className="text-sm font-semibold" style={{ color: "#111827" }}>VPN скоро появится</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    Разворачиваем сервер. Появится здесь автоматически — обновления не нужны.
                  </p>
                </div>
              ) : !vpn.vless_link ? (
                <div className="p-6 text-center space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <div className="text-3xl">⚙️</div>
                  <p className="text-sm font-semibold" style={{ color: "#111827" }}>Создаём конфигурацию…</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    Попробуйте обновить через пару секунд.
                  </p>
                  <button
                    onClick={() => { setVpn(null); void fetchVpn() }}
                    className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold touch-manipulation"
                    style={{ color: "#2AABEE" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Обновить
                  </button>
                </div>
              ) : (
                <>
                  {/* Server + protocol info */}
                  <div className="p-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇫🇮</span>
                        <div>
                          <p className="text-xs" style={{ color: "#6B7280" }}>Сервер</p>
                          <p className="text-sm font-semibold" style={{ color: "#111827" }}>Finland</p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 font-semibold" style={{ background: "#F0FDF4", color: "#16A34A", borderRadius: "8px" }}>
                        VLESS Reality
                      </span>
                    </div>
                    <div style={{ height: "1px", background: "#E5E7EB", marginBottom: "12px" }} />
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 flex-shrink-0" style={{ color: "#2AABEE" }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#111827" }}>Конфигурация готова</p>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Подключитесь через Happ или другое VLESS-приложение</p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openTelegramLink(`happ://import/${encodeURIComponent(vpn.vless_link!)}`)}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                      style={{ background: "#2AABEE", color: "#FFFFFF", height: "52px", borderRadius: "14px" }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Открыть в Happ
                    </button>
                    <button
                      onClick={handleCopyVlessLink}
                      className="flex items-center justify-center gap-1.5 text-sm font-semibold touch-manipulation active:scale-95 transition-all px-4"
                      style={{ background: vpnLinkCopied ? "#F0FDF4" : "#F7F8FA", color: vpnLinkCopied ? "#16A34A" : "#374151", height: "52px", borderRadius: "14px", border: "1px solid #E5E7EB", minWidth: "100px" }}
                    >
                      {vpnLinkCopied ? <><Check className="w-4 h-4" />Скопировано</> : <><Copy className="w-4 h-4" />Скопировать</>}
                    </button>
                  </div>

                  {/* QR code via external API */}
                  <div className="p-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#111827" }}>QR-код для подключения</p>
                    <p className="text-xs mb-4" style={{ color: "#6B7280" }}>Сканируйте из Happ: «+» → «Сканировать QR»</p>
                    <div
                      className="mx-auto flex items-center justify-center p-3"
                      style={{ background: "#FFFFFF", borderRadius: "16px", maxWidth: "220px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(vpn.vless_link)}`}
                        alt="QR код VPN"
                        width={192}
                        height={192}
                        style={{ display: "block", borderRadius: "8px" }}
                      />
                    </div>
                  </div>

                  {/* Step-by-step instructions */}
                  <div style={{ background: "#F7F8FA", borderRadius: "16px", padding: "20px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "16px" }}>
                      Как подключить VPN:
                    </p>

                    <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#2AABEE", color: "white", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>Скачайте Happ</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <a href="https://play.google.com/store/apps/details?id=com.happ.vpn" target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#2AABEE", textDecoration: "none" }}>📥 Android</a>
                          <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215" target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#2AABEE", textDecoration: "none" }}>📥 iOS</a>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#2AABEE", color: "white", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>Скопируйте ссылку</p>
                        <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>Нажмите «Скопировать» выше</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#2AABEE", color: "white", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>Вставьте в Happ</p>
                        <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>«+» → «Из буфера обмена» → Подключить</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#10B981", color: "white", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#10B981", margin: "0 0 4px" }}>Готово — нажмите «Подключить» в Happ</p>
                        <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>VPN включится за 5 секунд</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

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

          {suspendedButPaid && expiresAt && (
            <div
              className="mb-5 px-4 py-3 text-center text-sm rounded-2xl"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              Доступ к прокси приостановлен вручную. Оплаченный период до{" "}
              <strong>{new Date(expiresAt).toLocaleDateString("ru-RU")}</strong>.
            </div>
          )}

          {/* 2. Badge */}
          <div className="flex justify-center mb-4">
            <span className="text-xs font-bold px-3 py-1.5 tracking-wide" style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: "20px" }}>
              2 В 1 — ПРОКСИ + VPN
            </span>
          </div>

          {/* 3. Heading */}
          <h1 className="text-center font-bold leading-tight mb-3" style={{ fontSize: "30px", color: "#111827" }}>
            Работает всё — Telegram,<br />Instagram, TikTok и другие.
          </h1>

          {/* 4. Subtitle */}
          <p className="text-center mb-7" style={{ fontSize: "15px", fontWeight: 400, color: "#6B7280", lineHeight: "1.6" }}>
            Одна подписка решает сразу обе проблемы: прокси включает Telegram без лишних действий, а VPN открывает всё остальное.
          </p>

          {/* 5. Features — две колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-4" style={{ background: "#F0F9FF", borderRadius: "16px", border: "1px solid #BAE6FD" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "#0284C7" }}>📡 MTProxy</p>
              <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>Telegram работает сразу — без дополнительных приложений</p>
            </div>
            <div className="p-4" style={{ background: "#F0FDF4", borderRadius: "16px", border: "1px solid #BBF7D0" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "#16A34A" }}>🛡 VPN</p>
              <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>Instagram, TikTok, YouTube — любые сайты без ограничений</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-7">
            {[
              "⚡ Персональный сервер — скорость не делишь с чужими",
              "🔒 Без логов — мы не видим, что ты делаешь в сети",
              "📲 Настройка за 2 минуты — подробная инструкция внутри",
            ].map((text, i) => (
              <div key={i} className="px-4 py-3 text-sm font-medium" style={{ background: "#F7F8FA", borderRadius: "14px", color: "#374151" }}>
                {text}
              </div>
            ))}
          </div>

          {/* 6. Price */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-bold" style={{ fontSize: "40px", color: "#111827" }}>299 ₽</span>
              <span className="text-base" style={{ color: "#6B7280" }}>/мес</span>
            </div>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>= 10 ₽ в день · Прокси + VPN · Отмена в любой момент</p>
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

          {/* VPN server ping */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "#F7F8FA", borderRadius: "10px",
            padding: "8px 14px", marginBottom: "16px",
            fontSize: "13px", color: "#6B7280",
          }}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: vpnPing?.online ? "#10B981" : "#9CA3AF",
              display: "inline-block", flexShrink: 0,
            }} />
            {vpnPing === null
              ? "Проверяем сервер..."
              : vpnPing.online
                ? `🇫🇮 Финляндия · ${vpnPing.latency_ms} мс · Онлайн`
                : "Сервер недоступен"
            }
          </div>

          {/* 6. CTA Button */}
          <button
            onClick={() => {
              if (isWeb === true) void handlePaySBP()
              else void handlePay()
            }}
            disabled={!email || !isEmailValid || paying || (isWeb === true && payingSBP)}
            className="w-full font-bold touch-manipulation active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
            style={{
              background: "#2AABEE",
              color: "#FFFFFF",
              height: "56px",
              borderRadius: "14px",
              fontSize: "17px",
            }}
          >
            Получить Прокси + VPN за 299 ₽ →
          </button>

          {error && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-center" style={{ color: "#EF4444" }}>{error}</p>
              {errorDetail && (
                <p className="text-xs text-center break-words px-1" style={{ color: "#6B7280" }}>{errorDetail}</p>
              )}
            </div>
          )}

          {/* Payment note */}
          <p className="text-center text-xs mt-3" style={{ color: "#6B7280" }}>
            Оплата картой или СБП · Прокси включается сразу · VPN — после установки приложения
          </p>
          <p className="text-center text-xs mt-1" style={{ color: "#9CA3AF" }}>
            Отмена в любой момент — напишите в поддержку
          </p>

        </div>
      </div>
    </>
  )
}
