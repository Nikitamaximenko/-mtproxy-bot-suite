"use client"

import { useState, useEffect } from "react"
import { Power, Shield, Zap, Clock } from "lucide-react"
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-8">
      {/* Status Text */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          {isConnecting
            ? "Подключение..."
            : isConnected
              ? "Подключено"
              : "Не подключено"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isConnected
            ? "Telegram работает на полной скорости"
            : isPaid
              ? "Нажмите для подключения"
              : "Оформите подписку для начала"}
        </p>
      </div>

      {/* Big Connect Button */}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className={cn(
          "relative w-44 h-44 rounded-full transition-all duration-500 flex items-center justify-center",
          "shadow-[0_0_60px_rgba(0,0,0,0.3)]",
          isConnected
            ? "bg-gradient-to-br from-primary to-primary/80 shadow-[0_0_80px_rgba(45,212,191,0.4)]"
            : "bg-gradient-to-br from-secondary to-secondary/80 hover:from-muted hover:to-muted/80",
          isConnecting && "animate-pulse"
        )}
      >
        {/* Outer Ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border-4 transition-colors duration-500",
            isConnected ? "border-primary/30" : "border-border"
          )}
        />
        
        {/* Inner Glow */}
        {isConnected && (
          <div className="absolute inset-4 rounded-full bg-primary/20 animate-ping" />
        )}

        {/* Power Icon */}
        <Power
          className={cn(
            "w-16 h-16 transition-all duration-500",
            isConnected ? "text-primary-foreground" : "text-muted-foreground"
          )}
          strokeWidth={1.5}
        />
      </button>

      {/* Connection Timer */}
      {isConnected && (
        <div className="mt-8 text-center">
          <p className="text-3xl font-mono font-light text-foreground tracking-wider">
            {formatTime(connectionTime)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Время подключения</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mt-12 w-full max-w-sm">
        <div className="bg-card rounded-2xl p-4 text-center border border-border">
          <Shield className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Защита</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {isConnected ? "Активна" : "Выкл"}
          </p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center border border-border">
          <Zap className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Скорость</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {isConnected ? "Макс" : "—"}
          </p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center border border-border">
          <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Пинг</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {isConnected ? "12 мс" : "—"}
          </p>
        </div>
      </div>

      {/* Info Banner */}
      {!isPaid && (
        <div className="mt-8 bg-card/50 border border-border rounded-2xl p-4 max-w-sm w-full">
          <p className="text-sm text-center text-muted-foreground">
            Один раз подключил — и забыл.
            <br />
            <span className="text-primary font-medium">199 ₽/месяц</span>
          </p>
        </div>
      )}
    </div>
  )
}
