"use client"

import { useState } from "react"
import { Check, CreditCard, Smartphone, Bitcoin, ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { openTelegramLink } from "@/lib/telegram"

interface PaymentScreenProps {
  onSuccess: () => void
  tgId: number
  username?: string
  priceRub: number
}

type PaymentMethod = "card" | "sbp" | "crypto"

const paymentMethods = [
  { id: "card" as PaymentMethod, label: "Карта", icon: CreditCard, badge: "Популярно" },
  { id: "sbp" as PaymentMethod, label: "СБП", icon: Smartphone, badge: "Быстро" },
  { id: "crypto" as PaymentMethod, label: "Крипто", icon: Bitcoin, badge: null },
]

const features = [
  "Telegram на максимальной скорости",
  "Подключение за 10 секунд",
  "Работает автоматически 24/7",
  "Не нужно включать/выключать",
]

export function PaymentScreen({ onSuccess, tgId, username, priceRub }: PaymentScreenProps) {
  const [email, setEmail] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("card")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)

  const handlePayment = async () => {
    if (!email) return
    setIsProcessing(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: tgId, username, email }),
      })
      const data = await res.json()
      if (!res.ok || !data?.payment_url) {
        throw new Error(data?.error || "Не удалось создать оплату")
      }
      setPaymentUrl(String(data.payment_url))
      // If payment page is embeddable, iframe will show it.
      // Otherwise user can tap the button below to open in Telegram browser.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Что-то пошло не так"
      setError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] px-6 py-8">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Подписка</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Верните Telegram как было раньше
          </p>
        </div>

        {/* Price Card */}
        <div className="bg-card border border-primary/30 rounded-2xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <span className="text-4xl font-bold text-foreground">{priceRub}</span>
              <span className="text-lg text-muted-foreground ml-1">₽/мес</span>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              Выгодно
            </span>
          </div>
          <ul className="space-y-3">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Email Input */}
        <div className="mb-6">
          <label className="text-sm text-muted-foreground mb-2 block">Email</label>
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-card border-border rounded-xl text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Payment Methods */}
        <div className="mb-6">
          <label className="text-sm text-muted-foreground mb-3 block">Способ оплаты</label>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((method) => {
              const Icon = method.icon
              const isSelected = selectedMethod === method.id
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                    isSelected
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {method.badge && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      {method.badge}
                    </span>
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{method.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={!email || isProcessing}
          className="w-full h-14 rounded-xl text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Обработка...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Оплатить {priceRub} ₽
              <ArrowRight className="w-5 h-5" />
            </span>
          )}
        </Button>

        {paymentUrl && (
          <div className="mt-6">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <iframe title="Оплата" src={paymentUrl} className="w-full h-[70vh] bg-background" />
            </div>
            <Button
              onClick={() => openTelegramLink(paymentUrl)}
              variant="secondary"
              className="w-full h-12 rounded-xl mt-3"
            >
              Открыть оплату в браузере Telegram
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive text-center mt-3">
            {error}
          </p>
        )}

        {/* Terms */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Нажимая кнопку, вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  )
}
