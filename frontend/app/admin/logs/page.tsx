"use client"

import { AdminLogsPanel } from "@/components/admin/AdminLogsPanel"
import { AdminPageChrome } from "@/components/admin/AdminPageChrome"
import { AdminAuthError, clearStoredAdminKey, getStoredAdminKey } from "@/lib/admin"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

export default function AdminLogsPage() {
  const router = useRouter()
  const [adminKey, setAdminKey] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const key = getStoredAdminKey()
    if (!key) {
      router.replace("/admin")
      return
    }
    setAdminKey(key)
  }, [router])

  const onError = useCallback(
    (msg: string) => {
      if (msg === new AdminAuthError().message) {
        clearStoredAdminKey()
        router.replace("/admin")
        return
      }
      setError(msg)
    },
    [router],
  )

  return (
    <AdminPageChrome
      title="Логи"
      subtitle="Checkout-платежи и диалоги ИИ-поддержки"
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {adminKey ? <AdminLogsPanel adminKey={adminKey} onError={onError} /> : null}
    </AdminPageChrome>
  )
}
