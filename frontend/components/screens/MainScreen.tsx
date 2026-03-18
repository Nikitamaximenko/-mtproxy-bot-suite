"use client"

import { useState, useEffect } from "react"
import { Shield, Zap, Snowflake, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface MainScreenProps {
  isConnected: boolean
  isPaid: boolean
  onConnect: () => void
}

export function MainScreen({ isConnected, isPaid, onConnect }: MainScreenProps) {
  const [connectionTime, setConnectionTime] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isConnected) {
      interval = setInterval(() => {
        setConnectionTime((prev) => prev + 1)
      }, 1000)
    } else {
      setConnectionTime(0)
    }
    return () => clearInterval(interval)
  }, [isConnected])

  const handleConnect = async () => {
    if (!isPaid) {
      onConnect()
      return
    }
    
    if (!isConnected) {
      setIsConnecting(true)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setIsConnecting(false)
    }
    onConnect()
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-[calc(100vh-80px)] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628]" />
      
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-48 h-48 bg-cyan-500/15 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-8">
        
        {/* Main Frost Button */}
        <div className="relative mb-8">
          {/* Outer glow rings */}
          {isConnected && (
            <>
              <div className="absolute inset-0 w-52 h-52 -m-4 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 w-56 h-56 -m-6 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
            </>
          )}
          
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={cn(
              "relative w-44 h-44 rounded-full transition-all duration-700 flex items-center justify-center",
              "border-2",
              isConnected
                ? "bg-gradient-to-br from-primary/30 to-cyan-600/20 border-primary/50 shadow-[0_0_60px_rgba(56,189,248,0.3)]"
                : "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-600/30 hover:border-primary/30 hover:shadow-[0_0_40px_rgba(56,189,248,0.15)]",
              isConnecting && "scale-95"
            )}
          >
            {/* Inner frost pattern */}
            <div className={cn(
              "absolute inset-3 rounded-full transition-all duration-700",
              isConnected 
                ? "bg-gradient-to-br from-primary/20 to-transparent" 
                : "bg-gradient-to-br from-slate-700/50 to-transparent"
            )} />
            
            {/* Center icon */}
            <div className={cn(
              "relative z-10 transition-all duration-500",
              isConnecting && "animate-spin"
            )}>
              <Snowflake
                className={cn(
                  "w-16 h-16 transition-all duration-500",
                  isConnected ? "text-primary drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]" : "text-slate-400"
                )}
                strokeWidth={1.5}
              />
            </div>

            {/* Success checkmark overlay */}
            {isConnected && !isConnecting && (
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="text-center mb-6">
          <h1 className={cn(
            "text-2xl font-bold mb-2 transition-colors duration-500",
            isConnected ? "text-primary" : "text-white"
          )}>
            {isConnecting
              ? "Подключение..."
              : isConnected
                ? "Ограничения заморожены"
                : "Нажмите для подключения"}
          </h1>
          <p className="text-slate-400 text-sm">
            {isConnected
              ? "Telegram работает без ограничений"
              : isPaid
                ? "Один клик — и готово"
                : "Оформите подписку для начала"}
          </p>
        </div>

        {/* Connection Timer */}
        {isConnected && (
          <div className="mb-8 px-6 py-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
            <p className="text-3xl font-mono font-light text-white tracking-wider text-center">
              {formatTime(connectionTime)}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <div className={cn(
            "rounded-2xl p-4 text-center backdrop-blur-sm border transition-all duration-500",
            isConnected 
              ? "bg-primary/10 border-primary/30" 
              : "bg-slate-800/50 border-slate-700/30"
          )}>
            <Shield className={cn(
              "w-6 h-6 mx-auto mb-2 transition-colors duration-500",
              isConnected ? "text-primary" : "text-slate-500"
            )} />
            <p className="text-xs text-slate-400 mb-1">Защита</p>
            <p className={cn(
              "text-sm font-semibold transition-colors duration-500",
              isConnected ? "text-emerald-400" : "text-slate-500"
            )}>
              {isConnected ? "Активна" : "Выкл"}
            </p>
          </div>
          <div className={cn(
            "rounded-2xl p-4 text-center backdrop-blur-sm border transition-all duration-500",
            isConnected 
              ? "bg-primary/10 border-primary/30" 
              : "bg-slate-800/50 border-slate-700/30"
          )}>
            <Zap className={cn(
              "w-6 h-6 mx-auto mb-2 transition-colors duration-500",
              isConnected ? "text-primary" : "text-slate-500"
            )} />
            <p className="text-xs text-slate-400 mb-1">Скорость</p>
            <p className={cn(
              "text-sm font-semibold transition-colors duration-500",
              isConnected ? "text-white" : "text-slate-500"
            )}>
              {isConnected ? "Максимум" : "—"}
            </p>
          </div>
        </div>

        {/* Promo Banner */}
        {!isPaid && (
          <div className="mt-8 w-full max-w-xs">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 to-cyan-600/20 p-4 border border-primary/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10" />
              <p className="relative text-center text-white text-sm">
                Заморозь ограничения навсегда
                <br />
                <span className="text-primary font-bold text-lg">299 ₽</span>
                <span className="text-slate-400 text-xs ml-1">разовый платеж</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
