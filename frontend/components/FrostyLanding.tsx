"use client"

import { useState } from "react"
import { Snowflake, Shield, Zap, Lock, ExternalLink, ChevronDown, Users, Gauge, Check } from "lucide-react"

const TELEGRAM_BOT_URL = "https://t.me/FrostyProxyBot"

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

function CTAButton({ size = "default" }: { size?: "default" | "large" }) {
  const sizeClasses = size === "large" 
    ? "px-10 py-5 text-lg md:text-xl" 
    : "px-8 py-4 text-base md:text-lg"
  
  return (
    <a
      href={TELEGRAM_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center justify-center gap-3 ${sizeClasses} bg-primary text-primary-foreground font-semibold rounded-2xl transition-all duration-300 hover:scale-105 frost-glow-strong hover:frost-glow-strong overflow-hidden`}
    >
      <span className="absolute inset-0 animate-shimmer opacity-50" />
      <Snowflake className="w-5 h-5 md:w-6 md:h-6 relative z-10" />
      <span className="relative z-10">ЗАМОРОЗИТЬ ОГРАНИЧЕНИЯ</span>
      <ExternalLink className="w-4 h-4 md:w-5 md:h-5 opacity-70 relative z-10" />
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
    <div className="group flex flex-col items-center text-center p-6 md:p-8 rounded-2xl bg-card border border-border/50 transition-all duration-500 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl ice-block-solid flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground" />
      </div>
      <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">{title}</h3>
      <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

function IceBlock({ className, delay = 0, rotation = 0 }: { className?: string; delay?: number; rotation?: number }) {
  return (
    <div
      className={`absolute ice-block rounded-xl animate-frost-pulse ${className}`}
      style={{ 
        animationDelay: `${delay}s`,
        transform: `rotate(${rotation}deg)`
      }}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-white/40" />
        <div className="absolute top-4 left-3 w-2 h-2 rounded-full bg-white/30" />
      </div>
    </div>
  )
}

function Snowflakes() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(15)].map((_, i) => (
        <Snowflake
          key={i}
          className="absolute text-primary/20 animate-snowfall"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${8 + Math.random() * 6}s`,
            width: `${12 + Math.random() * 16}px`,
            height: `${12 + Math.random() * 16}px`,
          }}
        />
      ))}
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-lg font-medium text-foreground group-hover:text-primary transition-colors pr-4">
          {question}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-muted-foreground transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48 pb-5' : 'max-h-0'}`}>
        <p className="text-muted-foreground leading-relaxed">{answer}</p>
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
    <div className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2 ${
      popular 
        ? 'bg-primary text-primary-foreground frost-glow-strong scale-105 z-10' 
        : 'bg-card border border-border hover:border-primary/30 hover:shadow-xl'
    }`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-accent text-accent-foreground text-sm font-medium rounded-full">
          Популярный
        </div>
      )}
      
      <h3 className={`text-2xl font-bold mb-2 ${popular ? 'text-primary-foreground' : 'text-foreground'}`}>
        {title}
      </h3>
      
      <div className="mb-6">
        <span className={`text-5xl font-bold ${popular ? 'text-primary-foreground' : 'frozen-text'}`}>
          {price}
        </span>
        <span className={`text-lg ${popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {' '}руб/мес
        </span>
      </div>
      
      <ul className="flex-1 space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${popular ? 'text-primary-foreground' : 'text-primary'}`} />
            <span className={popular ? 'text-primary-foreground/90' : 'text-muted-foreground'}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      
      <a
        href={TELEGRAM_BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-105 ${
          popular 
            ? 'bg-white text-primary hover:bg-white/90' 
            : 'bg-primary text-primary-foreground frost-glow'
        }`}
      >
        <Snowflake className="w-5 h-5" />
        <span>ЗАМОРОЗИТЬ ОГРАНИЧЕНИЯ</span>
      </a>
    </div>
  )
}

export function FrostyLanding() {
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated snowflakes */}
      <Snowflakes />
      
      {/* Background ice blocks */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <IceBlock className="w-40 h-40 -top-10 -left-10" delay={0} rotation={15} />
        <IceBlock className="w-32 h-32 top-1/4 -right-8" delay={0.5} rotation={-10} />
        <IceBlock className="w-48 h-48 bottom-1/3 -left-16" delay={1} rotation={8} />
        <IceBlock className="w-36 h-36 -bottom-12 right-1/4" delay={1.5} rotation={-5} />
        <IceBlock className="w-24 h-24 top-1/2 left-1/5 hidden md:block" delay={2} rotation={25} />
        <IceBlock className="w-20 h-20 top-1/3 right-1/3 hidden lg:block" delay={2.5} rotation={-15} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-6 md:py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FrostIcon className="w-10 h-10 md:w-12 md:h-12 text-primary animate-float" />
            <span className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Frosty
            </span>
          </div>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:scale-105 transition-all frost-glow"
          >
            <span>Подключить</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="px-4 pt-12 pb-16 md:pt-20 md:pb-28 lg:pt-28 lg:pb-36">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-float" style={{ animationDelay: '0.5s' }}>
              <Snowflake className="w-4 h-4" />
              <span>Telegram без ограничений</span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-foreground leading-tight mb-6 text-balance">
              Заморозьте
              <span className="block frozen-text">все ограничения</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl lg:text-3xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed text-pretty">
              Один клик — и Telegram работает без блокировок.
              <span className="block mt-2 text-lg md:text-xl">Безопасно. Анонимно. Без VPN.</span>
            </p>

            {/* CTA Button */}
            <CTAButton size="large" />

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mt-14 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span>Работает прямо сейчас</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>Без регистрации</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span>Мгновенное подключение</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-20 md:py-28 bg-secondary/50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-foreground mb-16">
              Почему <span className="frozen-text">Frosty</span>?
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              <FeatureCard
                icon={Zap}
                title="Один клик"
                description="Нажмите кнопку в боте — прокси автоматически добавится в ваш Telegram. Никаких настроек."
              />
              <FeatureCard
                icon={Shield}
                title="Полная безопасность"
                description="Ваши данные остаются вашими. Мы не храним логи и не отслеживаем активность."
              />
              <FeatureCard
                icon={Lock}
                title="Не мешает VPN"
                description="Работает независимо от других приложений. Включайте VPN когда нужно — Frosty не конфликтует."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-20 md:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-16">
              Как это работает
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-6 lg:gap-12">
              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl ice-block-solid flex items-center justify-center text-3xl md:text-4xl font-bold text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                  1
                </div>
                <p className="text-lg md:text-xl text-foreground font-medium">Откройте бота</p>
              </div>

              <div className="hidden md:block w-16 lg:w-24 h-1 bg-gradient-to-r from-primary/50 to-primary rounded-full" />

              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl ice-block-solid flex items-center justify-center text-3xl md:text-4xl font-bold text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                  2
                </div>
                <p className="text-lg md:text-xl text-foreground font-medium">Нажмите кнопку</p>
              </div>

              <div className="hidden md:block w-16 lg:w-24 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full" />

              <div className="flex flex-col items-center group">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl ice-block-solid flex items-center justify-center text-3xl md:text-4xl font-bold text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                  3
                </div>
                <p className="text-lg md:text-xl text-foreground font-medium">Готово!</p>
              </div>
            </div>

            <p className="text-muted-foreground mt-12 text-lg md:text-xl max-w-xl mx-auto">
              Прокси добавляется прямо в настройки Telegram.
              <span className="block mt-1">Без вечных включений. Просто работает.</span>
            </p>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="px-4 py-20 md:py-28 bg-secondary/50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-foreground mb-6">
              Выберите тариф
            </h2>
            <p className="text-center text-muted-foreground text-lg mb-16 max-w-xl mx-auto">
              Простые и понятные цены. Никаких скрытых платежей.
            </p>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
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

            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card border border-border text-sm text-muted-foreground">
                <Users className="w-5 h-5 text-primary" />
                <span>Premium идеален для семьи или нескольких устройств</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 py-20 md:py-28">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-foreground mb-16">
              Частые вопросы
            </h2>

            <div className="bg-card rounded-3xl border border-border p-6 md:p-8">
              {faqItems.map((item, index) => (
                <FAQItem key={index} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-20 md:py-28 bg-secondary/50 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <IceBlock className="w-32 h-32 top-10 left-10 opacity-50" delay={0} rotation={20} />
            <IceBlock className="w-24 h-24 bottom-10 right-10 opacity-50" delay={0.5} rotation={-15} />
          </div>
          
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <FrostIcon className="w-24 h-24 md:w-32 md:h-32 text-primary mx-auto mb-8 animate-float" />
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
              Готовы <span className="frozen-text">заморозить</span> ограничения?
            </h2>
            <p className="text-muted-foreground text-xl md:text-2xl mb-10">
              Подключитесь за 10 секунд и забудьте о блокировках
            </p>
            <CTAButton size="large" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-10 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FrostIcon className="w-6 h-6 text-primary" />
            <span className="font-medium">Frosty</span>
          </div>
          <p>Telegram работает. Всегда.</p>
        </div>
      </footer>
    </div>
  )
}
