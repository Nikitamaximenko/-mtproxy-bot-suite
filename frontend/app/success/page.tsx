"use client"
import { useEffect, useState } from "react"
import { Manrope } from "next/font/google"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] })

export default function SuccessPage() {
  const [proxyLink, setProxyLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const email = params.get("email") || localStorage.getItem("frosty_email")

    if (!token && !email) { setLoading(false); return }

    const check = async () => {
      try {
        const query = token ? `token=${token}` : `email=${encodeURIComponent(email!)}`
        const res = await fetch(`/api/subscription-status?${query}`)
        const data = await res.json()
        if (data.active && data.proxy_link) {
          setProxyLink(data.proxy_link)
          setLoading(false)
        }
      } catch {}
    }
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [])

  const copy = () => {
    if (!proxyLink) return
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={manrope.className} style={{minHeight:"100vh",background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <div style={{maxWidth:"400px",width:"100%",textAlign:"center"}}>
        <div style={{fontSize:"48px",marginBottom:"16px"}}>❄️</div>
        <h1 style={{fontSize:"24px",fontWeight:700,color:"#111827",marginBottom:"8px"}}>
          {loading ? "Проверяем оплату…" : "✅ Прокси готов!"}
        </h1>
        {loading && (
          <p style={{color:"#6B7280",fontSize:"15px"}}>Обычно занимает несколько секунд</p>
        )}
        {proxyLink && (
          <div>
            <p style={{color:"#6B7280",fontSize:"14px",marginBottom:"20px"}}>
              Нажмите кнопку — Telegram откроется и предложит добавить прокси
            </p>
            <a href={proxyLink} style={{display:"block",background:"#2AABEE",color:"#FFFFFF",height:"56px",borderRadius:"14px",fontSize:"17px",fontWeight:700,textDecoration:"none",lineHeight:"56px",marginBottom:"12px"}}>
              Подключить прокси в Telegram →
            </a>
            <button onClick={copy} style={{width:"100%",background:"#F7F8FA",color:"#374151",height:"48px",borderRadius:"14px",fontSize:"15px",border:"1px solid #E5E7EB",cursor:"pointer",marginBottom:"24px"}}>
              {copied ? "✅ Скопировано!" : "Скопировать ссылку"}
            </button>
            <div style={{background:"#F7F8FA",borderRadius:"16px",padding:"16px",marginBottom:"24px",textAlign:"left"}}>
              <p style={{fontSize:"13px",fontWeight:600,color:"#111827",marginBottom:"8px"}}>Инструкция:</p>
              <p style={{fontSize:"13px",color:"#6B7280",lineHeight:"1.6"}}>
                1. Нажмите «Подключить прокси в Telegram»<br/>
                2. Telegram откроется автоматически<br/>
                3. Нажмите «Добавить» в появившемся окне<br/>
                4. Готово — Telegram работает без ограничений
              </p>
            </div>
            <a href="https://t.me/FrostyBot" style={{display:"block",background:"#F7F8FA",color:"#374151",height:"48px",borderRadius:"14px",fontSize:"15px",textDecoration:"none",lineHeight:"48px",border:"1px solid #E5E7EB"}}>
              Перейти в бот @FrostyBot →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
