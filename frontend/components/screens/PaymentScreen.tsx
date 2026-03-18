"use client"

import { useState } from "react"
import { Check, CreditCard, Smartphone, Snowflake, ArrowRight, Shield, Zap, Clock, Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaymentScreenProps {
  onSuccess: () => void
}

type PaymentMethod = "card" | "sbp"

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
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#0066cc]/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[#00ccff]/10 rounded-full blur-[100px]" />
      </div>

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23noise)"/%3E%3C/svg%3E")' }} />

      <div className="relative z-10 px-5 py-8 max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Glow */}
            <div className="absolute inset-0 bg-[#0066cc]/30 rounded-full blur-2xl" />
            {/* Icon container */}
            <div className="relative w-full h-full bg-gradient-to-br from-[#0066cc] via-[#0099ff] to-[#00ccff] rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(0,102,204,0.4)]">
              <Snowflake className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
            {/* Sparkle */}
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[#ffcc00] flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-[#0a0f1a]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Заморозь ограничения</h1>
          <p className="text-white/50 text-sm">Telegram без блокировок за 299 ₽/мес</p>
        </div>

        {/* Main Card */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0066cc]/20 to-transparent rounded-[32px] blur-xl" />
          
          <div className="relative rounded-[32px] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6 backdrop-blur-xl">
            
            {/* Price */}
            <div className="text-center mb-8">
              <div className="inline-flex items-baseline">
                <span className="text-6xl font-bold text-white">299</span>
                <span className="text-xl text-white/50 ml-2">₽/мес</span>
              </div>
              <p className="text-[#00ccff] text-sm font-medium mt-2">Отмена в любой момент</p>
            </div>
            
            {/* Features */}
            <div className="space-y-4 mb-8">
              {[
                { icon: Zap, text: "Telegram без ограничений", color: "#ffcc00" },
                { icon: Clock, text: "Стабильное соединение 24/7", color: "#00ccff" },
                { icon: Shield, text: "Безопасно и анонимно", color: "#00ff88" },
                { icon: Lock, text: "Не мешает VPN", color: "#ff66cc" },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                  </div>
                  <span className="text-white/80">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

            {/* Email Input */}
            <div className="mb-5">
              <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider">Email для чека</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#0066cc]/50 focus:bg-white/[0.07] transition-all"
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="mb-6">
              <label className="text-xs text-white/40 mb-3 block uppercase tracking-wider">Способ оплаты</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "card" as const, icon: CreditCard, label: "Карта" },
                  { id: "sbp" as const, icon: Smartphone, label: "СБП" },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={cn(
                      "flex items-center justify-center gap-3 h-14 rounded-2xl border transition-all",
                      selectedMethod === method.id
                        ? "bg-[#0066cc]/20 border-[#0066cc]/50 text-white"
                        : "bg-white/[0.02] border-white/10 text-white/50 hover:bg-white/5"
                    )}
                  >
                    <method.icon className="w-5 h-5" />
                    <span className="font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={!email || isProcessing}
              className={cn(
                "w-full h-16 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-3",
                email && !isProcessing
                  ? "bg-gradient-to-r from-[#0066cc] via-[#0099ff] to-[#00ccff] text-white shadow-[0_8px_40px_rgba(0,102,204,0.4)] hover:shadow-[0_8px_50px_rgba(0,102,204,0.5)] active:scale-[0.98]"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              <p className="text-sm text-[#ff4444] text-center mt-4 px-4">{error}</p>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-8 text-xs text-white/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Безопасная оплата</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Гарантия возврата</span>
          </div>
        </div>
      </div>
    </div>
  )
}
