"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Snowflake, Shield, Zap, Lock, ChevronDown, Users, Check, X } from "lucide-react"

const TELEGRAM_BOT_URL = "https://t.me/FrostyProxyBot"

// Intro Animation Component
function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0)
  
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),    // Ice particles appear
      setTimeout(() => setPhase(2), 800),    // Ice expands
      setTimeout(() => setPhase(3), 1400),   // Text "ЗАМОРОЗЬ" appears
      setTimeout(() => setPhase(4), 2000),   // Text "ВСЕ ОГРАНИЧЕНИЯ" appears
      setTimeout(() => setPhase(5), 2800),   // Final state
      setTimeout(() => onComplete(), 3500),  // Transition to main page
    ]
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center overflow-hidden">
      {/* Animated ice crystals background */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`absolute transition-all duration-1000 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
            style={{
              left: `${10 + (i % 5) * 20}%`,
              top: `${10 + Math.floor(i / 5) * 25}%`,
              transitionDelay: `${i * 50}ms`,
            }}
          >
            <Snowflake 
              className={`text-primary/20 ${phase >= 2 ? 'animate-spin-slow' : ''}`}
              style={{ 
                width: `${20 + (i % 3) * 15}px`,
                height: `${20 + (i % 3) * 15}px`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Central frost burst effect */}
      <div className={`absolute w-[600px] h-[600px] transition-all duration-1000 ${phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-primary/30 via-primary/10 to-transparent animate-pulse" />
        <div className="absolute inset-8 rounded-full bg-gradient-radial from-ice/40 via-frost/20 to-transparent" />
        <div className="absolute inset-16 rounded-full bg-gradient-radial from-frost-light/50 via-transparent to-transparent" />
      </div>

      {/* Ice shards radiating outward */}
      {phase >= 2 && (
        <div className="absolute">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute origin-center animate-ice-shard"
              style={{
                transform: `rotate(${i * 45}deg)`,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div className="w-1 h-32 bg-gradient-to-t from-primary/60 via-ice/40 to-transparent rounded-full" 
                style={{ transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Main text container */}
      <div className="relative z-10 text-center px-4">
        {/* ЗАМОРОЗЬ */}
        <div className={`overflow-hidden transition-all duration-700 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`}>
          <h1 
            className={`text-5xl md:text-7xl lg:text-8xl font-black text-foreground tracking-tight transition-transform duration-700 ${phase >= 3 ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ textShadow: '0 0 40px oklch(0.55 0.18 220 / 0.3)' }}
          >
            ЗАМОРОЗЬ
          </h1>
        </div>

        {/* ВСЕ ОГРАНИЧЕНИЯ */}
        <div className={`overflow-hidden transition-all duration-700 ${phase >= 4 ? 'opacity-100' : 'opacity-0'}`}>
          <h1 
            className={`text-5xl md:text-7xl lg:text-8xl font-black frozen-text tracking-tight transition-transform duration-700 ${phase >= 4 ? 'translate-y-0' : 'translate-y-full'}`}
          >
            ВСЕ ОГРАНИЧЕНИЯ
          </h1>
        </div>

        {/* Frost particles around text */}
        {phase >= 4 && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-frost-particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-primary/60" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom frost line */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent transition-all duration-1000 ${phase >= 5 ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`}
      />
    </div>
  )
}

function FrostIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 5L50 95M5 50L95 50M20 20L80 80M80 20L20 80"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
      <circle cx="50" cy="20" r="4" fill="currentColor" />
      <circle cx="50" cy="80" r="4" fill="currentColor" />
      <circle cx="20" cy="50" r="4" fill="currentColor" />
      <circle cx="80" cy="50" r="4" fill="currentColor" />
      <circle cx="28" cy="28" r="3" fill="currentColor" />
      <circle cx="72" cy="72" r="3" fill="currentColor" />
      <circle cx="72" cy="28" r="3" fill="currentColor" />
      <circle cx="28" cy="72" r="3" fill="currentColor" />
    </svg>
  )
}

function CTAButton({ size = "default", className = "" }: { size?: "default" | "large"; className?: string }) {
  const sizeClasses = size === "large" 
    ? "min-h-[56px] px-8 py-4 text-base" 
    : "min-h-[52px] px-6 py-3.5 text-base"
  
  return (
    <a
      href={TELEGRAM_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center justify-center gap-2.5 ${sizeClasses} bg-primary text-primary-foreground font-semibold rounded-2xl transition-all duration-300 active:scale-95 frost-glow-strong overflow-hidden touch-manipulation ${className}`}
    >
      <span className="absolute inset-0 animate-shimmer opacity-50" />
      <Snowflake className="w-5 h-5 relative z-10" />
      <span className="relative z-10">ЗАМОРОЗИТЬ ОГРАНИЧЕНИЯ</span>
    </a>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-card border border-border/50 transition-all duration-300 active:scale-[0.98] touch-manipulation">
      <div className="w-14 h-14 flex-shrink-0 rounded-xl ice-block-solid flex items-center justify-center">
        <Icon className="w-7 h-7 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
        <p className="text-base text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function IceBlock({ className, delay = 0 }: { className?: string; delay?: number }) {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])
  
  if (isMobile) return null
  
  return (
    <div
      className={`absolute ice-block rounded-xl animate-frost-pulse ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </div>
  )
}

function Snowflakes() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const flakes = useMemo(() => {
    if (!mounted) return []
    return Array.from({ length: 15 }, () => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 10}s`,
      animationDuration: `${8 + Math.random() * 6}s`,
      width: `${12 + Math.random() * 16}px`,
      height: `${12 + Math.random() * 16}px`,
    }))
  }, [mounted])

  if (!mounted) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {flakes.map((style, i) => (
        <Snowflake
          key={i}
          className="absolute text-primary/20 animate-snowfall"
          style={style}
        />
      ))}
    </div>
  )
}

function FAQItem({ question, answer, isOpen, onToggle }: { 
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left min-h-[60px] touch-manipulation"
      >
        <span className="text-base font-medium text-foreground pr-4 leading-snug">
          {question}
        </span>
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-secondary">
          <ChevronDown 
            className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-64 pb-5' : 'max-h-0'}`}>
        <p className="text-base text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

function PricingCard({ 
  title, 
  price, 
  features, 
  popular = false 
}: { 
  title: string
  price: number
  features: string[]
  popular?: boolean 
}) {
  return (
    <div className={`relative flex flex-col p-6 rounded-3xl transition-all duration-300 active:scale-[0.98] touch-manipulation ${
      popular 
        ? 'bg-primary text-primary-foreground frost-glow-strong' 
        : 'bg-card border border-border'
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-accent text-accent-foreground text-sm font-medium rounded-full whitespace-nowrap">
          Популярный
        </div>
      )}
      
      <h3 className={`text-xl font-bold mb-2 ${popular ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h3>
      
      <div className="mb-5">
        <span className={`text-4xl font-bold ${popular ? 'text-primary-foreground' : 'frozen-text'}`}>
          {price}
        </span>
        <span className={`text-base ${popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {' '}руб/мес
        </span>
      </div>
      
      <ul className="flex-1 space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${popular ? 'text-primary-foreground' : 'text-primary'}`} />
            <span className={`text-base ${popular ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      
      <a
        href={TELEGRAM_BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 min-h-[52px] py-3.5 px-6 rounded-xl font-semibold transition-all duration-300 active:scale-95 touch-manipulation ${
          popular 
            ? 'bg-white text-primary' 
            : 'bg-primary text-primary-foreground frost-glow'
        }`}
      >
        <Snowflake className="w-5 h-5" />
        <span>Выбрать</span>
      </a>
    </div>
  )
}

function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setIsVisible(scrollY > 400)
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  if (isHidden) return null
  
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-md border-t border-border transition-transform duration-300 md:hidden ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3">
        <CTAButton className="flex-1" />
        <button 
          onClick={() => setIsHidden(true)}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-secondary text-muted-foreground touch-manipulation"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export function FrostyLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [isReady, setIsReady] = useState(false)

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false)
    setIsReady(true)
  }, [])

  // Skip intro on subsequent visits (session storage)
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('frosty-intro-seen')
    if (hasSeenIntro) {
      setShowIntro(false)
      setIsReady(true)
    } else {
      sessionStorage.setItem('frosty-intro-seen', 'true')
    }
  }, [])
  
  const faqItems = [
    {
      question: "Как работает Frosty?",
      answer: "Frosty использует технологию MTProxy, которая встраивается прямо в Telegram. Вы добавляете прокси одним нажатием в боте, и он автоматически активируется при каждом запуске приложения."
    },
    {
      question: "Это безопасно для моих данных?",
      answer: "Абсолютно. Мы не храним логи, не отслеживаем активность и не имеем доступа к вашим сообщениям. Telegram использует сквозное шифрование, которое работает поверх нашего прокси."
    },
    {
      question: "Нужно ли выключать VPN?",
      answer: "Нет! Frosty работает независимо от VPN и других приложений. Вы можете использовать их одновременно без каких-либо конфликтов."
    },
    {
      question: "Чем отличается Premium от обычного тарифа?",
      answer: "Premium дает скорость в 3 раза выше и возможность подключить до 3 устройств или поделиться с близкими. Идеально для семьи или если вам нужна максимальная скорость."
    },
    {
      question: "Как происходит оплата?",
      answer: "Оплата через удобные способы прямо в Telegram-боте. После оплаты доступ активируется мгновенно."
    }
  ]

  // Show intro animation
  if (showIntro) {
    return <IntroAnimation onComplete={handleIntroComplete} />
  }

  return (
    <div className={`min-h-screen bg-background relative overflow-hidden transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
      {/* Background ice blocks - only on desktop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <IceBlock className="w-32 h-32 -top-8 -left-8" delay={0} />
        <IceBlock className="w-24 h-24 top-1/4 -right-6" delay={0.5} />
        <IceBlock className="w-40 h-40 bottom-1/3 -left-12" delay={1} />
        <IceBlock className="w-28 h-28 -bottom-8 right-1/4" delay={1.5} />
      </div>
      <Snowflakes />

      {/* Header */}
      <header className="relative z-10 px-4 py-4 safe-area-inset">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FrostIcon className="w-9 h-9 text-primary" />
            <span className="text-xl font-bold text-foreground tracking-tight">
              Frosty
            </span>
          </div>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl active:scale-95 transition-all frost-glow touch-manipulation"
          >
            <span>Подключить</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 pb-24 md:pb-0">
        <section className="px-4 pt-8 pb-12 md:pt-16 md:pb-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Snowflake className="w-4 h-4" />
              <span>Telegram без ограничений</span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight mb-5 text-balance">
              Заморозьте
              <span className="block frozen-text">все ограничения</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed text-pretty">
              Один клик — и Telegram работает без блокировок.
              <span className="block mt-1">Безопасно. Анонимно. Без VPN.</span>
            </p>

            {/* CTA Button */}
            <CTAButton size="large" />

            {/* Trust indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-10 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span>Работает прямо сейчас</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Без регистрации</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Мгновенное подключение</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-12 md:py-20 bg-secondary/50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-8 md:mb-12">
              Почему <span className="frozen-text">Frosty</span>?
            </h2>

            <div className="flex flex-col gap-4">
              <FeatureCard
                icon={Zap}
                title="Один клик"
                description="Нажмите кнопку в боте — прокси автоматически добавится в ваш Telegram."
              />
              <FeatureCard
                icon={Shield}
                title="Полная безопасность"
                description="Мы не храним логи и не отслеживаем вашу активность. Данные остаются вашими."
              />
              <FeatureCard
                icon={Lock}
                title="Не мешает VPN"
                description="Работает независимо от других приложений. Никаких конфликтов."
              />
            </div>
          </div>
        </section>

        {/* How it works - simplified for mobile */}
        <section className="px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-8 md:mb-12">
              Как это работает
            </h2>

            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-center md:gap-8">
              {[
                { num: "1", text: "Откройте бота" },
                { num: "2", text: "Нажмите кнопку" },
                { num: "3", text: "Готово!" },
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-4 md:flex-col">
                  <div className="w-16 h-16 rounded-2xl ice-block-solid flex items-center justify-center text-2xl font-bold text-primary-foreground flex-shrink-0">
                    {step.num}
                  </div>
                  <p className="text-lg font-medium text-foreground md:mt-3">{step.text}</p>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground mt-8 text-base max-w-md mx-auto">
              Прокси добавляется прямо в настройки Telegram. Без вечных включений — просто работает.
            </p>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="px-4 py-12 md:py-20 bg-secondary/50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-3">
              Выберите тариф
            </h2>
            <p className="text-center text-muted-foreground text-base mb-8 md:mb-12">
              Простые цены. Без скрытых платежей.
            </p>

            <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
              <PricingCard
                title="Обычный"
                price={500}
                features={[
                  "Полный доступ к Telegram",
                  "Стабильное соединение",
                  "1 устройство",
                  "Техподдержка в боте"
                ]}
              />
              <PricingCard
                title="Premium"
                price={1000}
                popular
                features={[
                  "Скорость в 3 раза выше",
                  "До 3 устройств",
                  "Приоритетные серверы",
                  "Приоритетная техподдержка"
                ]}
              />
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border text-sm text-muted-foreground">
                <Users className="w-4 h-4 text-primary" />
                <span>Premium идеален для семьи</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-8 md:mb-12">
              Частые вопросы
            </h2>

            <div className="bg-card rounded-2xl border border-border px-5 md:px-6">
              {faqItems.map((item, index) => (
                <FAQItem 
                  key={index} 
                  question={item.question} 
                  answer={item.answer}
                  isOpen={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-12 md:py-20 bg-secondary/50">
          <div className="max-w-xl mx-auto text-center">
            <FrostIcon className="w-20 h-20 md:w-24 md:h-24 text-primary mx-auto mb-6 animate-float" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Готовы <span className="frozen-text">заморозить</span> ограничения?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Подключитесь за 10 секунд
            </p>
            <CTAButton size="large" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FrostIcon className="w-5 h-5 text-primary" />
            <span className="font-medium">Frosty</span>
          </div>
          <p>Telegram работает. Всегда.</p>
        </div>
      </footer>

      {/* Sticky CTA for mobile */}
      <StickyCTA />
    </div>
  )
}
