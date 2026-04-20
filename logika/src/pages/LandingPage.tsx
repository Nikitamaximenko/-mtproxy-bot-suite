import { motion } from 'framer-motion'
import Lenis from 'lenis'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { HeroFork } from '../components/landing/HeroFork'
import {
  FaqSection,
  HowItWorksSection,
  LawsSection,
  QuotesSection,
  ReviewsSection,
  StatsSection,
  TariffsSection,
  Ticker,
} from '../components/landing/sections'

const ease = [0.32, 0.72, 0, 1] as const

export function LandingPage() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    let raf = 0
    const tick = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border/80 fixed left-0 right-0 top-0 z-50 border-b bg-[#0a0a0b]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="hover:text-accent transition-colors duration-300">
            <Logo />
          </Link>
          <nav className="text-muted hidden items-center gap-8 font-mono text-[13px] uppercase tracking-[0.08em] md:flex">
            <a href="#product" className="hover:text-foreground transition-colors duration-300">
              Продукт
            </a>
            <a href="#tariffs" className="hover:text-foreground transition-colors duration-300">
              Тарифы
            </a>
            <Link to="/potok" className="hover:text-foreground transition-colors duration-300">
              Войти
            </Link>
          </nav>
          <Link
            to="/potok"
            className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-4 py-2 text-sm font-medium shadow-[0_0_24px_rgba(196,245,66,0.18)] transition-all duration-300"
          >
            Задать вопрос
          </Link>
        </div>
      </header>

      <section
        id="product"
        className="border-border relative min-h-[100dvh] overflow-hidden border-b pt-24"
      >
        <div className="absolute inset-0 opacity-40">
          <HeroFork />
        </div>
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-12 gap-6 px-4 pb-24 pt-12 md:px-6 md:pt-20">
          <div className="col-span-12">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="max-w-[980px] text-[clamp(2.75rem,10vw,8rem)] font-medium leading-[0.95] tracking-[-0.04em]"
            >
              Ты думаешь,
              <br />
              что решаешь сам.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease }}
              className="text-muted mt-8 max-w-xl text-lg leading-relaxed md:text-xl"
            >
              ИИ, обученный на сотне книг по логике. Он покажет, насколько твоё решение — действительно
              твоё.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2, ease }}
              className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Link
                to="/potok"
                className="ease-brand bg-accent text-background hover:bg-accent-hover inline-flex items-center justify-center rounded-[4px] px-6 py-3 font-medium shadow-[0_0_32px_rgba(196,245,66,0.22)] transition-all duration-300"
              >
                Задать первый вопрос
                <span className="ml-2">→</span>
              </Link>
              <span className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">
                бесплатно, без карты
              </span>
            </motion.div>
            <Ticker />
          </div>
        </div>
      </section>

      <StatsSection />

      <LawsSection />

      <HowItWorksSection />

      <QuotesSection />

      <section id="tariffs">
        <TariffsSection />
      </section>

      <FaqSection />

      <ReviewsSection />

      <section className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-[120px] text-center md:py-[200px]">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="max-w-[900px] text-[clamp(2.5rem,8vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.04em]"
        >
          Хватит думать,
          <br />
          что ты думаешь.
        </motion.h2>
        <Link
          to="/potok"
          className="ease-brand bg-accent text-background hover:bg-accent-hover mt-12 inline-flex items-center rounded-[4px] px-8 py-3 font-medium transition-all duration-300"
        >
          Задать первый вопрос
          <span className="ml-2">→</span>
        </Link>
      </section>

      <footer className="border-border border-t py-12">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-center md:px-6">
          <Logo />
          <div className="flex flex-wrap gap-6 font-mono text-[13px] uppercase tracking-[0.08em] text-muted">
            <a href="#" className="hover:text-foreground transition-colors duration-300">
              Политика
            </a>
            <a href="#" className="hover:text-foreground transition-colors duration-300">
              Оферта
            </a>
            <a href="#" className="hover:text-foreground transition-colors duration-300">
              Контакты
            </a>
            <a href="#" className="hover:text-foreground transition-colors duration-300">
              Telegram
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-dim">
            <span>© {new Date().getFullYear()} Логика</span>
            <span className="font-mono text-xs uppercase tracking-[0.08em]">Русский</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
