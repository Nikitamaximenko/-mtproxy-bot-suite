"use client"

import { useState } from "react"
import { 
  Copy, 
  Check, 
  Zap,
  ChevronRight,
  Snowflake,
  Crown,
  Wifi,
  Server,
  Shield,
  Clock,
  ArrowUpRight,
  Settings,
  HelpCircle,
  CreditCard
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AccountScreenProps {
  isPaid: boolean
  isConnected: boolean
}

export function AccountScreen({ isPaid, isConnected }: AccountScreenProps) {
  const [copied, setCopied] = useState(false)
  
  const proxyLink = "tg://proxy?server=176.123.161.97&port=443&secret=dd645eba01a59f188b5ba9db2564b44a00"

  const handleCopy = () => {
    navigator.clipboard.writeText(proxyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#0066cc]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#00ccff]/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-[#0099ff]/15 rounded-full blur-[80px]" />
      </div>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23noise)"/%3E%3C/svg%3E")' }} />

      <div className="relative z-10 px-5 py-6 pb-28 max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0066cc] to-[#00ccff] flex items-center justify-center">
                <Snowflake className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00ff88] border-2 border-[#0a0f1a]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Frosty</h1>
              <p className="text-xs text-white/50">Premium Active</p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </header>

        {/* Main Status Hero */}
        <div className="relative mb-6">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0066cc]/30 to-transparent rounded-[32px] blur-xl" />
          
          <div className="relative rounded-[32px] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6 backdrop-blur-xl overflow-hidden">
            {/* Decorative lines */}
            <div className="absolute top-0 left-1/4 w-px h-20 bg-gradient-to-b from-[#0066cc]/50 to-transparent" />
            <div className="absolute top-0 right-1/3 w-px h-16 bg-gradient-to-b from-[#00ccff]/30 to-transparent" />
            
            {/* Status indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                {/* Animated rings */}
                <div className="absolute inset-0 w-24 h-24 rounded-full border border-[#0066cc]/20 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-2 w-20 h-20 rounded-full border border-[#00ccff]/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                
                {/* Main orb */}
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#0066cc] via-[#0099ff] to-[#00ccff] flex items-center justify-center shadow-[0_0_60px_rgba(0,102,204,0.5)]">
                  <Snowflake className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Ограничения заморожены</h2>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20">
                <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-sm font-medium text-[#00ff88]">Proxy подключен</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-2xl bg-white/5">
                <Wifi className="w-5 h-5 text-[#0099ff] mx-auto mb-2" />
                <p className="text-lg font-bold text-white">99.9%</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Uptime</p>
              </div>
              <div className="text-center p-3 rounded-2xl bg-white/5">
                <Zap className="w-5 h-5 text-[#ffcc00] mx-auto mb-2" />
                <p className="text-lg font-bold text-white">3x</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Speed</p>
              </div>
              <div className="text-center p-3 rounded-2xl bg-white/5">
                <Server className="w-5 h-5 text-[#00ccff] mx-auto mb-2" />
                <p className="text-lg font-bold text-white">NL</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Server</p>
              </div>
            </div>
          </div>
        </div>

        {/* Proxy Link Card */}
        <div className="rounded-[28px] bg-white/[0.05] border border-white/10 p-5 mb-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#0099ff]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Ссылка на прокси</p>
                <p className="text-xs text-white/40">Нажмите чтобы скопировать</p>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                copied 
                  ? "bg-[#00ff88]/20 text-[#00ff88]" 
                  : "bg-white/5 text-white/60 active:scale-95"
              )}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          
          <button 
            onClick={handleCopy}
            className="w-full text-left p-4 rounded-2xl bg-[#0a0f1a]/50 border border-white/5 active:scale-[0.99] transition-transform"
          >
            <code className="text-xs text-white/50 break-all leading-relaxed">
              {proxyLink}
            </code>
          </button>
          
          <a
            href={proxyLink}
            className="flex items-center justify-center gap-3 mt-4 py-4 rounded-2xl bg-gradient-to-r from-[#0066cc] to-[#0099ff] text-white font-semibold shadow-[0_8px_32px_rgba(0,102,204,0.4)] active:scale-[0.98] transition-transform"
          >
            <Snowflake className="w-5 h-5" />
            Подключить в Telegram
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Subscription Card */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#1a1a2e]/80 to-[#0a0f1a]/80 border border-[#ffd700]/20 p-5 mb-5 backdrop-blur-xl relative overflow-hidden">
          {/* Gold accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffd700]/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffd700] to-[#ff9500] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Premium</p>
                  <p className="text-xs text-white/50">До 3-х устройств</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">1000 <span className="text-sm font-normal text-white/50">₽/мес</span></p>
              </div>
            </div>

            <div className="h-px bg-white/10 my-4" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/50">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Следующий платёж</span>
              </div>
              <span className="text-sm font-semibold text-white">17.04.2026</span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="rounded-[28px] bg-white/[0.03] border border-white/10 overflow-hidden backdrop-blur-xl">
          {[
            { icon: CreditCard, label: "История платежей", desc: "Все транзакции" },
            { icon: HelpCircle, label: "Поддержка", desc: "Написать в Telegram" },
          ].map((item, i) => (
            <button
              key={i}
              className={cn(
                "w-full flex items-center justify-between px-5 py-4",
                "transition-colors active:bg-white/5",
                i !== 1 && "border-b border-white/5"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-white/60" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-white/40">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button className="w-full mt-5 py-4 rounded-2xl text-sm font-medium text-[#ff4444]/80 bg-[#ff4444]/5 border border-[#ff4444]/10 active:bg-[#ff4444]/10 transition-colors">
          Выйти из аккаунта
        </button>
      </div>

      {/* Copied Toast */}
      <div className={cn(
        "fixed bottom-28 left-1/2 -translate-x-1/2 z-50",
        "px-5 py-3 rounded-full bg-[#00ff88] text-[#0a0f1a] font-semibold text-sm",
        "shadow-[0_8px_32px_rgba(0,255,136,0.3)] flex items-center gap-2",
        "transition-all duration-300",
        copied ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}>
        <Check className="w-4 h-4" />
        Скопировано
      </div>
    </div>
  )
}
