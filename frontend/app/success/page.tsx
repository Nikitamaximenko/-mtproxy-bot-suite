"use client"
import { useEffect, useRef, useState } from "react"
import { Manrope } from "next/font/google"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] })

type Phase =
  | "polling"      // автоматический поллинг после редиректа с Lava
  | "not_found"    // поллинг не дал результата — просим email
  | "checking"     // ручная проверка по введённому email
  | "done"         // подписка найдена, показываем прокси

async function fetchStatus(query: string): Promise<{ active: boolean; proxy_link?: string }> {
  const res = await fetch(`/api/subscription-status?${query}`)
  if (!res.ok) return { active: false }
  return res.json()
}

export default function SuccessPage() {
  const [phase, setPhase] = useState<Phase>("polling")
  const [proxyLink, setProxyLink] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleFound = (link: string) => {
    stopPolling()
    setProxyLink(link)
    setPhase("done")
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const urlEmail = params.get("email")
    const lsEmail = typeof window !== "undefined" ? localStorage.getItem("frosty_email") : null
    const email = urlEmail || lsEmail

    // Нет ни токена ни email — сразу просим email
    if (!token && !email) {
      setPhase("not_found")
      return
    }

    const query = token
      ? `token=${token}`
      : `email=${encodeURIComponent(email!)}`

    let attempts = 0
    const MAX = 20 // ~60 сек

    const check = async () => {
      attempts++
      try {
        const data = await fetchStatus(query)
        if (data.active && data.proxy_link) {
          handleFound(data.proxy_link)
          return
        }
      } catch {}
      if (attempts >= MAX) {
        stopPolling()
        setPhase("not_found")
      }
    }

    check() // сразу
    intervalRef.current = setInterval(check, 3000)
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualCheck = async () => {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Введите корректный email")
      return
    }
    setEmailError(null)
    setPhase("checking")
    try {
      const data = await fetchStatus(`email=${encodeURIComponent(trimmed)}`)
      if (data.active && data.proxy_link) {
        localStorage.setItem("frosty_email", trimmed)
        handleFound(data.proxy_link)
      } else {
        setPhase("not_found")
        setEmailError("Подписка не найдена. Проверьте email или подождите пару минут.")
      }
    } catch {
      setPhase("not_found")
      setEmailError("Ошибка соединения. Попробуйте ещё раз.")
    }
  }

  const copy = () => {
    if (!proxyLink) return
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={manrope.className}
      style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>

        {/* ── POLLING ── */}
        {phase === "polling" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❄️</div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>Проверяем оплату…</h1>
            <p style={{ color: "#6B7280", fontSize: "15px", lineHeight: "1.5" }}>
              Обычно занимает несколько секунд.<br />Не закрывайте страницу.
            </p>
            <div style={{ marginTop: "32px", display: "flex", justifyContent: "center", gap: "6px" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: "8px", height: "8px", borderRadius: "50%", background: "#2AABEE",
                  display: "inline-block",
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
          </>
        )}

        {/* ── NOT FOUND / EMAIL FORM ── */}
        {(phase === "not_found" || phase === "checking") && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
              Проверить подписку
            </h1>
            <p style={{ color: "#6B7280", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
              Введите email, который указывали при оплате — и мы покажем вашу ссылку на прокси.
            </p>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "6px" }}>
                Email
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailError(null) }}
                onKeyDown={e => e.key === "Enter" && handleManualCheck()}
                style={{
                  width: "100%", height: "48px", padding: "0 16px", fontSize: "15px",
                  border: emailError ? "1px solid #EF4444" : "1px solid #E5E7EB",
                  borderRadius: "12px", outline: "none", boxSizing: "border-box",
                  color: "#111827", background: "#F7F8FA", marginBottom: "8px",
                }}
              />
              {emailError && (
                <p style={{ fontSize: "13px", color: "#EF4444", marginBottom: "8px" }}>{emailError}</p>
              )}
              <button
                onClick={handleManualCheck}
                disabled={phase === "checking"}
                style={{
                  width: "100%", height: "52px", background: phase === "checking" ? "#93C5FD" : "#2AABEE",
                  color: "#FFFFFF", border: "none", borderRadius: "14px", fontSize: "17px",
                  fontWeight: 700, cursor: phase === "checking" ? "default" : "pointer",
                }}
              >
                {phase === "checking" ? "Проверяем…" : "Проверить подписку →"}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "16px" }}>
              Если оплата прошла, но подписки нет — напишите в{" "}
              <a href="https://t.me/FrostyBot" style={{ color: "#2AABEE" }}>@FrostyBot</a>
            </p>
          </>
        )}

        {/* ── DONE ── */}
        {phase === "done" && proxyLink && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>Прокси готов!</h1>
            <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "24px", lineHeight: "1.5" }}>
              Нажмите кнопку — Telegram откроется и предложит добавить прокси
            </p>
            <a
              href={proxyLink}
              style={{
                display: "block", background: "#2AABEE", color: "#FFFFFF",
                height: "56px", borderRadius: "14px", fontSize: "17px", fontWeight: 700,
                textDecoration: "none", lineHeight: "56px", marginBottom: "12px",
              }}
            >
              Подключить прокси в Telegram →
            </a>
            <button
              onClick={copy}
              style={{
                width: "100%", background: "#F7F8FA", color: "#374151",
                height: "48px", borderRadius: "14px", fontSize: "15px",
                border: "1px solid #E5E7EB", cursor: "pointer", marginBottom: "24px",
              }}
            >
              {copied ? "✅ Скопировано!" : "Скопировать ссылку"}
            </button>
            <div style={{ background: "#F7F8FA", borderRadius: "16px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginBottom: "8px" }}>Инструкция:</p>
              <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: "1.7" }}>
                1. Нажмите «Подключить прокси в Telegram»<br />
                2. Telegram откроется автоматически<br />
                3. Нажмите «Добавить» в появившемся окне<br />
                4. Готово — Telegram работает без ограничений
              </p>
            </div>
            <a
              href="https://t.me/FrostyBot"
              style={{
                display: "block", background: "#F7F8FA", color: "#374151",
                height: "48px", borderRadius: "14px", fontSize: "15px",
                textDecoration: "none", lineHeight: "48px", border: "1px solid #E5E7EB",
              }}
            >
              Перейти в бот @FrostyBot →
            </a>
          </>
        )}

      </div>
    </div>
  )
}
