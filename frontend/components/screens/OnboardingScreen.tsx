"use client"

import { useState, useCallback } from "react"
import { Snowflake, Shield, Zap, Globe, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingScreenProps {
  onComplete: () => void
}

const slides = [
  {
    id: 1,
    icon: Snowflake,
    title: "Заморозь ограничения",
    subtitle: "Telegram без блокировок",
    description: "Frosty мгновенно снимает все ограничения с Telegram. Один клик — и вы на связи.",
    gradient: "from-[#0066cc] via-[#0099ff] to-[#00ccff]",
    bgGlow: "bg-[#0066cc]/30",
    iconBg: "from-[#0066cc] to-[#00ccff]"
  },
  {
    id: 2,
    icon: Shield,
    title: "Безопасно и анонимно",
    subtitle: "Ваши данные защищены",
    description: "Никаких логов, никакой слежки. Работает прямо внутри Telegram — ничего устанавливать не нужно.",
    gradient: "from-[#00cc88] via-[#00ff99] to-[#88ffcc]",
    bgGlow: "bg-[#00cc88]/30",
    iconBg: "from-[#00cc88] to-[#00ff99]"
  },
  {
    id: 3,
    icon: Zap,
    title: "Один клик — и готово",
    subtitle: "Проще не бывает",
    description: "Не мешает VPN и другим приложениям. Подключение за 10 секунд без сложных настроек.",
    gradient: "from-[#ff6600] via-[#ff9933] to-[#ffcc00]",
    bgGlow: "bg-[#ff6600]/30",
    iconBg: "from-[#ff6600] to-[#ffcc00]"
  }
]

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right'>('right')
  const [isAnimating, setIsAnimating] = useState(false)

  const goToSlide = useCallback((index: number) => {
    if (isAnimating || index === currentSlide) return
    setDirection(index > currentSlide ? 'right' : 'left')
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentSlide(index)
      setIsAnimating(false)
    }, 150)
  }, [currentSlide, isAnimating])

  const nextSlide = useCallback(() => {
    if (currentSlide === slides.length - 1) {
      onComplete()
    } else {
      goToSlide(currentSlide + 1)
    }
  }, [currentSlide, goToSlide, onComplete])

  const slide = slides[currentSlide]
  const Icon = slide.icon
  const isLastSlide = currentSlide === slides.length - 1

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Main glow - changes color per slide */}
        <div 
          className={cn(
            "absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] transition-all duration-700",
            slide.bgGlow
          )} 
        />
        
        {/* Floating particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
            style={{
              left: `${10 + (i * 4.5)}%`,
              top: `${15 + (i % 5) * 18}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${2 + (i % 3)}s`
            }}
          />
        ))}
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen px-6 py-10">
        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onComplete}
            className="text-white/40 text-sm font-medium hover:text-white/60 transition-colors px-4 py-2"
          >
            Пропустить
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Icon with animated rings */}
          <div className={cn(
            "relative mb-12 transition-all duration-300",
            isAnimating && (direction === 'right' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
          )}>
            {/* Outer rings */}
            <div className={cn(
              "absolute inset-0 w-48 h-48 -m-8 rounded-full border transition-colors duration-700",
              `border-white/5`
            )} />
            <div className={cn(
              "absolute inset-0 w-56 h-56 -m-12 rounded-full border transition-colors duration-700",
              `border-white/[0.03]`
            )} />
            <div className={cn(
              "absolute inset-0 w-64 h-64 -m-16 rounded-full border transition-colors duration-700",
              `border-white/[0.02]`
            )} />
            
            {/* Icon container */}
            <div className={cn(
              "relative w-32 h-32 rounded-[40px] flex items-center justify-center",
              "bg-gradient-to-br shadow-2xl",
              slide.iconBg
            )}>
              {/* Glass overlay */}
              <div className="absolute inset-0 rounded-[40px] bg-white/10" />
              
              {/* Inner shadow */}
              <div className="absolute inset-2 rounded-[32px] bg-gradient-to-b from-white/20 to-transparent" />
              
              <Icon className="w-16 h-16 text-white relative z-10 drop-shadow-lg" strokeWidth={1.5} />
              
              {/* Sparkle effects */}
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-white/60 animate-pulse" />
            </div>
          </div>

          {/* Text content */}
          <div className={cn(
            "text-center max-w-sm transition-all duration-300",
            isAnimating && (direction === 'right' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
          )}>
            {/* Subtitle badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <Globe className="w-4 h-4 text-white/50" />
              <span className="text-sm text-white/50">{slide.subtitle}</span>
            </div>
            
            {/* Title */}
            <h1 className={cn(
              "text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r",
              slide.gradient
            )}>
              {slide.title}
            </h1>
            
            {/* Description */}
            <p className="text-white/60 text-lg leading-relaxed">
              {slide.description}
            </p>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-auto pt-8">
          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === currentSlide
                    ? cn("w-8 bg-gradient-to-r", slide.gradient)
                    : "w-2 bg-white/20 hover:bg-white/30"
                )}
              />
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={nextSlide}
            className={cn(
              "w-full h-16 rounded-2xl font-semibold text-lg text-white",
              "flex items-center justify-center gap-3",
              "bg-gradient-to-r transition-all duration-500",
              "shadow-lg hover:shadow-xl active:scale-[0.98]",
              slide.gradient,
              isLastSlide && "animate-pulse"
            )}
            style={{
              boxShadow: isLastSlide 
                ? `0 0 40px ${slide.gradient.includes('0066cc') ? 'rgba(0,102,204,0.4)' : slide.gradient.includes('00cc88') ? 'rgba(0,204,136,0.4)' : 'rgba(255,102,0,0.4)'}`
                : undefined
            }}
          >
            {isLastSlide ? (
              <>
                <Snowflake className="w-6 h-6" />
                Начать
              </>
            ) : (
              <>
                Далее
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </button>

          {/* Terms text */}
          {isLastSlide && (
            <p className="text-center text-white/30 text-xs mt-4">
              Нажимая "Начать", вы соглашаетесь с условиями использования
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
