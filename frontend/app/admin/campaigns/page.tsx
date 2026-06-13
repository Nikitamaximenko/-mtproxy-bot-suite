"use client"

import { AdminCampaignsPanel } from "@/components/admin/AdminCampaignsPanel"
import { AdminPageChrome } from "@/components/admin/AdminPageChrome"
import { AdminAuthError, clearStoredAdminKey, getStoredAdminKey } from "@/lib/admin"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

export default function CampaignsPage() {
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

  const handleError = useCallback(
    (msg: string) => {
      if (msg.includes("403")) {
        clearStoredAdminKey()
        router.replace("/admin")
        return
      }
      setError(msg)
    },
    [router],
  )

  if (!adminKey) return null

  return (
    <AdminPageChrome
      title="Кампании"
      subtitle="Push-рассылки, drip-цепочки, A/B тесты текстов и статистика конверсии"
    >
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      ) : null}
      <AdminCampaignsPanel adminKey={adminKey} onError={handleError} />
    </AdminPageChrome>
  )
}
