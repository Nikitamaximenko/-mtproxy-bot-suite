"use client"

import { AdminOperationsPanel } from "@/components/admin/AdminOperationsPanel"
import { AdminPageChrome } from "@/components/admin/AdminPageChrome"
import {
  AdminAuthError,
  Stats,
  clearStoredAdminKey,
  fetchAdminJson,
  getStoredAdminKey,
} from "@/lib/admin"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const REFRESH_MS = 30000

export default function OperationsPage() {
  const router = useRouter()
  const [adminKey, setAdminKey] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(
    async (key: string) => {
      setLoading(true)
      setError("")
      try {
        const rawStats = await fetchAdminJson<Stats & { marketing_opt_out_users?: number }>(
          "/api/admin/stats",
          key,
        )
        setStats({
          ...rawStats,
          marketing_opt_out_users: rawStats.marketing_opt_out_users ?? 0,
        })
      } catch (err) {
        if (err instanceof AdminAuthError) {
          clearStoredAdminKey()
          router.replace("/admin")
          return
        }
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные")
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  useEffect(() => {
    const key = getStoredAdminKey()
    if (!key) {
      router.replace("/admin")
      return
    }
    setAdminKey(key)
    void loadData(key)
  }, [loadData, router])

  useEffect(() => {
    if (!adminKey) return
    const timer = setInterval(() => {
      void loadData(adminKey)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [adminKey, loadData])

  const handleRefresh = useCallback(() => {
    if (adminKey) void loadData(adminKey)
  }, [adminKey, loadData])

  return (
    <AdminPageChrome
      title="Операции"
      subtitle="Рассылка, самотест prod, очистка БД"
      note="Автообновление статистики каждые 30 секунд"
    >
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      ) : null}

      {loading && !stats ? (
        <div className="rounded-xl bg-secondary/50 border border-border px-4 py-10 text-center text-muted-foreground mb-6">
          Загружаю данные для операций…
        </div>
      ) : null}

      {adminKey ? (
        <AdminOperationsPanel
          adminKey={adminKey}
          stats={stats}
          onRefresh={handleRefresh}
          onError={setError}
        />
      ) : null}
    </AdminPageChrome>
  )
}
