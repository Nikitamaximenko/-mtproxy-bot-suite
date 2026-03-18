"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { MainScreen } from "@/components/screens/MainScreen"
import { PaymentScreen } from "@/components/screens/PaymentScreen"
import { AccountScreen } from "@/components/screens/AccountScreen"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTelegramUser, openTelegramLink } from "@/lib/telegram"

type SubscriptionData = {
  active: boolean
  expires_at?: string | null
  proxy_link?: string | null
}

function getTgIdFallbackFromUrl(): number | null {
  const tgId = new URLSearchParams(window.location.search).get("tg_id")
  const n = Number(tgId)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function MiniAppPage() {
  const tgUser = useMemo(() => getTelegramUser(), [])
  const [tgId, setTgId] = useState<number | null>(tgUser?.id ?? null)
  const [tab, setTab] = useState<"main" | "pay" | "account">("main")
  const [isConnected, setIsConnected] = useState(false)
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tgId) setTgId(getTgIdFallbackFromUrl())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(async () => {
    if (!tgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/subscription?tg_id=${tgId}`, { cache: "no-store" })
      const data = (await res.json()) as SubscriptionData
      setSub(res.ok ? data : null)
    } finally {
      setLoading(false)
    }
  }, [tgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isPaid = !!sub?.active
  const expiresAt = sub?.expires_at ?? null
  const proxyLink = sub?.proxy_link ?? null

  const handleConnect = () => {
    if (!isPaid) {
      setTab("pay")
      return
    }
    if (proxyLink) {
      openTelegramLink(proxyLink)
      setIsConnected(true)
      return
    }
    setTab("account")
  }

  if (!tgId) {
    return (
      <div className="min-h-screen px-6 py-10 text-center text-muted-foreground">
        Откройте мини‑апп из Telegram.
      </div>
    )
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="min-h-screen">
      <div className="px-4 pt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="main">Главная</TabsTrigger>
          <TabsTrigger value="pay">Оплата</TabsTrigger>
          <TabsTrigger value="account">Аккаунт</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="main">
        <MainScreen isConnected={isConnected} isPaid={isPaid} onConnect={handleConnect} />
      </TabsContent>

      <TabsContent value="pay">
        <PaymentScreen
          tgId={tgId}
          username={tgUser?.username}
          priceRub={500}
          onSuccess={async () => {
            await refresh()
            setTab("main")
          }}
        />
        {loading && (
          <p className="text-xs text-muted-foreground text-center mt-3">Проверяем статус…</p>
        )}
      </TabsContent>

      <TabsContent value="account">
        <AccountScreen isPaid={isPaid} isConnected={isConnected} proxyLink={proxyLink} expiresAt={expiresAt} priceRub={500} />
      </TabsContent>
    </Tabs>
  )
}

