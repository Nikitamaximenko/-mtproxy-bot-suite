import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FaqSection,
  HowItWorksSection,
  LawsSection,
  ReviewsSection,
  StatsSection,
  TariffsSection,
} from '../components/landing/sections'

const ease = [0.32, 0.72, 0, 1] as const

function prefetchPotokChunk() {
  void import('./FlowPage')
}

/**
 * Всё ниже первого экрана — отдельный чанк, подгружается после первой отрисовки / idle.
 */
export default function LandingRest() {
  return (
    <>
      <StatsSection />

      <LawsSection />

      <HowItWorksSection />

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
          onMouseEnter={prefetchPotokChunk}
          className="ease-brand bg-accent text-background hover:bg-accent-hover mt-12 inline-flex items-center rounded-[4px] px-8 py-3 font-medium transition-all duration-300"
        >
          Задать первый вопрос
          <span className="ml-2">→</span>
        </Link>
      </section>
    </>
  )
}
