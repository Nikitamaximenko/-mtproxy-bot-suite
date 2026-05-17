"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, MessageCircle, Shield, Zap } from "lucide-react"
import {
  type CheckoutProvider,
  getCheckoutProviderPresentation,
  normalizePaymentUrl,
} from "@/lib/telegram"

const TELEGRAM_BOT = "https://t.me/frostytg_bot?start=site"
const TELEGRAM_SITE_OFFER_BOT = "https://t.me/frostytg_bot?start=siteoffer"
const TELEGRAM_OFFER_BOT = "https://t.me/frostytg_bot?start=offer"
const PRICE_RUB = 299

type VpnPing = { online: boolean; latency_ms: number | null }

function FrostIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
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

function ServiceChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
      style={{ background: "#F3F4F6", color: "#374151", borderRadius: "999px" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  )
}

function PaymentCard({ ping }: { ping: VpnPing | null }) {
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [paymentProvider, setPaymentProvider] = useState<CheckoutProvider>("yookassa")

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const showErr = touched && email.length > 0 && !valid
  const providerMeta = getCheckoutProviderPresentation(paymentProvider)

  const pay = useCallback(async () => {
    if (!valid) return
    setPaying(true)
    setError(null)
    setDetail(null)
    try {
      try {
        localStorage.setItem("frosty_email", email.trim())
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: "0",
          username: null,
          customer_email: email.trim(),
          payment_provider: paymentProvider,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        payment_url?: string
        error?: string
        details?: string
      }
      if (!res.ok || !data.payment_url) {
        setError(data.error || "Не удалось создать оплату. Попробуйте позже.")
        if (data.details) setDetail(String(data.details).slice(0, 300))
        return
      }
      window.location.href = normalizePaymentUrl(data.payment_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так. Попробуйте ещё раз.")
    } finally {
      setPaying(false)
    }
  }, [email, paymentProvider, valid])

  return (
    <div
      className="p-6"
      style={{
        background: "#FFFFFF",
        borderRadius: "24px",
        boxShadow: "0 12px 32px -4px rgba(15,23,42,0.12), 0 4px 12px -2px rgba(15,23,42,0.06)",
        border: "1px solid #E5E7EB",
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold" style={{ color: "#111827" }}>
          Умный VPN Frosty
        </span>
        <span className="text-xs" style={{ color: "#6B7280" }}>
          до 10 устройств
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-display font-extrabold" style={{ fontSize: 36, color: "#111827", letterSpacing: "-0.03em" }}>
          {PRICE_RUB} ₽
        </span>
        <span className="text-sm" style={{ color: "#6B7280" }}>
          / месяц
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
        ≈ 10 ₽ в день · без лимитов · отмена в любой момент
      </p>
      <div
        className="mb-4 px-3 py-2.5"
        style={{ background: "#EFF6FF", borderRadius: 12, border: "1px solid #BFDBFE" }}
      >
        <p className="text-xs font-semibold" style={{ color: "#1D4ED8" }}>
          🎁 Есть бесплатный день
        </p>
        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#4B5563" }}>
          Хочешь сначала проверить сервис? Открой бота и забери бесплатный день.
        </p>
      </div>

      <div className="mb-3">
        <span className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>
          Способ оплаты
        </span>
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: "yookassa" as const, label: "СБП и карты", tone: "brand" as const },
            { key: "lava" as const, label: "Карта", tone: "neutral" as const },
          ]).map((option) => {
            const meta = getCheckoutProviderPresentation(option.key)
            const active = paymentProvider === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPaymentProvider(option.key)}
                className="text-left px-3 py-2.5 text-xs font-semibold transition-all"
                style={{
                  borderRadius: 12,
                  border: active ? "2px solid #2AABEE" : "1px solid #E5E7EB",
                  background: active ? "#EFF6FF" : "#F9FAFB",
                  color: "#111827",
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{meta.subtitle}</span>
                  <span
                    className="text-[10px] px-2 py-0.5"
                    style={{
                      borderRadius: 999,
                      background: option.tone === "brand" ? "#DBEAFE" : "#E5E7EB",
                      color: option.tone === "brand" ? "#1D4ED8" : "#4B5563",
                    }}
                  >
                    {option.label}
                  </span>
                </span>
                <span className="block font-normal mt-1 leading-relaxed" style={{ color: "#6B7280", fontSize: 10 }}>
                  {meta.title}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] mt-2" style={{ color: "#6B7280" }}>
          По умолчанию включена ЮKassa: СБП, SberPay, T-Pay и карты.
        </p>
      </div>

      <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>
        Email для чека и доступа
      </label>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          setTouched(true)
        }}
        onBlur={() => setTouched(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) void pay()
        }}
        className="w-full h-12 px-4 text-sm outline-none transition-all mb-1"
        style={{
          background: "#F7F8FA",
          border: showErr ? "1px solid #EF4444" : "1px solid transparent",
          borderRadius: "12px",
          color: "#111827",
        }}
      />
      {showErr && (
        <p className="text-xs mb-2" style={{ color: "#EF4444" }}>
          Введите корректный email (например, you@mail.ru)
        </p>
      )}

      <button
        type="button"
        disabled={!valid || paying}
        onClick={() => void pay()}
        className="w-full font-bold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "#2AABEE",
          color: "#FFFFFF",
          height: 56,
          borderRadius: 14,
          fontSize: 16,
          marginTop: 12,
        }}
      >
        {paying ? "Готовим оплату…" : paymentProvider === "yookassa" ? `Оплатить через YooKassa` : `Оплатить ${PRICE_RUB} ₽`}
      </button>

      <div className="flex items-center justify-center gap-2 mt-3 text-[11px]" style={{ color: "#9CA3AF" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {providerMeta.hint}
      </div>

      {error && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-center" style={{ color: "#EF4444" }}>
            {error}
          </p>
          {detail && (
            <p className="text-xs text-center break-words px-1" style={{ color: "#6B7280" }}>
              {detail}
            </p>
          )}
        </div>
      )}

      <div
        className="mt-4 flex items-center gap-2 px-3 py-2"
        style={{ background: "#F7F8FA", borderRadius: 10, fontSize: 12, color: "#6B7280" }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ping?.online ? "#10B981" : "#9CA3AF",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {ping == null
          ? "Проверяем сервер…"
          : ping.online
            ? `🇫🇮 Финляндия · ${ping.latency_ms ?? "—"} мс · сервер онлайн`
            : "Сервер временно недоступен"}
      </div>

      <a
        href={TELEGRAM_BOT}
        className="mt-3 flex items-center justify-center gap-2 w-full font-semibold transition-colors"
        style={{
          background: "#F7F8FA",
          color: "#111827",
          height: 48,
          borderRadius: 12,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        <MessageCircle className="w-4 h-4" />
        Оплатить внутри Telegram
      </a>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details
      className="group"
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        border: "1px solid #E5E7EB",
        padding: "16px 18px",
      }}
    >
      <summary
        className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold"
        style={{ color: "#111827", fontSize: 15 }}
      >
        {q}
        <span
          className="transition-transform group-open:rotate-180 shrink-0"
          style={{ color: "#2AABEE" }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4B5563" }}>
        {a}
      </p>
    </details>
  )
}

export function Landing() {
  const [ping, setPing] = useState<VpnPing | null>(null)
  const paymentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadPing = async () => {
      try {
        const r = await fetch("/api/vpn-ping", { cache: "no-store" })
        const d = (await r.json()) as VpnPing
        setPing(d)
      } catch {
        setPing({ online: false, latency_ms: null })
      }
    }
    void loadPing()
    const i = setInterval(loadPing, 30000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    try {
      const wa = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      if (wa?.initData && wa.initData.length > 0) {
        window.location.replace("/mini")
      }
    } catch {
      /* ignore */
    }
  }, [])

  const scrollToPayment = useCallback(() => {
    paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  return (
    <div className="font-sans antialiased" style={{ background: "#FFFFFF", color: "#111827" }}>
      <nav className="sticky top-0 z-40" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(12px)", borderBottom: "1px solid #F3F4F6" }}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FrostIcon className="w-6 h-6" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="font-bold text-base">Frosty</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/blog"
              className="hidden sm:inline-block px-3 py-2 text-sm"
              style={{ color: "#374151" }}
            >
              Блог
            </a>
            <a
              href="#faq"
              className="hidden sm:inline-block px-3 py-2 text-sm"
              style={{ color: "#374151" }}
            >
              FAQ
            </a>
            <a
              href={TELEGRAM_BOT}
              className="px-4 py-2 text-sm font-semibold rounded-full transition-colors"
              style={{ background: "#F7F8FA", color: "#111827" }}
            >
              Открыть в Telegram
            </a>
          </div>
        </div>
      </nav>

      <section className="px-5 pt-10 pb-8 sm:pt-16 sm:pb-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
          <div>
            <span
              className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1.5 mb-5"
              style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: 999, letterSpacing: "0.06em" }}
            >
              Умный VPN · Белые списки · Бесплатный день в Telegram
            </span>
            <h1
              className="font-display font-extrabold leading-[1.05] mb-5"
              style={{ fontSize: "clamp(34px, 6vw, 56px)", letterSpacing: "-0.03em" }}
            >
              Один клик —{" "}
              <span style={{ color: "#2AABEE" }}>Instagram, TikTok, YouTube</span> работают.
              <br />
              Сбер, Госуслуги — напрямую.
            </h1>
            <p
              className="max-w-xl mb-7"
              style={{ fontSize: 17, lineHeight: 1.55, color: "#4B5563" }}
            >
              Умный VPN с белыми списками: российские сайты идут напрямую, заблокированные — через VPN
              автоматически. До 10 устройств, без лимитов по скорости и трафику. Реклама на YouTube заблокирована.
            </p>

            <div className="flex flex-wrap gap-3 mb-7">
              <button
                type="button"
                onClick={scrollToPayment}
                className="font-bold active:scale-[0.98] transition-transform"
                style={{
                  background: "#2AABEE",
                  color: "#FFFFFF",
                  padding: "16px 24px",
                  borderRadius: 14,
                  fontSize: 16,
                  boxShadow: "0 10px 24px -6px rgba(42,171,238,0.55)",
                }}
              >
                Оформить за {PRICE_RUB} ₽ / мес →
              </button>
              <a
                href={TELEGRAM_OFFER_BOT}
                className="inline-flex items-center gap-2 font-semibold transition-colors"
                style={{
                  background: "#F7F8FA",
                  color: "#111827",
                  padding: "16px 24px",
                  borderRadius: 14,
                  fontSize: 16,
                  textDecoration: "none",
                }}
              >
                <MessageCircle className="w-5 h-5" />
                Бесплатный тестовый день
              </a>
            </div>
            <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
              🎁 В Telegram-боте доступен один бесплатный тестовый день. Нажмите кнопку и активируйте оффер внутри бота.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <ServiceChip label="Instagram" color="#E1306C" />
              <ServiceChip label="TikTok" color="#111827" />
              <ServiceChip label="YouTube" color="#FF0000" />
              <ServiceChip label="Twitter / X" color="#0EA5E9" />
              <ServiceChip label="ChatGPT" color="#10A37F" />
              <ServiceChip label="Яндекс напрямую" color="#FFCC00" />
              <ServiceChip label="Сбер напрямую" color="#21A038" />
            </div>

            <div className="flex items-center gap-4 text-sm" style={{ color: "#6B7280" }}>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ping?.online ? "#10B981" : "#9CA3AF",
                    display: "inline-block",
                  }}
                />
                {ping == null
                  ? "Проверяем сервер…"
                  : ping.online
                    ? `Сервер в Финляндии · ${ping.latency_ms ?? "—"} мс`
                    : "Сервер недоступен"}
              </div>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span>Отмена в любой момент</span>
            </div>
          </div>

          <div ref={paymentRef} className="lg:sticky lg:top-20">
            <PaymentCard ping={ping} />
          </div>
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="max-w-6xl mx-auto">
          <div
            className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 p-6 sm:p-8"
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #111827 52%, #0C4A6E 100%)",
              borderRadius: 28,
              boxShadow: "0 18px 48px -20px rgba(15,23,42,0.45)",
            }}
          >
            <div>
              <span
                className="inline-block text-xs font-bold uppercase tracking-wide px-3 py-1.5 mb-4"
                style={{ background: "rgba(255,255,255,0.12)", color: "#E0F2FE", borderRadius: 999, letterSpacing: "0.06em" }}
              >
                🎁 Бесплатный день
              </span>
              <h2
                className="font-display font-extrabold mb-3"
                style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.03em", lineHeight: 1.05 }}
              >
                Попробуй Frosty бесплатно.
              </h2>
              <p className="max-w-2xl mb-5" style={{ color: "#CBD5E1", fontSize: 16, lineHeight: 1.6 }}>
                Забери бесплатный день в боте и проверь, как у тебя работают Telegram, YouTube,
                Instagram и другие сайты.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  "1 день бесплатно",
                  "VPN + белые списки уже включены",
                  "Можно попробовать перед оплатой",
                ].map((item) => (
                  <div
                    key={item}
                    className="px-4 py-3 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, color: "#E5E7EB" }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="p-5 sm:p-6"
              style={{ background: "#FFFFFF", borderRadius: 24, border: "1px solid rgba(255,255,255,0.14)" }}
            >
              <p className="text-xs font-bold uppercase mb-2" style={{ color: "#0284C7", letterSpacing: "0.06em" }}>
                Как получить
              </p>
              <p className="text-sm mb-4" style={{ color: "#4B5563", lineHeight: 1.65 }}>
                Нажми кнопку ниже. Откроется бот, где можно сразу забрать бесплатный день.
              </p>
              <a
                href={TELEGRAM_SITE_OFFER_BOT}
                className="inline-flex items-center justify-center gap-2 w-full font-bold transition-transform active:scale-[0.98]"
                style={{
                  background: "#2AABEE",
                  color: "#FFFFFF",
                  minHeight: 56,
                  borderRadius: 16,
                  fontSize: 16,
                  textDecoration: "none",
                  boxShadow: "0 10px 24px -8px rgba(42,171,238,0.55)",
                }}
              >
                <MessageCircle className="w-5 h-5" />
                Открыть бота
              </a>
              <p className="text-[11px] mt-3" style={{ color: "#6B7280", lineHeight: 1.5 }}>
                Если бесплатный день уже использован, бот просто покажет статус подписки.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12" style={{ background: "#F7F8FA" }}>
        <div className="max-w-6xl mx-auto">
          <h2
            className="font-display font-extrabold mb-3"
            style={{ fontSize: "clamp(26px, 3.5vw, 36px)", letterSpacing: "-0.03em" }}
          >
            VPN, который умнее обычного
          </h2>
          <p className="max-w-2xl mb-8" style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6 }}>
            Обычный VPN тормозит Яндекс, Сбер и Госуслуги — он гонит весь трафик через сервер. Frosty
            автоматически разделяет: российские сайты идут напрямую, заблокированные — через VPN. Без настроек.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Белые списки",
                text: "РФ-сайты (Яндекс, Сбер, Госуслуги, банки) работают напрямую — без VPN. Instagram, TikTok, YouTube — через VPN. Автоматически.",
                color: "#2AABEE",
                icon: <Shield className="w-5 h-5" />,
              },
              {
                title: "До 10 устройств",
                text: "Один аккаунт — телефон, планшет, ноутбук, компьютер. Все устройства подключены одновременно по одной подписке.",
                color: "#16A34A",
                icon: <Zap className="w-5 h-5" />,
              },
              {
                title: "Один клик",
                text: "Нажимаете «Подключить VPN» в боте — Happ открывается и добавляет сервер сам. Никаких копирований и инструкций.",
                color: "#F59E0B",
                icon: <Check className="w-5 h-5" />,
              },
            ].map((c) => (
              <div
                key={c.title}
                className="p-5"
                style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid #E5E7EB" }}
              >
                <div
                  className="inline-flex items-center justify-center mb-3"
                  style={{
                    width: 40,
                    height: 40,
                    background: `${c.color}15`,
                    color: c.color,
                    borderRadius: 12,
                  }}
                >
                  {c.icon}
                </div>
                <p className="font-bold mb-1.5" style={{ color: "#111827", fontSize: 16 }}>
                  {c.title}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="max-w-6xl mx-auto">
          <h2
            className="font-display font-extrabold mb-2"
            style={{ fontSize: "clamp(26px, 3.5vw, 36px)", letterSpacing: "-0.03em" }}
          >
            Как это работает
          </h2>
          <p className="mb-8" style={{ color: "#6B7280", fontSize: 16 }}>
            Всё подключается за пару минут — и с телефона, и с компьютера.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Оплата 299 ₽",
                text: "Оплата банковской картой (СБП, SberPay, Lava). Письмо придёт на email, в Telegram — мгновенный доступ.",
              },
              {
                step: "2",
                title: "Скачайте Happ",
                text: "Установите бесплатное приложение Happ (iOS / Android) или Hiddify (Windows / Mac) — займёт минуту.",
              },
              {
                step: "3",
                title: "Один клик — и готово",
                text: "Нажмите «🛡 Подключить VPN» в боте → «Открыть в Happ». Приложение добавит умный VPN автоматически. Белые списки уже включены.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-6"
                style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid #E5E7EB" }}
              >
                <div
                  className="inline-flex items-center justify-center mb-4 font-extrabold"
                  style={{
                    width: 44,
                    height: 44,
                    background: "#EFF6FF",
                    color: "#2563EB",
                    borderRadius: 12,
                    fontSize: 20,
                  }}
                >
                  {s.step}
                </div>
                <p className="font-bold mb-2" style={{ color: "#111827", fontSize: 17 }}>
                  {s.title}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <button
              type="button"
              onClick={scrollToPayment}
              className="font-bold transition-transform active:scale-[0.98]"
              style={{
                background: "#2AABEE",
                color: "#FFFFFF",
                padding: "14px 22px",
                borderRadius: 12,
                fontSize: 15,
              }}
            >
              Оформить подписку
            </button>
            <a
              href={TELEGRAM_BOT}
              className="font-semibold"
              style={{ color: "#2AABEE" }}
            >
              Или открыть бот в Telegram →
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 py-14" style={{ background: "#F7F8FA" }}>
        <div className="max-w-6xl mx-auto">
          <h2
            className="font-display font-extrabold mb-6"
            style={{ fontSize: "clamp(24px, 3vw, 32px)", letterSpacing: "-0.03em" }}
          >
            Почему Frosty, а не «бесплатный VPN из магазина»
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6" style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid #FECACA" }}>
              <p className="text-xs font-bold uppercase mb-3" style={{ color: "#DC2626", letterSpacing: "0.06em" }}>
                Обычный VPN
              </p>
              <ul className="space-y-2">
                {[
                  "Перегружен — скорость 2 Мбит, видео тормозит",
                  "Яндекс, Сбер, Госуслуги тоже тормозят через VPN",
                  "Собирает и продаёт метаданные",
                  "Реклама на YouTube всё равно есть",
                  "Ловит RKN-блокировки через неделю",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm" style={{ color: "#374151" }}>
                    <span style={{ color: "#DC2626", fontWeight: 700 }}>—</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="p-6"
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                border: "1px solid #BAE6FD",
                boxShadow: "0 10px 24px -10px rgba(42,171,238,0.35)",
              }}
            >
              <p className="text-xs font-bold uppercase mb-3" style={{ color: "#0284C7", letterSpacing: "0.06em" }}>
                Frosty умный VPN
              </p>
              <ul className="space-y-2">
                {[
                  "РФ-сайты напрямую, заблокированные — через VPN",
                  "Реклама на YouTube заблокирована",
                  "До 10 устройств по одной подписке",
                  "Без лимитов по скорости и трафику",
                  "Живая поддержка · 299 ₽/мес, отмена в любой момент",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm" style={{ color: "#111827" }}>
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#16A34A" }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <h2
            className="font-display font-extrabold mb-6"
            style={{ fontSize: "clamp(26px, 3.5vw, 36px)", letterSpacing: "-0.03em" }}
          >
            Частые вопросы
          </h2>

          <div className="space-y-3">
            <Faq
              q="Что такое «белые списки»?"
              a="Умный VPN разделяет трафик автоматически: российские сайты (Яндекс, ВКонтакте, Сбер, Госуслуги, банки) идут напрямую без VPN — с полной скоростью. Заблокированные сайты (Instagram, TikTok, YouTube, X) — через зашифрованный VPN. Ничего настраивать не нужно."
            />
            <Faq
              q="Правда без рекламы на YouTube?"
              a="Да. Frosty блокирует рекламные серверы YouTube на уровне DNS ещё до подключения к VPN. Работает на всех устройствах, где настроен Happ."
            />
            <Faq
              q="На сколько устройств работает одна подписка?"
              a="До 10 устройств одновременно на одном аккаунте. Телефон, планшет, ноутбук, компьютер — всё по одной подписке."
            />
            <Faq
              q="Есть ли лимит по скорости или трафику?"
              a="Нет. Персональный сервер — скорость не делишь с другими. Ни ограничений по скорости, ни по объёму трафика."
            />
            <Faq
              q="Нужен ли Telegram, чтобы купить?"
              a="Нет. Оплачивайте на сайте банковской картой — на email придёт чек и ссылка. Чтобы подключить VPN, откройте бота из письма: подписка привяжется автоматически."
            />
            <Faq
              q="Какие способы оплаты?"
              a="ЮKassa (СБП, SberPay, T-Pay, карты) или Lava (карта). Оплата на сайте, в мини-приложении или прямо в боте. 299 ₽/мес, отмена в любой момент."
            />
            <Faq
              q="Можно сначала попробовать бесплатно?"
              a="Да. В Telegram-боте есть один бесплатный день. Нажмите «Бесплатный тестовый день» — активируется мгновенно, белые списки и блокировка рекламы уже включены."
            />
            <Faq
              q="Вы пишете логи моего трафика?"
              a="Нет. Мы храним только то, что нужно для работы: telegram-id или email, статус и даты подписки. Что именно вы открываете через VPN — мы не видим и не пишем."
            />
            <Faq
              q="Что если не работает или что-то сломалось?"
              a="Напишите в бот команду /support — ИИ-поддержка отвечает сразу, сложные вопросы берёт живой админ. Если не сможем починить — вернём деньги."
            />
          </div>
        </div>
      </section>

      <section className="px-5 py-14" style={{ background: "#0F172A" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="font-display font-extrabold mb-3"
            style={{ color: "#FFFFFF", fontSize: "clamp(26px, 3.5vw, 36px)", letterSpacing: "-0.03em" }}
          >
            Пока вы читаете — Instagram уже мог бы работать.
          </h2>
          <p className="mb-7 max-w-xl mx-auto" style={{ color: "#CBD5E1", fontSize: 16, lineHeight: 1.55 }}>
            299 ₽ в месяц — и Instagram, TikTok, YouTube, ChatGPT работают без тормозов. Яндекс и Сбер — напрямую. Реклама на YouTube — заблокирована. Один клик.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={scrollToPayment}
              className="font-bold active:scale-[0.98] transition-transform"
              style={{
                background: "#2AABEE",
                color: "#FFFFFF",
                padding: "16px 26px",
                borderRadius: 14,
                fontSize: 16,
                boxShadow: "0 10px 24px -6px rgba(42,171,238,0.55)",
              }}
            >
              Оформить за {PRICE_RUB} ₽
            </button>
            <a
              href={TELEGRAM_BOT}
              className="inline-flex items-center gap-2 font-semibold"
              style={{
                background: "#1E293B",
                color: "#FFFFFF",
                padding: "16px 26px",
                borderRadius: 14,
                fontSize: 16,
                textDecoration: "none",
              }}
            >
              <MessageCircle className="w-5 h-5" />
              Открыть бот
            </a>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8" style={{ background: "#FFFFFF", borderTop: "1px solid #F3F4F6" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FrostIcon className="w-5 h-5" style={{ color: "#2AABEE" } as React.CSSProperties} />
            <span className="text-sm font-semibold">Frosty</span>
            <span className="text-xs" style={{ color: "#9CA3AF" }}>
              · Умный VPN · до 10 устройств · 299 ₽ / мес
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: "#6B7280" }}>
            <a href={TELEGRAM_BOT} style={{ color: "#2AABEE", textDecoration: "none" }}>
              @frostytg_bot
            </a>
            <a href="/blog" style={{ color: "#6B7280", textDecoration: "none" }}>
              Блог
            </a>
            <a href="#faq" style={{ color: "#6B7280", textDecoration: "none" }}>
              FAQ
            </a>
          </div>
        </div>
        <p className="max-w-6xl mx-auto text-xs mt-4" style={{ color: "#9CA3AF" }}>
          © {new Date().getFullYear()} Frosty. Используйте сервис в соответствии с законами вашей страны.
        </p>
      </footer>
    </div>
  )
}
