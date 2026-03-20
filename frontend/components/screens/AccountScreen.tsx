"use client"

import { useState } from "react"
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
    <div className="min-h-screen bg-white">
      <div className="px-6 py-8">
        {/* Status card */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              isConnected ? "bg-[#2AABEE]" : "bg-[#F5F5F5]"
            )}>
              <svg 
                viewBox="0 0 24 24" 
                className={cn("w-7 h-7", isConnected ? "text-white" : "text-[#8E8E93]")}
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1A1A1A]">
                {isConnected ? "Подключено" : "Отключено"}
              </h2>
              <p className="text-[#8E8E93]">
                {isConnected ? "Все ограничения сняты" : "Нажмите чтобы подключить"}
              </p>
            </div>
            <div className={cn(
              "w-3 h-3 rounded-full",
              isConnected ? "bg-[#34C759] animate-pulse-soft" : "bg-[#C7C7CC]"
            )} />
          </div>
        </div>

        {/* Proxy link card */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#8E8E93]">Ссылка на прокси</span>
            <button
              onClick={handleCopy}
              className={cn(
                "text-sm font-medium transition-colors",
                copied ? "text-[#34C759]" : "text-[#2AABEE]"
              )}
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          
          <div 
            onClick={handleCopy}
            className="p-4 bg-[#F5F5F5] rounded-[14px] cursor-pointer active:bg-[#EBEBEB] transition-colors"
          >
            <code className="text-xs text-[#8E8E93] break-all leading-relaxed">
              {proxyLink}
            </code>
          </div>
          
          <a
            href={proxyLink}
            className="flex items-center justify-center gap-2 mt-4 h-14 rounded-[14px] bg-[#2AABEE] text-white font-semibold active:opacity-90 transition-opacity"
          >
            Подключить в Telegram
          </a>
        </div>

        {/* Subscription card */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#1A1A1A] font-semibold">Подписка</span>
            <span className="text-[#34C759] font-medium">Активна</span>
          </div>
          
          <div className="h-px bg-[#E8E8E8] mb-4" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#8E8E93]">Тариф</span>
            <span className="text-[#1A1A1A] font-medium">299 ₽/мес</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[#8E8E93]">Следующий платёж</span>
            <span className="text-[#1A1A1A] font-medium">17.04.2026</span>
          </div>
        </div>

        {/* Menu items */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden">
          {[
            { label: "История платежей", href: "#" },
            { label: "Поддержка", href: "#" },
          ].map((item, i) => (
            <button
              key={i}
              className={cn(
                "w-full flex items-center justify-between px-6 py-4 text-left",
                "active:bg-[#F5F5F5] transition-colors",
                i !== 1 && "border-b border-[#E8E8E8]"
              )}
            >
              <span className="text-[#1A1A1A]">{item.label}</span>
              <svg className="w-5 h-5 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button className="w-full mt-4 py-4 text-[#FF3B30] font-medium active:opacity-70 transition-opacity">
          Выйти из аккаунта
        </button>
      </div>

      {/* Copied toast */}
      <div className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
        "px-6 py-3 rounded-full bg-[#1A1A1A] text-white font-medium text-sm",
        "transition-all duration-300",
        copied ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        Ссылка скопирована
      </div>
    </div>
  )
}
