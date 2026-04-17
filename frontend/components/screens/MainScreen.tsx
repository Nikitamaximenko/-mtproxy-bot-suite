"use client"

import { useState, useEffect } from "react"
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        
        {/* Status icon */}
        <div className="relative mb-8">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={cn(
              "w-40 h-40 rounded-full transition-all duration-300 flex items-center justify-center",
              "active:scale-95",
              isConnected
                ? "bg-[#2AABEE]"
                : "bg-[#F5F5F5] border border-[#E8E8E8]"
            )}
          >
            {/* Telegram plane icon */}
            <svg 
              viewBox="0 0 24 24" 
              className={cn(
                "w-16 h-16 transition-all duration-300",
                isConnected ? "text-white" : "text-[#8E8E93]",
                isConnecting && "animate-pulse"
              )}
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
            </svg>
          </button>
          
          {/* Connection indicator */}
          {isConnected && (
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#34C759] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">
            {isConnecting
              ? "Подключение..."
              : isConnected
                ? "Telegram работает"
                : "Telegram недоступен"}
          </h1>
          <p className="text-[#8E8E93] text-base">
            {isConnected
              ? "Все ограничения сняты"
              : isPaid
                ? "Нажмите для подключения"
                : "Оформите подписку"}
          </p>
        </div>

        {/* Connection timer */}
        {isConnected && (
          <div className="mb-8">
            <p className="text-4xl font-mono font-semibold text-[#1A1A1A] tracking-wider">
              {formatTime(connectionTime)}
            </p>
          </div>
        )}

        {/* Features - simple checkmarks */}
        {!isPaid && (
          <div className="w-full max-w-xs space-y-4 mb-8">
            {[
              "Работает без VPN",
              "Подключение за 10 секунд",
              "Безопасно и анонимно"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[#34C759] text-lg">✓</span>
                <span className="text-[#1A1A1A]">{feature}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {!isPaid && (
        <div className="px-6 pb-8 safe-area-bottom">
          <button
            onClick={onConnect}
            className="w-full h-14 rounded-[14px] bg-[#2AABEE] text-white font-semibold text-lg active:opacity-90 transition-opacity"
          >
            Подключить за 299 ₽/мес
          </button>
        </div>
      )}
    </div>
  )
}
