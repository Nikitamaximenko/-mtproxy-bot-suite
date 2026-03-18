"use client"

import { useState } from "react"
import { Check, CreditCard, Smartphone, Snowflake, ArrowRight, Shield, Zap, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaymentScreenProps {
  onSuccess: () => void
}

type PaymentMethod = "card" | "sbp"

const features = [
  { icon: Zap, text: "Telegram без ограничений" },
  { icon: Clock, text: "Стабильное соединение 24/7" },
  { icon: Shield, text: "Безопасно и анонимно" },
]

export function PaymentScreen({ onSuccess }: PaymentScreenProps) {
  const [email, setEmail] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("card")
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
    <div className="min-h-[calc(100vh-80px)] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" />
      
      {/* Ambient light */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 px-6 py-8 max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl" />
            <div className="relative w-full h-full bg-gradient-to-br from-primary/30 to-cyan-600/20 rounded-3xl border border-primary/30 flex items-center justify-center">
              <Snowflake className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Заморозить ограничения</h1>
          <p className="text-slate-400 text-sm">Подписка 299 ₽/мес — отмена в любой момент</p>
        </div>

        {/* Price Card */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-cyan-600/20 rounded-3xl blur-xl" />
          <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-6">
            {/* Price */}
            <div className="text-center mb-6">
              <div className="inline-flex items-baseline">
                <span className="text-5xl font-bold text-white">299</span>
                <span className="text-xl text-slate-400 ml-2">₽/мес</span>
              </div>
              <p className="text-primary text-sm font-medium mt-1">Ежемесячная подписка</p>
            </div>
            
            {/* Features */}
            <div className="space-y-3 mb-6">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-slate-300">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-6" />

            {/* Email Input */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 mb-2 block">Email для чека</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Payment Methods */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 mb-2 block">Способ оплаты</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedMethod("card")}
                  className={cn(
                    "flex items-center justify-center gap-2 h-12 rounded-xl border transition-all",
                    selectedMethod === "card"
                      ? "bg-primary/10 border-primary/50 text-white"
                      : "bg-slate-900/30 border-slate-700/50 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">Карта</span>
                </button>
                <button
                  onClick={() => setSelectedMethod("sbp")}
                  className={cn(
                    "flex items-center justify-center gap-2 h-12 rounded-xl border transition-all",
                    selectedMethod === "sbp"
                      ? "bg-primary/10 border-primary/50 text-white"
                      : "bg-slate-900/30 border-slate-700/50 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm font-medium">СБП</span>
                </button>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={!email || isProcessing}
              className={cn(
                "w-full h-14 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2",
                email && !isProcessing
                  ? "bg-gradient-to-r from-primary to-cyan-500 text-white shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.4)]"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  Оплатить 299 ₽
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {error && (
              <p className="text-xs text-red-400 text-center mt-3">{error}</p>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Безопасная оплата</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Гарантия возврата</span>
          </div>
        </div>
      </div>
    </div>
  )
}
