"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Manrope } from "next/font/google"
import { Check, Copy, ExternalLink, RefreshCw, Shield, X } from "lucide-react"
import { getTelegramUser, openTelegramLink } from "@/lib/telegram"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] })

/** Второй поток оплаты (Prodamus / СБП). По умолчанию скрыт — см. NEXT_PUBLIC_ENABLE_PRODAMUS_CHECKOUT и backend ENABLE_PRODAMUS_CHECKOUT. */
const ENABLE_PRODAMUS_SBP = process.env.NEXT_PUBLIC_ENABLE_PRODAMUS_CHECKOUT === "true"

/** Ссылка на бота — для fallback, когда proxy_link не пришёл с API (нет INTERNAL_API_TOKEN на Vercel и т.п.). */
const TELEGRAM_BOT_URL = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/FrostyProxyBot").replace(/\/+$/, "")

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
  // Дефолтный таб = VPN: это главный продукт. MTProxy — приятный бонус,
  // но акцент сознательно смещён на VPN, т.к. именно он открывает Instagram/TikTok/YouTube.
  const [activeTab, setActiveTab] = useState<"vpn" | "proxy">("vpn")
  const [vpn, setVpn] = useState<VpnData | null>(null)
  const [vpnLoading, setVpnLoading] = useState(false)
  const [vpnLinkCopied, setVpnLinkCopied] = useState(false)
  const [vpnError, setVpnError] = useState<string | null>(null)


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
    setVpnError(null)
    try {
      const res = await fetch(`/api/vpn?tg_id=${tgId}`, { cache: "no-store" })
      const text = await res.text()
      let data: VpnData | null = null
      try {
        data = JSON.parse(text) as VpnData
      } catch {
        data = null
      }
      if (!res.ok) {
        setVpn(null)
        // Старые бэкенды могли отдавать 403 на /vpn/config без тела — после деплоя бэкенда
        // вместо этого приходит 200 + reason=internal_token_required.
        setVpnError(
          res.status === 403
            ? "Сервер отклонил запрос VPN. Обновите страницу или напишите в поддержку — если ошибка останется, админу нужно проверить ключ INTERNAL_API_TOKEN на Vercel."
            : "Сервер временно не отвечает. Попробуй ещё раз."
        )
        return
      }
      if (data) setVpn(data)
    } catch {
      setVpn(null)
      setVpnError("Сеть недоступна. Проверь подключение и попробуй снова.")
    } finally {
      setVpnLoading(false)
    }
  }, [tgId])

  useEffect(() => {
    if (activeTab === "vpn" && !vpn && tgId) void fetchVpn()
  }, [activeTab, vpn, tgId, fetchVpn])

  // Если бэкенд сказал «VPN ещё создаётся» — автоматически ретраим через 2 сек,
  // пока ссылка не появится. Пользователю не нужно жать «обновить» руками.
  useEffect(() => {
    if (activeTab !== "vpn" || !vpn) return
    if (vpn.available && !vpn.vless_link) {
      const t = setTimeout(() => { void fetchVpn() }, 2000)
      return () => clearTimeout(t)
    }
  }, [activeTab, vpn, fetchVpn])

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

          {/* Status card — акцент на VPN: он главный продукт, MTProxy идёт бонусом */}
          <div className="p-4 mb-5" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: "#111827" }}>VPN-подписка активна</span>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Instagram, TikTok, YouTube и прокси для Telegram</p>
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

          {/* Tabs — VPN первым (это то, за чем пришли). Telegram — бонусом */}
          <div className="flex mb-5 p-1" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
            {(["vpn", "proxy"] as const).map((tab) => (
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
                {tab === "vpn" ? "🛡 VPN" : "📡 Telegram"}
              </button>
            ))}
          </div>

          {/* ── Proxy tab — один главный путь: огромная кнопка «подключить прокси» */}
          {activeTab === "proxy" && (
            <div className="space-y-4">
              <p className="px-1 text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                MTProxy работает только внутри Telegram — отдельные приложения не нужны.
              </p>

              {proxyLink ? (
                <>
                  <div
                    className="p-5"
                    style={{
                      background: "linear-gradient(145deg, #229ED9 0%, #2AABEE 55%, #0088CC 100%)",
                      borderRadius: "20px",
                      boxShadow: "0 8px 28px rgba(34,158,217,0.35)",
                    }}
                  >
                    <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>Прокси для Telegram</p>
                    <p className="text-xs mt-1 mb-5" style={{ color: "rgba(255,255,255,0.92)" }}>
                      Один тап — Telegram сам добавит ваш персональный MTProxy.
                    </p>
                    <button
                      type="button"
                      onClick={() => openTelegramLink(proxyLink)}
                      className="w-full font-extrabold touch-manipulation active:scale-[0.98] transition-all leading-tight px-2"
                      style={{
                        background: "#FFFFFF",
                        color: "#0088CC",
                        height: "68px",
                        borderRadius: "16px",
                        fontSize: "14px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      ПОДКЛЮЧИТЬ ПРОКСИ В TELEGRAM
                    </button>
                  </div>

                  <details className="group">
                    <summary
                      className="flex items-center justify-between px-4 py-3 cursor-pointer list-none touch-manipulation"
                      style={{ background: "#F7F8FA", borderRadius: "14px", color: "#111827" }}
                    >
                      <span className="text-sm font-semibold">Ссылка или копирование</span>
                      <span className="text-xs" style={{ color: "#2AABEE" }}>Открыть ↓</span>
                    </summary>
                    <div className="mt-2 p-4 space-y-3" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
                      <div className="p-3 font-mono text-[11px] break-all leading-relaxed" style={{ background: "#FFFFFF", borderRadius: "10px", color: "#6B7280" }}>
                        {proxyLink}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                        style={{
                          background: copied ? "#F0FDF4" : "#FFFFFF",
                          color: copied ? "#16A34A" : "#374151",
                          height: "48px",
                          borderRadius: "12px",
                          border: "1px solid #E5E7EB",
                        }}
                      >
                        {copied ? <><Check className="w-4 h-4" />Скопировано</> : <><Copy className="w-4 h-4" />Скопировать ссылку</>}
                      </button>
                    </div>
                  </details>
                </>
              ) : (
                <div className="space-y-3">
                  <div
                    className="p-5 text-center space-y-3"
                    style={{
                      background: "linear-gradient(145deg, #E0F2FE 0%, #F7F8FA 100%)",
                      borderRadius: "20px",
                      border: "1px solid #BAE6FD",
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: "#0C4A6E" }}>Ссылка ещё не подтянулась</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#0369A1" }}>
                      Нажмите «Обновить» — чаще всего сразу появляется большая кнопка подключения. Или откройте бота — там «Статус» тоже даёт ссылку.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className="w-full font-extrabold touch-manipulation active:scale-[0.98] transition-all"
                      style={{
                        background: "#2AABEE",
                        color: "#FFFFFF",
                        height: "64px",
                        borderRadius: "16px",
                        fontSize: "15px",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      Обновить и подключить
                    </button>
                    <button
                      type="button"
                      onClick={() => openTelegramLink(TELEGRAM_BOT_URL)}
                      className="w-full text-sm font-semibold touch-manipulation py-3"
                      style={{ color: "#0369A1" }}
                    >
                      Открыть бота Frosty
                    </button>
                  </div>
                </div>
              )}

              <details>
                <summary
                  className="flex items-center justify-between px-4 py-3 cursor-pointer list-none touch-manipulation text-sm font-semibold"
                  style={{ background: "#F7F8FA", borderRadius: "14px", color: "#6B7280" }}
                >
                  Почему это безопасно
                  <span className="text-xs font-normal" style={{ color: "#2AABEE" }}>↓</span>
                </summary>
                <div className="mt-2 flex flex-col gap-2 px-1 pb-1">
                  {[
                    "⚡ Только Telegram — остальные приложения не затрагивает",
                    "🔒 Без логов содержимого чатов",
                    "📡 Персональный сервер",
                  ].map((t, i) => (
                    <div key={i} className="px-3 py-2.5 text-xs" style={{ background: "#F7F8FA", borderRadius: "10px", color: "#6B7280" }}>{t}</div>
                  ))}
                </div>
              </details>

              <p className="text-xs text-center px-1" style={{ color: "#9CA3AF" }}>
                Instagram, TikTok, YouTube — вкладка <strong style={{ color: "#2AABEE" }}>🛡 VPN</strong>
              </p>
            </div>
          )}

          {/* ── VPN tab ── Супер-простой путь: одна кнопка → импорт в Happ → работает */}
          {activeTab === "vpn" && (
            <div className="space-y-4">
              {/* Стейт 1: первичная загрузка */}
              {vpnLoading && !vpn && !vpnError && (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <RefreshCw className="w-7 h-7 animate-spin" style={{ color: "#2AABEE" }} />
                  <p className="text-xs" style={{ color: "#6B7280" }}>Готовим ваш VPN…</p>
                </div>
              )}

              {/* Стейт 2: сетевая ошибка */}
              {!vpnLoading && vpnError && !vpn && (
                <div className="p-6 text-center space-y-3" style={{ background: "#FEF2F2", borderRadius: "16px", border: "1px solid #FECACA" }}>
                  <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>Не удалось загрузить VPN</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#B91C1C" }}>{vpnError}</p>
                  <button
                    onClick={() => void fetchVpn()}
                    className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold touch-manipulation active:scale-95 transition-all px-4 py-2"
                    style={{ color: "#FFFFFF", background: "#DC2626", borderRadius: "10px" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Повторить
                  </button>
                </div>
              )}

              {/* Стейт 3a: Vercel без INTERNAL_API_TOKEN (или не совпадает с бэкендом) — раньше был HTTP 403 */}
              {!vpnLoading && vpn && !vpn.available && vpn.reason === "internal_token_required" && (
                <div className="p-6 text-center space-y-3" style={{ background: "#EFF6FF", borderRadius: "16px", border: "1px solid #BFDBFE" }}>
                  <p className="text-sm font-semibold" style={{ color: "#1E40AF" }}>Подписка активна — ссылку для VPN сюда не подгрузить</p>
                  <p className="text-xs leading-relaxed text-left" style={{ color: "#1E3A8A" }}>
                    Мини-приложение на сайте не передаёт серверу секретный ключ (на стороне хостинга не задан или не совпадает с бэкендом). Напишите в поддержку в боте — пришлём ссылку для Happ вручную.
                  </p>
                  <p className="text-[11px] leading-relaxed text-left" style={{ color: "#64748B" }}>
                    Админ: в проекте Vercel задайте <code className="font-mono">INTERNAL_API_TOKEN</code> таким же, как на Railway, и сделайте redeploy.
                  </p>
                  <button
                    onClick={() => void fetchVpn()}
                    className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold touch-manipulation active:scale-95 transition-all px-4 py-2 w-full"
                    style={{ color: "#FFFFFF", background: "#2563EB", borderRadius: "12px" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Проверить снова
                  </button>
                </div>
              )}

              {/* Стейт 3b: XRAY / 3X-UI не подключены на бэкенде */}
              {!vpnLoading && vpn && !vpn.available && vpn.reason === "vpn_not_configured" && (
                <div className="p-6 text-center space-y-3" style={{ background: "#FEF3C7", borderRadius: "16px" }}>
                  <p className="text-sm font-semibold" style={{ color: "#92400E" }}>VPN-сервер на стороне Frosty не настроен</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                    Напишите в поддержку — подскажем статус или компенсируем простой.
                  </p>
                  <button
                    onClick={() => void fetchVpn()}
                    className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold touch-manipulation"
                    style={{ color: "#92400E" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Проверить снова
                  </button>
                </div>
              )}

              {/* Стейт 3c: прочие причины (no_subscription и др.) */}
              {!vpnLoading && vpn && !vpn.available && vpn.reason !== "internal_token_required" && vpn.reason !== "vpn_not_configured" && (
                <div className="p-6 text-center space-y-3" style={{ background: "#FEF3C7", borderRadius: "16px" }}>
                  <p className="text-sm font-semibold" style={{ color: "#92400E" }}>VPN временно недоступен</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                    {vpn.reason === "no_subscription"
                      ? "Подписка по этому запросу не найдена. Закройте мини-приложение и откройте снова из бота."
                      : "Мы уже чиним. Напишите в поддержку, если срочно — вернём деньги или продлим подписку."}
                  </p>
                  <button
                    onClick={() => void fetchVpn()}
                    className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold touch-manipulation"
                    style={{ color: "#92400E" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Проверить снова
                  </button>
                </div>
              )}

              {/* Стейт 4: VPN доступен, но конфиг ещё создаётся. Автоматически ретраим в useEffect. */}
              {!vpnLoading && vpn?.available && !vpn.vless_link && (
                <div className="p-6 text-center space-y-3" style={{ background: "#F7F8FA", borderRadius: "16px" }}>
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#2AABEE" }} />
                  <p className="text-sm font-semibold" style={{ color: "#111827" }}>Создаём вашу конфигурацию…</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    Это занимает пару секунд. Страница обновится сама.
                  </p>
                </div>
              )}

              {/* Стейт 5: всё готово — главный экран «СУПЕР ПРОСТО подключиться» */}
              {vpn?.available && vpn.vless_link && (
                <>
                  {/* Главный CTA — одна огромная кнопка. Нажал → Happ открылся → конфиг импортирован. */}
                  <div
                    className="p-5"
                    style={{
                      background: "linear-gradient(135deg, #0EA5E9 0%, #2AABEE 100%)",
                      borderRadius: "20px",
                      boxShadow: "0 8px 24px rgba(14,165,233,0.25)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: "44px", height: "44px", background: "rgba(255,255,255,0.2)", borderRadius: "12px" }}
                      >
                        <Shield className="w-6 h-6" style={{ color: "#FFFFFF" }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#FFFFFF" }}>Ваш VPN готов</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>Сервер Finland · VLESS Reality</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openTelegramLink(`happ://import/${encodeURIComponent(vpn.vless_link!)}`)}
                      className="w-full flex items-center justify-center gap-2 font-bold touch-manipulation active:scale-[0.98] transition-all"
                      style={{
                        background: "#FFFFFF",
                        color: "#0EA5E9",
                        height: "64px",
                        borderRadius: "16px",
                        fontSize: "18px",
                      }}
                    >
                      Подключить VPN в один тап
                    </button>
                    <p className="text-xs text-center mt-3" style={{ color: "rgba(255,255,255,0.9)" }}>
                      Нажмите и конфиг импортируется в Happ автоматически
                    </p>
                  </div>

                  {/* Если Happ ещё не установлен — блок установки. Сворачиваемо по tap */}
                  <details className="group">
                    <summary
                      className="flex items-center justify-between px-4 py-3 cursor-pointer list-none touch-manipulation"
                      style={{ background: "#F7F8FA", borderRadius: "14px", color: "#111827" }}
                    >
                      <span className="text-sm font-semibold">Happ ещё не установлен?</span>
                      <span className="text-xs" style={{ color: "#2AABEE" }}>
                        Открыть ↓
                      </span>
                    </summary>
                    <div className="mt-2 p-4 space-y-3" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
                      <p className="text-xs" style={{ color: "#6B7280" }}>
                        Happ — бесплатное приложение-клиент для VLESS. Установите и вернитесь сюда, нажмите кнопку выше ещё раз.
                      </p>
                      <div className="flex gap-2">
                        <a
                          href="https://apps.apple.com/app/happ-proxy-utility/id6504287215"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                          style={{ background: "#FFFFFF", color: "#111827", height: "44px", borderRadius: "12px", border: "1px solid #E5E7EB" }}
                        >
                          iPhone
                        </a>
                        <a
                          href="https://play.google.com/store/apps/details?id=com.happ.vpn"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                          style={{ background: "#FFFFFF", color: "#111827", height: "44px", borderRadius: "12px", border: "1px solid #E5E7EB" }}
                        >
                          Android
                        </a>
                      </div>
                    </div>
                  </details>

                  {/* Альтернативы — ссылка и QR. Убрано с главного экрана чтобы не отвлекать */}
                  <details>
                    <summary
                      className="flex items-center justify-between px-4 py-3 cursor-pointer list-none touch-manipulation"
                      style={{ background: "#F7F8FA", borderRadius: "14px", color: "#111827" }}
                    >
                      <span className="text-sm font-semibold">Другой VPN-клиент или QR-код</span>
                      <span className="text-xs" style={{ color: "#2AABEE" }}>Открыть ↓</span>
                    </summary>
                    <div className="mt-2 p-5 space-y-4" style={{ background: "#F7F8FA", borderRadius: "14px" }}>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "#111827" }}>Ссылка для импорта</p>
                        <div className="p-3 font-mono text-[11px] break-all leading-relaxed mb-2" style={{ background: "#FFFFFF", borderRadius: "10px", color: "#6B7280" }}>
                          {vpn.vless_link}
                        </div>
                        <button
                          onClick={handleCopyVlessLink}
                          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold touch-manipulation active:scale-95 transition-all"
                          style={{
                            background: vpnLinkCopied ? "#F0FDF4" : "#FFFFFF",
                            color: vpnLinkCopied ? "#16A34A" : "#374151",
                            height: "44px",
                            borderRadius: "12px",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          {vpnLinkCopied ? <><Check className="w-4 h-4" />Скопировано</> : <><Copy className="w-4 h-4" />Скопировать ссылку</>}
                        </button>
                      </div>

                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "#111827" }}>QR-код для другого устройства</p>
                        <div
                          className="mx-auto flex items-center justify-center p-3"
                          style={{ background: "#FFFFFF", borderRadius: "14px", maxWidth: "200px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(vpn.vless_link)}`}
                            alt="QR код VPN"
                            width={180}
                            height={180}
                            style={{ display: "block", borderRadius: "8px" }}
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Мелкая подсказка снизу */}
                  <p className="text-xs text-center px-2" style={{ color: "#9CA3AF" }}>
                    Один конфиг работает на всех ваших устройствах. Без логов. Персональный сервер.
                  </p>
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
