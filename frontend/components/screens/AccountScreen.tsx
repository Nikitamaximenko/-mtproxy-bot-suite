"use client"

import { useState, useEffect } from "react"
import { 
  Calendar, 
  Clock, 
  Shield, 
  Copy, 
  Check, 
  Zap,
  Globe,
  Sparkles,
  ChevronRight,
  Snowflake,
  Crown,
  Activity,
  ArrowUpRight
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountScreenProps {
  isPaid: boolean
  isConnected: boolean
}

// Animated Frost Background
function FrostBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/3" />
      
      {/* Floating ice crystals */}
      <div className="absolute top-10 left-[10%] w-20 h-20 rounded-3xl ice-block opacity-40 animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute top-32 right-[15%] w-14 h-14 rounded-2xl ice-block opacity-30 animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-40 left-[5%] w-16 h-16 rounded-2xl ice-block opacity-25 animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-20 right-[10%] w-12 h-12 rounded-xl ice-block opacity-35 animate-float" style={{ animationDelay: '0.5s' }} />
    </div>
  )
}

// Animated Status Orb
function StatusOrb({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative">
      <div className={cn(
        "w-3 h-3 rounded-full",
        isActive ? "bg-success" : "bg-muted"
      )} />
      {isActive && (
        <>
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-success animate-ping opacity-75" />
          <div className="absolute -inset-1 w-5 h-5 rounded-full bg-success/20 animate-pulse" />
        </>
      )}
    </div>
  )
}

// Premium Badge
function PremiumBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/20">
      <Crown className="w-4 h-4 text-amber-500" />
      <span className="text-sm font-semibold text-amber-600">Premium</span>
      <Sparkles className="w-3 h-3 text-amber-500" />
    </div>
  )
}

// Glass Card Component
function GlassCard({ children, className, glow = false }: { children: React.ReactNode, className?: string, glow?: boolean }) {
  return (
    <div className={cn(
      "relative rounded-3xl bg-card/80 backdrop-blur-xl border border-border/50",
      "shadow-lg shadow-primary/5",
      glow && "frost-glow",
      className
    )}>
      {children}
    </div>
  )
}

// Connection Animation
function ConnectionPulse() {
  return (
    <div className="relative w-20 h-20 mx-auto mb-6">
      {/* Outer rings */}
      <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      
      {/* Main icon container */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary to-ice flex items-center justify-center frost-glow">
        <Snowflake className="w-6 h-6 text-white" />
      </div>
    </div>
  )
}

export function AccountScreen({ isPaid, isConnected }: AccountScreenProps) {
  const [copied, setCopied] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const proxyLink = "tg://proxy?server=176.123.161.97&port=443&secret=dd645eba01a59f188b5ba9db2564b44a00"

  const handleCopy = () => {
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setShowSuccess(true)
    setTimeout(() => setCopied(false), 2000)
    setTimeout(() => setShowSuccess(false), 2500)
  }

  const menuItems = [
    { icon: Calendar, label: "История платежей", badge: null },
    { icon: Shield, label: "Безопасность", badge: null },
    { icon: Globe, label: "Язык", badge: "RU" },
  ]

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FrostBackground />
      
      <div className="relative z-10 px-5 py-6 pb-24 max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ice flex items-center justify-center frost-glow">
              <Snowflake className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">Frosty</span>
          </div>
          {isPaid && <PremiumBadge />}
        </header>

        {/* Main Status Card */}
        <GlassCard className="p-6 mb-5" glow={isPaid && isConnected}>
          <ConnectionPulse />
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isPaid ? "Подписка активна" : "Нет подписки"}
            </h1>
            
            <div className="flex items-center justify-center gap-2 text-sm">
              <StatusOrb isActive={isPaid && isConnected} />
              <span className={cn(
                "font-medium",
                isPaid && isConnected ? "text-success" : "text-muted-foreground"
              )}>
                {isPaid && isConnected ? "Ограничения заморожены" : "Не подключено"}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Proxy Link Card */}
        {isPaid && (
          <GlassCard className="p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">Ваша ссылка на прокси</span>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "active:scale-95 touch-manipulation",
                  copied 
                    ? "bg-success/10 text-success" 
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
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
            
            {/* Styled proxy link display */}
            <div className="relative group">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-ice/10 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-secondary/50 rounded-2xl p-4 font-mono text-xs text-muted-foreground break-all border border-border/30">
                {proxyLink}
              </div>
            </div>
            
            {/* Connect Button */}
            <a
              href={proxyLink}
              className={cn(
                "flex items-center justify-center gap-3 mt-4 py-4 rounded-2xl",
                "bg-gradient-to-r from-primary to-ice text-white font-semibold text-base",
                "shadow-lg shadow-primary/25 frost-glow",
                "active:scale-[0.98] transition-transform touch-manipulation"
              )}
            >
              <Snowflake className="w-5 h-5" />
              Подключить в Telegram
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </GlassCard>
        )}

        {/* Stats Grid */}
        {isPaid && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Скорость</span>
              </div>
              <p className="text-2xl font-bold text-foreground">3x</p>
              <p className="text-xs text-muted-foreground mt-1">быстрее обычного</p>
            </GlassCard>
            
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-success" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Uptime</span>
              </div>
              <p className="text-2xl font-bold text-foreground">99.9%</p>
              <p className="text-xs text-muted-foreground mt-1">доступность</p>
            </GlassCard>
          </div>
        )}

        {/* Subscription Info */}
        {isPaid && (
          <GlassCard className="p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Тариф Premium</p>
                <p className="text-xs text-muted-foreground">До 3-х устройств</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold text-foreground">1000 ₽</p>
                <p className="text-xs text-muted-foreground">в месяц</p>
              </div>
            </div>
            
            <div className="h-px bg-border/50 my-4" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Следующий платёж</span>
              <span className="font-semibold text-foreground">17.04.2026</span>
            </div>
          </GlassCard>
        )}

        {/* Menu Items */}
        <GlassCard className="overflow-hidden">
          {menuItems.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4",
                  "transition-colors hover:bg-secondary/50 active:bg-secondary/70",
                  "touch-manipulation",
                  i !== menuItems.length - 1 && "border-b border-border/30"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="px-2 py-1 text-xs font-medium text-muted-foreground bg-secondary rounded-md">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </GlassCard>

        {/* Logout Button */}
        <button className={cn(
          "w-full mt-5 py-4 rounded-2xl text-sm font-medium",
          "text-destructive bg-destructive/5 border border-destructive/10",
          "hover:bg-destructive/10 active:bg-destructive/15",
          "transition-colors touch-manipulation"
        )}>
          Выйти из аккаунта
        </button>
      </div>

      {/* Success Toast */}
      <div className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50",
        "px-5 py-3 rounded-2xl bg-success text-white font-medium text-sm",
        "shadow-lg shadow-success/25 flex items-center gap-2",
        "transition-all duration-300",
        showSuccess ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <Check className="w-4 h-4" />
        Ссылка скопирована
      </div>
    </div>
  )
}
