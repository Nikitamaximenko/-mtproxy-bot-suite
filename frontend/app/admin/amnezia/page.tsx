"use client"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import {
  AdminAuthError,
  clearStoredAdminKey,
  fetchAdminJson,
  getStoredAdminKey,
} from "@/lib/admin"
import { Leaf, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type AmneziaItem = {
  telegram_id: number
  vpn_key: string
  key_format: string
  label: string | null
  active: boolean
  has_key: boolean
  updated_at: string | null
}

type ListResponse = { items: AmneziaItem[]; max_slots: number }

export default function AdminAmneziaPage() {
  const router = useRouter()
  const [key, setKey] = useState("")
  const [items, setItems] = useState<AmneziaItem[]>([])
  const [maxSlots, setMaxSlots] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tgId, setTgId] = useState("")
  const [vpnKey, setVpnKey] = useState("")
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (adminKey: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminJson<ListResponse>("/api/admin/amnezia-access", adminKey)
      setItems(data.items || [])
      setMaxSlots(data.max_slots ?? 7)
    } catch (e) {
      if (e instanceof AdminAuthError) {
        clearStoredAdminKey()
        router.replace("/admin")
        return
      }
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const k = getStoredAdminKey()
    if (!k) {
      router.replace("/admin")
      return
    }
    setKey(k)
    load(k)
  }, [load, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!key) return
    const id = parseInt(tgId.trim(), 10)
    if (!id || id <= 0) {
      setError("Укажите числовой Telegram ID")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await fetchAdminJson<AmneziaItem>("/api/admin/amnezia-access", key, {
        method: "POST",
        body: JSON.stringify({
          telegram_id: id,
          vpn_key: vpnKey.trim() || undefined,
          label: label.trim() || undefined,
          key_format: vpnKey.trim().startsWith("[") ? "conf" : "vpn",
          active: true,
        }),
      })
      setTgId("")
      setVpnKey("")
      setLabel("")
      await load(key)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(telegramId: number) {
    if (!key || !confirm(`Удалить доступ Amnezia для ${telegramId}?`)) return
    try {
      await fetchAdminJson<{ ok: boolean }>(
        `/api/admin/amnezia-access/${telegramId}`,
        key,
        { method: "DELETE" }
      )
      await load(key)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить")
    }
  }

  const activeCount = items.filter((i) => i.active).length

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="lg:pl-64 p-4 lg:p-8">
        <AdminHeader
          title="Amnezia VPN"
          subtitle={`Отдельная ветка для РФ · слотов ${activeCount}/${maxSlots}`}
        />

        <div className="max-w-3xl space-y-6">
          <p className="text-sm text-muted-foreground">
            Установка на VPS — через приложение{" "}
            <a href="https://amnezia.org/ru" className="text-primary underline" target="_blank" rel="noreferrer">
              AmneziaVPN
            </a>
            . Гостевой ключ <code className="text-xs">vpn://…</code> из Share → Share VPN Access.
            Инструкция в репозитории: <code className="text-xs">docs/AMNEZIA_SETUP.md</code>
          </p>

          <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" /> Добавить / обновить
            </h2>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Telegram ID"
              value={tgId}
              onChange={(e) => setTgId(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Метка (необязательно)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono min-h-[100px]"
              placeholder="vpn://… или содержимое .conf"
              value={vpnKey}
              onChange={(e) => setVpnKey(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border font-semibold flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-600" />
              Whitelist
            </div>
            {loading ? (
              <p className="p-5 text-sm text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Пока никого нет.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.telegram_id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{item.telegram_id}</p>
                      {item.label && <p className="text-xs text-muted-foreground">{item.label}</p>}
                      <p className="text-xs mt-1">
                        {item.has_key ? "✅ ключ выдан" : "⏳ без ключа"} · {item.active ? "активен" : "выкл"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.telegram_id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
