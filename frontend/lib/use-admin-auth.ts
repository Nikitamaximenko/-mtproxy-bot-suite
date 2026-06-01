"use client"

import { ADMIN_STORAGE_KEY, AdminAuthError, clearStoredAdminKey } from "@/lib/admin"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

/** Редирект на /admin если нет ключа; иначе возвращает ключ для API. */
export function useAdminAuth() {
  const router = useRouter()
  const [adminKey, setAdminKey] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let key = ""
    try {
      key = localStorage.getItem(ADMIN_STORAGE_KEY) ?? ""
    } catch {
      /* ignore */
    }
    if (!key) {
      router.replace("/admin")
      return
    }
    setAdminKey(key)
    setReady(true)
  }, [router])

  const logout = useCallback(() => {
    clearStoredAdminKey()
    router.replace("/admin")
  }, [router])

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof AdminAuthError) {
        clearStoredAdminKey()
        router.replace("/admin")
        return true
      }
      return false
    },
    [router],
  )

  return { adminKey, ready, logout, handleAuthError }
}
