"use client"
import { useEffect, useRef, useState } from "react"

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
  const [token, setToken] = useState<string | null>(null)
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
    setToken(token)
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
    const MAX = 45 // ~2 мин — вебхук Prodamus иногда с задержкой

    const check = async () => {
      attempts++
      try {
        const data = await fetchStatus(query)
        // Оплата подтверждена в БД; прокси может появиться на следующем опросе (гонка с вебхуком).
        if (data.active) {
          if (data.proxy_link) {
            handleFound(data.proxy_link)
            return
          }
        }
      } catch {}
      if (attempts >= MAX) {
        stopPolling()
        try {
          const last = await fetchStatus(query)
          if (last.active && last.proxy_link) {
            handleFound(last.proxy_link)
            return
          }
          if (last.active && !last.proxy_link) {
            setPhase("done")
            setProxyLink(null)
            return
          }
        } catch {
          /* fallthrough */
        }
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
      if (data.active) {
        localStorage.setItem("frosty_email", trimmed)
        if (data.proxy_link) {
          handleFound(data.proxy_link)
        } else {
          setPhase("done")
          setProxyLink(null)
        }
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
      className="font-sans antialiased"
      style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>

        {/* ── POLLING ── */}
        {phase === "polling" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❄️</div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>Проверяем оплату…</h1>
            <p style={{ color: "#6B7280", fontSize: "15px", lineHeight: "1.5" }}>
              Обычно несколько секунд, иногда до 1–2 минут (пока банк подтвердит оплату и дойдёт уведомление).
              <br />
              Не закрывайте страницу — можно ввести email ниже, если таймер истёк.
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
              <a href="https://t.me/frostytg_bot" style={{ color: "#2AABEE" }}>@FrostyBot</a>
            </p>
          </>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🧊</div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>Подписка 2 в 1 активна!</h1>
            <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "20px" }}>📡 Прокси для Telegram + 🛡 VPN для всего остального</p>
            {proxyLink ? (
              <>
                <div style={{ textAlign: "left", marginBottom: "24px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
                    📡 Шаг 1 — Подключите Telegram прокси
                  </p>
                  <a
                    href={proxyLink}
                    style={{
                      display: "block", background: "#2AABEE", color: "#FFFFFF",
                      height: "52px", borderRadius: "14px", fontSize: "16px", fontWeight: 700,
                      textDecoration: "none", lineHeight: "52px", textAlign: "center", marginBottom: "8px",
                    }}
                  >
                    Подключить прокси в Telegram →
                  </a>
                  <p style={{ fontSize: "13px", color: "#6B7280" }}>
                    Telegram откроется и предложит добавить прокси — нажмите «Добавить»
                  </p>
                </div>

                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
                    🛡 Шаг 2 — Подключите VPN через Happ
                  </p>
                  <div style={{ background: "#F7F8FA", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "14px", color: "#374151", marginBottom: "12px", lineHeight: "1.6" }}>
                      1. Скачайте приложение Happ:<br />
                      &nbsp;&nbsp;• <a href="https://play.google.com/store/apps/details?id=com.happproxy" style={{ color: "#2AABEE" }}>Android — Google Play</a><br />
                      &nbsp;&nbsp;• <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215" style={{ color: "#2AABEE" }}>iOS — App Store</a>
                    </p>
                    <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6" }}>
                      2. Откройте бота @frostytg_bot<br />
                      3. Нажмите «Личный кабинет» → вкладка «🛡 VPN»<br />
                      4. Нажмите «Открыть в Happ» — подключение за 10 секунд ✅
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <a
                      href="https://play.google.com/store/apps/details?id=com.happproxy"
                      style={{
                        flex: 1, display: "block", background: "#111827", color: "#FFFFFF",
                        height: "48px", borderRadius: "12px", fontSize: "14px", fontWeight: 600,
                        textDecoration: "none", lineHeight: "48px", textAlign: "center",
                      }}
                    >
                      📥 Happ Android
                    </a>
                    <a
                      href="https://apps.apple.com/app/happ-proxy-utility/id6504287215"
                      style={{
                        flex: 1, display: "block", background: "#111827", color: "#FFFFFF",
                        height: "48px", borderRadius: "12px", fontSize: "14px", fontWeight: 600,
                        textDecoration: "none", lineHeight: "48px", textAlign: "center",
                      }}
                    >
                      📥 Happ iOS
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "24px", lineHeight: "1.5" }}>
                Подписка активирована. Откройте бота @FrostyBot и нажмите /start — появится ссылка на прокси и доступ к VPN.
              </p>
            )}
            <div style={{ textAlign: "center" }}>
              <a
                href={`https://t.me/frostytg_bot?start=sub_${token || ""}`}
                style={{
                  display: "inline-block", background: "#F7F8FA", color: "#374151",
                  padding: "12px 24px", borderRadius: "12px", fontSize: "14px",
                  textDecoration: "none", border: "1px solid #E5E7EB",
                }}
              >
                Перейти в бот @frostytg_bot →
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
