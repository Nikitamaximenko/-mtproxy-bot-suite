"use client"

import { useEffect, useState } from "react"

export function VpsStatusBanner() {
  const [status, setStatus] = useState<"loading" | "up" | "down">("loading")

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/api/ping", { cache: "no-store" })
        const data = (await res.json()) as { ok?: boolean }
        if (!cancelled) setStatus(data.ok ? "up" : "down")
      } catch {
        if (!cancelled) setStatus("down")
      }
    }
    void check()
    const id = setInterval(() => void check(), 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (status !== "down") return null

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3 text-center text-sm text-foreground">
      <strong className="font-semibold">VPN временно недоступен</strong> — сервер восстанавливается.
      Подключение заработает после перезапуска. Вопросы:{" "}
      <a href="https://t.me/frostytg_bot" className="underline font-medium">
        @frostytg_bot
      </a>
    </div>
  )
}
