"use client"

import { useState } from "react"
import { 
  User, 
  Calendar, 
  Clock, 
  Shield, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronRight,
  Zap,
  Globe
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountScreenProps {
  isPaid: boolean
  isConnected: boolean
}

export function AccountScreen({ isPaid, isConnected }: AccountScreenProps) {
  const [copied, setCopied] = useState(false)
  
  const proxyLink = "tg://proxy?server=proxy.example.com&port=443&secret=..."

  const handleCopy = () => {
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const menuItems = [
    { icon: Calendar, label: "История платежей", action: () => {} },
    { icon: Shield, label: "Безопасность", action: () => {} },
    { icon: Globe, label: "Язык", value: "Русский", action: () => {} },
  ]

  return (
    <div className="min-h-[calc(100vh-80px)] px-6 py-8">
      <div className="max-w-sm mx-auto">
        {/* Profile Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Мой аккаунт</h1>
          {isPaid && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary">
              <Zap className="w-4 h-4" />
              Премиум активен
            </span>
          )}
        </div>

        {/* Subscription Status */}
        {isPaid ? (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Статус</span>
              <span className="flex items-center gap-2 text-sm font-medium text-primary">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Активна
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Следующий платёж</span>
              <span className="text-sm font-medium text-foreground">15 апр 2026</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Тариф</span>
              <span className="text-sm font-medium text-foreground">199 ₽/мес</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              У вас нет активной подписки
            </p>
            <button className="text-primary text-sm font-medium">
              Оформить подписку
            </button>
          </div>
        )}

        {/* Proxy Link */}
        {isPaid && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Ваша ссылка</span>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  copied ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Копировать
                  </>
                )}
              </button>
            </div>
            <div className="bg-background rounded-xl p-3 font-mono text-xs text-muted-foreground break-all">
              {proxyLink}
            </div>
            <a
              href={proxyLink}
              className="flex items-center justify-center gap-2 mt-3 text-sm text-primary font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть в Telegram
            </a>
          </div>
        )}

        {/* Connection Stats */}
        {isPaid && isConnected && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-lg font-semibold text-foreground">24ч</p>
              <p className="text-xs text-muted-foreground">Онлайн сегодня</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Zap className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-lg font-semibold text-foreground">1.2 ГБ</p>
              <p className="text-xs text-muted-foreground">Трафик</p>
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {menuItems.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                onClick={item.action}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/50",
                  i !== menuItems.length - 1 && "border-b border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.value && (
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Logout */}
        <button className="w-full mt-6 py-3 text-sm text-destructive font-medium">
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
