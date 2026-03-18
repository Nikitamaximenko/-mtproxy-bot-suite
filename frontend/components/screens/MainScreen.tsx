"use client"

import { useState, useEffect } from "react"
import { Shield, Zap, Snowflake, Check, Wifi, Lock } from "lucide-react"
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
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] transition-all duration-1000",
          isConnected ? "bg-[#0066cc]/30" : "bg-[#1a1a2e]/50"
        )} />
        <div className={cn(
          "absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px] transition-all duration-1000",
          isConnected ? "bg-[#00ccff]/15" : "bg-[#0a0f1a]"
        )} />
        <div className={cn(
          "absolute top-0 right-0 w-[250px] h-[250px] rounded-full blur-[80px] transition-all duration-1000",
          isConnected ? "bg-[#0099ff]/20" : "bg-[#0a0f1a]"
        )} />
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-8">
        
        {/* Main Frost Orb */}
        <div className="relative mb-10">
          {/* Outer animated rings */}
          {isConnected && (
            <>
              <div className="absolute inset-0 w-56 h-56 -m-7 rounded-full border border-[#0066cc]/20 animate-[ping_3s_ease-in-out_infinite]" />
              <div className="absolute inset-0 w-60 h-60 -m-9 rounded-full border border-[#00ccff]/10 animate-[ping_4s_ease-in-out_infinite_0.5s]" />
              <div className="absolute inset-0 w-64 h-64 -m-11 rounded-full border border-[#0099ff]/5 animate-[ping_5s_ease-in-out_infinite_1s]" />
            </>
          )}
          
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={cn(
              "relative w-44 h-44 rounded-full transition-all duration-700",
              "before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-700",
              isConnected
                ? "before:bg-gradient-to-br before:from-[#0066cc] before:via-[#0099ff] before:to-[#00ccff] shadow-[0_0_80px_rgba(0,102,204,0.5),inset_0_0_60px_rgba(0,204,255,0.2)]"
                : "before:bg-gradient-to-br before:from-[#1a2035] before:to-[#0d1220] shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_0_30px_rgba(255,255,255,0.02)] hover:shadow-[0_0_60px_rgba(0,102,204,0.2)]",
              isConnecting && "scale-95 opacity-80"
            )}
          >
            {/* Glass layer */}
            <div className={cn(
              "absolute inset-2 rounded-full backdrop-blur-sm transition-all duration-700",
              isConnected 
                ? "bg-white/10" 
                : "bg-gradient-to-br from-white/5 to-transparent"
            )} />
            
            {/* Inner glow */}
            <div className={cn(
              "absolute inset-4 rounded-full transition-all duration-700",
              isConnected 
                ? "bg-gradient-to-t from-[#0066cc]/50 to-transparent" 
                : "bg-gradient-to-t from-white/5 to-transparent"
            )} />
            
            {/* Center icon container */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-500",
              isConnecting && "animate-spin"
            )}>
              <Snowflake
                className={cn(
                  "w-20 h-20 transition-all duration-500",
                  isConnected 
                    ? "text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]" 
                    : "text-white/40"
                )}
                strokeWidth={1}
              />
            </div>

            {/* Success indicator */}
            {isConnected && !isConnecting && (
              <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-[#00ff88] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.5)]">
                <Check className="w-6 h-6 text-[#0a0f1a]" strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="text-center mb-8">
          <h1 className={cn(
            "text-3xl font-bold mb-3 transition-all duration-500",
            isConnected 
              ? "text-white" 
              : "text-white/80"
          )}>
            {isConnecting
              ? "Замораживаем..."
              : isConnected
                ? "Ограничения заморожены"
                : "Telegram заблокирован"}
          </h1>
          <p className={cn(
            "text-base transition-all duration-500",
            isConnected ? "text-white/60" : "text-white/40"
          )}>
            {isConnected
              ? "Наслаждайтесь свободным интернетом"
              : isPaid
                ? "Нажмите на снежинку для подключения"
                : "Оформите подписку чтобы начать"}
          </p>
        </div>

        {/* Connection Timer */}
        {isConnected && (
          <div className="mb-8 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <p className="text-4xl font-mono font-light text-white tracking-[0.2em] text-center">
              {formatTime(connectionTime)}
            </p>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {[
            { 
              icon: Shield, 
              label: "Защита", 
              value: isConnected ? "Активна" : "Выкл",
              active: isConnected,
              color: "#00ff88"
            },
            { 
              icon: Zap, 
              label: "Скорость", 
              value: isConnected ? "Max" : "—",
              active: isConnected,
              color: "#ffcc00"
            },
            { 
              icon: Wifi, 
              label: "Пинг", 
              value: isConnected ? "24ms" : "—",
              active: isConnected,
              color: "#00ccff"
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl p-4 text-center backdrop-blur-xl border transition-all duration-500",
                stat.active 
                  ? "bg-white/5 border-white/10" 
                  : "bg-white/[0.02] border-white/5"
              )}
            >
              <stat.icon 
                className={cn(
                  "w-6 h-6 mx-auto mb-2 transition-all duration-500",
                )}
                style={{ color: stat.active ? stat.color : 'rgba(255,255,255,0.2)' }}
              />
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={cn(
                "text-sm font-semibold transition-all duration-500",
                stat.active ? "text-white" : "text-white/30"
              )}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Promo Banner for non-paid users */}
        {!isPaid && (
          <div className="mt-10 w-full max-w-sm">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0066cc]/20 to-[#00ccff]/20 p-6 border border-[#0066cc]/30">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#0066cc]/20 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0066cc] to-[#00ccff] flex items-center justify-center flex-shrink-0">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold mb-1">Разблокируй Telegram</p>
                  <p className="text-white/50 text-sm">Всего <span className="text-[#00ccff] font-bold">299 ₽</span><span className="text-white/30">/мес</span></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
