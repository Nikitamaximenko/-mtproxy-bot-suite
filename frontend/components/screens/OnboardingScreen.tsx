"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface OnboardingScreenProps {
  onComplete: () => void
}

const slides = [
  {
    emoji: "🚀",
    title: "Telegram работает",
    description: "Мгновенный доступ без VPN и сложных настроек"
  },
  {
    emoji: "🔒",
    title: "Безопасно",
    description: "Никаких логов. Ваши данные остаются приватными"
  },
  {
    emoji: "⚡",
    title: "Один клик",
    description: "Подключение за 10 секунд прямо в Telegram"
  }
]

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = useCallback(() => {
    if (currentSlide === slides.length - 1) {
      onComplete()
    } else {
      setCurrentSlide(currentSlide + 1)
    }
  }, [currentSlide, onComplete])

  const slide = slides[currentSlide]
  const isLastSlide = currentSlide === slides.length - 1

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Skip */}
      <div className="flex justify-end px-6 pt-4">
        <button
          onClick={onComplete}
          className="text-[#8E8E93] text-sm font-medium py-2 px-4"
        >
          Пропустить
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-8xl mb-8 animate-fadeIn" key={currentSlide}>
          {slide.emoji}
        </div>
        
        <h1 className="text-3xl font-bold text-[#1A1A1A] text-center mb-4 animate-fadeIn">
          {slide.title}
        </h1>
        
        <p className="text-lg text-[#8E8E93] text-center max-w-xs animate-fadeIn">
          {slide.description}
        </p>
      </div>

      {/* Bottom */}
      <div className="px-6 pb-8 safe-area-bottom">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentSlide
                  ? "w-8 bg-[#2AABEE]"
                  : "w-2 bg-[#E8E8E8]"
              )}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={nextSlide}
          className="w-full h-14 rounded-[14px] bg-[#2AABEE] text-white font-semibold text-lg active:opacity-90 transition-opacity"
        >
          {isLastSlide ? "Начать" : "Далее"}
        </button>
      </div>
    </div>
  )
}
