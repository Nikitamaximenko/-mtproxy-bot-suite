"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PaymentScreenProps {
  onSuccess: () => void
}

export function PaymentScreen({ onSuccess }: PaymentScreenProps) {
  const [email, setEmail] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    if (!email) return
    setIsProcessing(true)
    setError(null)
    try {
      const tgId = new URLSearchParams(window.location.search).get("tg_id")
      if (!tgId || Number(tgId) < 1) {
        throw new Error("Откройте эту страницу из Telegram")
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: Number(tgId), email }),
      })
      const data = await res.json()
      if (!res.ok || !data?.payment_url) {
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      window.location.href = data.payment_url
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Что-то пошло не так"
      setError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">
            Telegram работает в России
          </h1>
          <p className="text-[#8E8E93]">
            Подключение за 10 секунд
          </p>
        </div>

        {/* Price card */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <span className="text-5xl font-bold text-[#1A1A1A]">299</span>
            <span className="text-xl text-[#8E8E93] ml-1">₽/мес</span>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {[
              "Telegram без ограничений",
              "Стабильное соединение 24/7",
              "Не мешает VPN"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[#34C759]">✓</span>
                <span className="text-[#1A1A1A]">{feature}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-[#E8E8E8] mb-6" />

          {/* Email */}
          <div className="mb-5">
            <label className="text-sm text-[#8E8E93] mb-2 block">Email для чека</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 px-4 bg-[#F5F5F5] rounded-[14px] text-[#1A1A1A] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-[#FF3B30] text-center mb-4">{error}</p>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 safe-area-bottom">
        <button
          onClick={handlePayment}
          disabled={!email || isProcessing}
          className={cn(
            "w-full h-14 rounded-[14px] font-semibold text-lg transition-all flex items-center justify-center",
            email && !isProcessing
              ? "bg-[#2AABEE] text-white active:opacity-90"
              : "bg-[#F5F5F5] text-[#C7C7CC]"
          )}
        >
          {isProcessing ? (
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Оплатить 299 ₽"
          )}
        </button>
        
        <p className="text-center text-[#8E8E93] text-sm mt-4">
          Отмена подписки в любой момент
        </p>
      </div>
    </div>
  )
}
