"use client"

import { Snowflake, Shield, Zap, Lock, ExternalLink } from "lucide-react"

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

function CTAButton() {
  return (
    <a
      href={TELEGRAM_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 md:px-10 md:py-5 bg-primary text-primary-foreground font-semibold text-lg md:text-xl rounded-2xl transition-all duration-300 hover:scale-105 frost-glow-strong hover:frost-glow-strong"
    >
      <span className="absolute inset-0 rounded-2xl animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
      <Snowflake className="w-5 h-5 md:w-6 md:h-6" />
      <span>ЗАМОРОЗИТЬ ОГРАНИЧЕНИЯ</span>
      <ExternalLink className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
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
    <div className="group flex flex-col items-center text-center p-6 md:p-8 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm transition-all duration-300 hover:bg-card hover:border-primary/30 hover:frost-glow">
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-7 h-7 md:w-8 md:h-8 text-primary" />
      </div>
      <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

function FrozenBlock({ className, delay = "0s" }: { className?: string; delay?: string }) {
  return (
    <div
      className={`absolute rounded-lg bg-primary/5 border border-primary/20 backdrop-blur-sm animate-frost-pulse ${className}`}
      style={{ animationDelay: delay }}
    />
  )
}

export function FrostyLanding() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background frozen blocks decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <FrozenBlock className="w-32 h-32 -top-8 -left-8 rotate-12" delay="0s" />
        <FrozenBlock className="w-24 h-24 top-1/4 -right-6 -rotate-12" delay="0.5s" />
        <FrozenBlock className="w-40 h-40 bottom-1/4 -left-12 rotate-6" delay="1s" />
        <FrozenBlock className="w-28 h-28 -bottom-8 right-1/4 -rotate-6" delay="1.5s" />
        <FrozenBlock className="w-20 h-20 top-1/2 left-1/4 rotate-45 hidden md:block" delay="2s" />
        <FrozenBlock className="w-16 h-16 top-1/3 right-1/3 -rotate-12 hidden lg:block" delay="2.5s" />
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
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <span>Подключить</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="px-4 pt-12 pb-16 md:pt-20 md:pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
              <Snowflake className="w-4 h-4" />
              <span>Telegram без ограничений</span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight mb-6 text-balance">
              Заморозьте
              <span className="block text-primary">все ограничения</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
              Один клик — и Telegram работает без блокировок.
              <span className="block mt-2">Безопасно. Анонимно. Без VPN.</span>
            </p>

            {/* CTA Button */}
            <CTAButton />

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 mt-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
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
        <section className="px-4 py-16 md:py-24 bg-secondary/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
              Почему Frosty?
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <section className="px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-12">
              Как это работает
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary mb-4">
                  1
                </div>
                <p className="text-foreground font-medium">Откройте бота</p>
              </div>

              <div className="hidden md:block w-16 h-px bg-border" />

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary mb-4">
                  2
                </div>
                <p className="text-foreground font-medium">Нажмите кнопку</p>
              </div>

              <div className="hidden md:block w-16 h-px bg-border" />

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary mb-4">
                  3
                </div>
                <p className="text-foreground font-medium">Готово!</p>
              </div>
            </div>

            <p className="text-muted-foreground mt-8 text-lg">
              Прокси добавляется прямо в настройки Telegram.
              <span className="block">Без вечных включений. Просто работает.</span>
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-16 md:py-24 bg-secondary/30">
          <div className="max-w-2xl mx-auto text-center">
            <FrostIcon className="w-20 h-20 md:w-24 md:h-24 text-primary mx-auto mb-8 animate-float" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Готовы заморозить ограничения?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Подключитесь за 10 секунд и забудьте о блокировках
            </p>
            <CTAButton />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FrostIcon className="w-5 h-5 text-primary" />
            <span>Frosty</span>
          </div>
          <p>Telegram работает. Всегда.</p>
        </div>
      </footer>
    </div>
  )
}
