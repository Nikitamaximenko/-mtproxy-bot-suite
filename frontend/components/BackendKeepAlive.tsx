"use client"

import { useEffect } from "react"

/** Пингует /api/ping → бэкенд /health, чтобы Railway не засыпал от долгой неактивности. */
export function BackendKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/ping").catch(() => {})
    }
    ping()
    const id = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return null
}
