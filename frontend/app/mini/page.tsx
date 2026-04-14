"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Manrope } from "next/font/google"
import { Check, Copy, Download, ExternalLink, RefreshCw, Shield, ShieldOff, X } from "lucide-react"
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
  enabled: boolean
  location: string
  config: string | null
  qr_svg: string | null
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
  const [vpnToggling, setVpnToggling] = useState(false)
  const [vpnConfigCopied, setVpnConfigCopied] = useState(false)

  useEffect(() => {
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

  const handleVpnToggle = async () => {
    if (!tgId || vpnToggling) return
    const next = !vpn?.enabled
    setVpnToggling(true)
    try {
      const res = await fetch(`/api/vpn?tg_id=${tgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      if (res.ok) {
        // Reload full status to get fresh config/QR
        await fetchVpn()
      }
    } finally {
      setVpnToggling(false)
    }
  }

  const handleDownloadConfig = () => {
    if (!vpn?.config) return
    const blob = new Blob([vpn.config], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "frosty-vpn.conf"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyConfig = () => {
    if (!vpn?.config) return
    navigator.clipboard.writeText(vpn.config)
    setVpnConfigCopied(true)
    setTimeout(() => setVpnConfigCopied(false), 2000)
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

  /* ── No tg_id (браузер без WebApp) ── */
  if (isWeb === false && !tgId) {
    return <TgIdFallbackScreen onContinue={setTgId} />
  }

  /* ── Loading ── */
  if (isWeb === false && loading) {
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
          <div className="flex items-center justify-center gap-2 mb-6">
            <FrostIcon className="w-6 h-6" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="text-base font-bold" style={{ color: "#111827" }}>Frosty</span>
          </div>

          {justPaid && (
            <div className="mb-5 p-4 text-center" style={{ background: "#F0FDF4", borderRadius: "16px" }}>
              <p className="text-sm font-semibold" style={{ color: "#16A34A" }}>✅ Оплата прошла успешно!</p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Подключитесь ниже</p>
            </div>
          )}

          {/* Status card */}
          <div className="p-4 mb-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "#6B7280" }}>Статус</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#2AABEE" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2AABEE" }} />
                Активна
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
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
                {tab === "proxy" ? "📡 MTProxy" : "🛡 VPN"}
              </button>
            ))}
          </div>

          {/* ── Proxy tab ── */}
          {activeTab === "proxy" && (
            <div className="space-y-3">
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
                <div className="p-5 text-center" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <p className="text-sm" style={{ color: "#6B7280" }}>Прокси настраивается, скоро появится</p>
                </div>
              )}
              <div className="flex flex-col gap-2 mt-2">
                {["🔒 Без логов — содержимое сообщений не хранится", "⚡ Работает 24/7 автоматически", "📡 Не мешает VPN и другим приложениям"].map((t, i) => (
                  <div key={i} className="px-4 py-3 text-sm" style={{ background: "#F7F8FA", borderRadius: "12px", color: "#6B7280" }}>{t}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── VPN tab ── */}
          {activeTab === "vpn" && (
            <div className="space-y-4">
              {vpnLoading && !vpn ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#2AABEE" }} />
                </div>
              ) : !vpn?.available ? (
                /* VPN not configured yet — coming soon card */
                <div className="p-6 text-center space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <div className="text-3xl">🚧</div>
                  <p className="text-sm font-semibold" style={{ color: "#111827" }}>VPN скоро появится</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    Мы разворачиваем сервер. Как только будет готово — появится здесь автоматически.
                  </p>
                </div>
              ) : (
                <>
                  {/* Location badge */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
                    <span className="text-sm" style={{ color: "#6B7280" }}>Сервер</span>
                    <span className="text-sm font-semibold" style={{ color: "#111827" }}>🌍 {vpn.location}</span>
                  </div>

                  {/* Toggle */}
                  <div className="p-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {vpn.enabled
                          ? <Shield className="w-5 h-5" style={{ color: "#2AABEE" }} />
                          : <ShieldOff className="w-5 h-5" style={{ color: "#9CA3AF" }} />
                        }
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#111827" }}>
                            {vpn.enabled ? "VPN включён" : "VPN выключен"}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                            {vpn.enabled ? "Конфиг активен на сервере" : "Трафик не проходит через VPN"}
                          </p>
                        </div>
                      </div>
                      {/* Toggle switch */}
                      <button
                        onClick={handleVpnToggle}
                        disabled={vpnToggling}
                        className="relative touch-manipulation disabled:opacity-60 transition-opacity"
                        style={{ width: "51px", height: "31px" }}
                        aria-label="Toggle VPN"
                      >
                        <span
                          className="block w-full h-full transition-colors duration-200"
                          style={{
                            borderRadius: "15.5px",
                            background: vpn.enabled ? "#2AABEE" : "#D1D5DB",
                          }}
                        />
                        <span
                          className="absolute top-0.5 transition-all duration-200"
                          style={{
                            left: vpn.enabled ? "calc(100% - 27px)" : "2px",
                            width: "27px",
                            height: "27px",
                            borderRadius: "50%",
                            background: "#FFFFFF",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                          }}
                        >
                          {vpnToggling && (
                            <RefreshCw className="w-3 h-3 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                          )}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Config & QR (only when enabled) */}
                  {vpn.enabled && (
                    <>
                      {/* QR code */}
                      {vpn.qr_svg && (
                        <div className="p-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                          <p className="text-sm font-medium mb-3" style={{ color: "#111827" }}>QR-код для Amnezia / WireGuard</p>
                          <div
                            className="mx-auto p-3 flex items-center justify-center"
                            style={{ background: "#FFFFFF", borderRadius: "12px", maxWidth: "220px" }}
                            dangerouslySetInnerHTML={{ __html: vpn.qr_svg }}
                          />
                          <p className="text-xs text-center mt-3" style={{ color: "#6B7280" }}>
                            Откройте Amnezia → «+» → «Сканировать QR»
                          </p>
                        </div>
                      )}

                      {/* Config actions */}
                      {vpn.config && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleDownloadConfig}
                            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                            style={{ background: "#2AABEE", color: "#FFFFFF", height: "48px", borderRadius: "12px" }}
                          >
                            <Download className="w-4 h-4" />
                            Скачать .conf
                          </button>
                          <button
                            onClick={handleCopyConfig}
                            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                            style={{ background: "#F7F8FA", color: vpnConfigCopied ? "#2AABEE" : "#374151", height: "48px", borderRadius: "12px" }}
                          >
                            {vpnConfigCopied ? <><Check className="w-4 h-4" />Скопировано</> : <><Copy className="w-4 h-4" />Копировать</>}
                          </button>
                        </div>
                      )}

                      {/* Setup instructions */}
                      <div className="p-4 space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Как подключить</p>
                        {[
                          { n: "1", t: "Скачайте Amnezia VPN", s: "App Store / Google Play — бесплатно" },
                          { n: "2", t: "Нажмите «+» → «Сканировать QR»", s: "Или «Импортировать из файла» (.conf)" },
                          { n: "3", t: "Нажмите «Подключить»", s: "VPN включится за секунду" },
                        ].map(({ n, t, s }) => (
                          <div key={n} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#2AABEE", color: "#FFF" }}>{n}</span>
                            <div>
                              <p className="text-sm font-medium" style={{ color: "#111827" }}>{t}</p>
                              <p className="text-xs" style={{ color: "#6B7280" }}>{s}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
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

        </div>
      </div>
    </>
  )
}
