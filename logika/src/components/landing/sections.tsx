import { motion, useInView } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { useCountUp } from '../../hooks/useCountUp'

const ease = [0.32, 0.72, 0, 1] as const

export function Ticker() {
  const items = [
    '35 000 решений в день',
    '180 когнитивных искажений',
    '4 закона логики',
    '2400 лет философии',
  ]
  const line = [...items, '——'].join(' · ')
  return (
    <div className="border-border relative mt-10 overflow-hidden border-t border-b py-3">
      <div className="animate-marquee flex whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.08em] text-muted">
        <span className="pr-16">{line}</span>
        <span className="pr-16">{line}</span>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 32s linear infinite; }
      `}</style>
    </div>
  )
}

function StatCard({
  value,
  suffix,
  label,
  source,
}: {
  value: number
  suffix?: string
  label: string
  source: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })
  const n = useCountUp(value, inView)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15%' }}
      transition={{ duration: 0.55, ease }}
      className="group border-border bg-card/40 hover:border-border-hover relative rounded-[12px] border p-8 transition-colors duration-300"
    >
      <div className="font-mono text-[clamp(4rem,12vw,10rem)] leading-none font-medium tracking-[-0.04em] text-accent">
        {n}
        {suffix}
      </div>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-muted md:text-2xl">{label}</p>
      <p className="text-dim mt-6 max-h-0 overflow-hidden font-mono text-xs uppercase tracking-[0.08em] opacity-0 transition-all duration-300 group-hover:max-h-24 group-hover:opacity-100">
        {source}
      </p>
    </motion.div>
  )
}

export function StatsSection() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-[120px] md:px-6 md:py-[200px]">
      <StatCard
        value={35000}
        label="решений в день ты принимаешь на автопилоте."
        source="Исследования когнитивной нагрузки, обзоры по рутинным решениям."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={95}
        suffix="%"
        label="из них — эмоциональные, не логические."
        source="Канеман, Тверски — эвристики и системы мышления."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={180}
        label="когнитивных искажений искривляют твоё мышление прямо сейчас."
        source="Сводные классификации в когнитивной психологии."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={0}
        label="раз ты проверял их сегодня."
        source="Пока ты это читаешь — счётчик не врёт."
      />
    </section>
  )
}

const laws = [
  {
    n: '01',
    title: 'ЗАКОН ТОЖДЕСТВА',
    f: 'A = A',
    text:
      'Если ты называешь что-то любовью, это должно быть любовью и в начале спора, и в конце.',
  },
  {
    n: '02',
    title: 'ЗАКОН НЕПРОТИВОРЕЧИЯ',
    f: 'A ≠ ¬A',
    text:
      'Нельзя одновременно хотеть свободы и стабильности в одной и той же точке.',
  },
  {
    n: '03',
    title: 'ЗАКОН ИСКЛЮЧЁННОГО ТРЕТЬЕГО',
    f: 'A ∨ ¬A',
    text:
      'Либо ты уходишь, либо остаёшься. «Подумаю» — это не третий вариант, это побег.',
  },
  {
    n: '04',
    title: 'ЗАКОН ДОСТАТОЧНОГО ОСНОВАНИЯ',
    f: 'A → B',
    text:
      'Каждое «я решил» требует ответа на вопрос «почему». Если ответа нет — решил не ты.',
  },
]

export function LawsSection() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-[120px] md:px-6 md:py-[200px]">
      <h2 className="text-[clamp(2rem,5vw,3rem)] font-medium tracking-[-0.02em]">
        Четыре опоры. Одна проверка.
      </h2>
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {laws.map((law) => (
          <motion.article
            key={law.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.5, ease }}
            className="border-border bg-card relative overflow-hidden rounded-[12px] border p-8 md:sticky md:top-24"
          >
            <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">{law.n}</p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.01em] md:text-[28px]">{law.title}</h3>
            <p className="text-dim font-mono mt-4 text-sm">{law.f}</p>
            <p className="mt-6 text-lg leading-relaxed text-muted">{law.text}</p>
            <motion.p
              className="text-dim pointer-events-none absolute -right-4 bottom-0 font-mono text-[120px] leading-none opacity-[0.07]"
              aria-hidden
              animate={{ opacity: [0.05, 0.09, 0.05] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              {law.f}
            </motion.p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

const demoSteps: { role: 'user' | 'bot'; text: string }[] = [
  { role: 'user', text: 'Хочу уволиться и уехать в другую страну.' },
  { role: 'bot', text: 'Ты принял это решение за последние 7 дней?' },
  { role: 'bot', text: 'Оно противоречит тому, что ты говорил себе полгода назад?' },
  { role: 'bot', text: 'Что изменится, если ты останешься ещё на три месяца?' },
  { role: 'bot', text: 'Ты ищешь побег или рост?' },
  { role: 'bot', text: 'Какой факт сейчас самый неудобный для твоей истории?' },
  { role: 'bot', text: 'Обнаружено: свежесть события, эмоциональное рассуждение.' },
  { role: 'bot', text: 'Overall Score: 42 из 100 — решение частично логично.' },
]

export function HowItWorksSection() {
  const [visible, setVisible] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { amount: 0.35 })

  useEffect(() => {
    if (!inView) return
    const id = window.setInterval(() => {
      setVisible((v) => (v < demoSteps.length - 1 ? v + 1 : v))
    }, 900)
    return () => window.clearInterval(id)
  }, [inView])

  const typed = useMemo(() => demoSteps.slice(0, visible + 1), [visible])

  return (
    <section
      ref={ref}
      className="border-border bg-background border-y py-[120px] md:py-[200px]"
    >
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 md:grid-cols-2 md:px-6">
        <div>
          <p className="text-muted font-mono text-[13px] uppercase tracking-[0.08em]">Как это работает</p>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]">
            Четыре шага. Без утешений.
          </h2>
          <ol className="mt-10 space-y-6 text-lg text-muted">
            <li>
              <span className="text-foreground font-medium">Шаг 01.</span> Ты описываешь ситуацию.
            </li>
            <li>
              <span className="text-foreground font-medium">Шаг 02.</span> Бот задаёт пять уточнений.
            </li>
            <li>
              <span className="text-foreground font-medium">Шаг 03.</span> Анализ по законам и искажениям.
            </li>
            <li>
              <span className="text-foreground font-medium">Шаг 04.</span> Ты получаешь отчёт. В цифрах.
            </li>
          </ol>
        </div>
        <div className="border-border bg-card flex max-h-[480px] flex-col rounded-[12px] border">
          <div className="border-border border-b px-4 py-3 font-mono text-xs uppercase tracking-[0.08em] text-muted">
            Демо-диалог
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {typed.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className={clsx(
                  'max-w-[95%] rounded-[12px] px-4 py-3 text-[15px] leading-relaxed',
                  m.role === 'user'
                    ? 'bg-elevated ml-auto text-foreground'
                    : 'bg-background mr-auto text-muted',
                )}
              >
                {m.role === 'bot' && (
                  <span className="text-accent mb-1 block font-mono text-[11px] uppercase tracking-[0.08em]">
                    Логика
                  </span>
                )}
                {m.text}
              </motion.div>
            ))}
          </div>
          <div className="border-border bg-elevated/60 flex items-center justify-between border-t px-4 py-3">
            <span className="text-dim font-mono text-xs">Превью отчёта</span>
            <span className="text-accent font-mono text-xs">PDF · готово к выгрузке</span>
          </div>
        </div>
      </div>
    </section>
  )
}

const quotes = [
  { t: 'Мыслю, следовательно существую.', a: 'Декарт' },
  { t: 'Человек — раб своих привычек, а не своего разума.', a: 'Аристотель' },
  {
    t: 'Нет ничего труднее, как отличить действительную ошибку от того, что таковою кажется.',
    a: 'Декарт',
  },
  {
    t: 'То, что мы называем интуицией, часто оказывается ленью ума.',
    a: 'Современный парафраз',
  },
  {
    t: 'Между стимулом и реакцией есть пространство. В этом пространстве — наша свобода.',
    a: 'Виктор Франкл',
  },
  { t: 'Когда факты меняются, я меняю мнение. А вы?', a: 'Кейнс' },
  { t: 'Истина — это то, что выдерживает проверку аргумента.', a: 'Парафраз' },
]

export function QuotesSection() {
  return (
    <section className="py-[120px] md:py-[200px]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-6">
        <h2 className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">Цитаты</h2>
        <div className="mt-10 flex gap-6 overflow-x-auto pb-4 md:gap-8">
          {quotes.map((q) => (
            <figure
              key={q.t}
              className="border-border bg-card min-w-[min(100%,380px)] flex-shrink-0 rounded-[12px] border p-8 md:min-w-[420px]"
            >
              <blockquote className="text-2xl font-medium leading-snug tracking-[-0.02em] md:text-[28px]">
                {q.t}
              </blockquote>
              <figcaption className="text-dim mt-8 font-mono text-[13px] uppercase tracking-[0.08em]">
                {q.a}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TariffsSection() {
  const [yearly, setYearly] = useState(false)
  const pro = yearly ? Math.round(790 * 12 * 0.7) : 790
  const unlim = yearly ? Math.round(1490 * 12 * 0.7) : 1490

  return (
    <section className="border-border border-y py-[120px] md:py-[200px]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]">Тарифы</h2>
          <div className="border-border bg-card flex rounded-[4px] border p-1">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={clsx(
                'rounded-[4px] px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors duration-300',
                !yearly ? 'bg-accent text-background' : 'text-muted hover:text-foreground',
              )}
            >
              Месяц
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={clsx(
                'rounded-[4px] px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors duration-300',
                yearly ? 'bg-accent text-background' : 'text-muted hover:text-foreground',
              )}
            >
              Год —30%
            </button>
          </div>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              name: 'FREE',
              price: '0 ₽',
              sub: yearly ? 'при оплате за год не применяется' : 'разовый вход',
              feats: ['1 вопрос', 'Базовый анализ', '—', '—'],
              cta: 'Попробовать',
              highlight: false,
            },
            {
              name: 'PRO',
              badge: 'популярный',
              price: yearly ? `${pro.toLocaleString('ru-RU')} ₽/год` : '790 ₽/мес',
              sub: yearly ? 'эквивалент скидки 30%' : 'для регулярной работы',
              feats: [
                '30 вопросов в месяц',
                'Отчёты в PDF',
                'История 30 дней',
                'Голосовой ввод',
              ],
              cta: 'Выбрать PRO',
              highlight: true,
            },
            {
              name: 'UNLIMITED',
              price: yearly ? `${unlim.toLocaleString('ru-RU')} ₽/год` : '1 490 ₽/мес',
              sub: yearly ? 'для тех, кто не считает вопросы' : 'без потолка',
              feats: [
                'Вопросы без лимита',
                'PDF и приоритет',
                'История без срока',
                'Голос и экспорт',
              ],
              cta: 'Всё включено',
              highlight: false,
            },
          ].map((p) => (
            <div
              key={p.name}
              className={clsx(
                'border-border flex flex-col rounded-[12px] border p-8',
                p.highlight && 'border-accent bg-elevated ring-accent/25 ring-1',
              )}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium">{p.name}</h3>
                {'badge' in p && p.badge && (
                  <span className="bg-accent/15 text-accent rounded-[4px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="mt-6 font-mono text-3xl tracking-tight">{p.price}</p>
              <p className="text-dim mt-2 text-sm">{p.sub}</p>
              <ul className="mt-8 flex-1 space-y-3 text-muted">
                {p.feats.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                className={clsx(
                  'ease-brand mt-10 w-full rounded-[4px] py-3 font-medium transition-all duration-300',
                  p.highlight
                    ? 'bg-accent text-background hover:bg-accent-hover shadow-[0_0_0_1px_rgba(196,245,66,0.35)]'
                    : 'border-border hover:border-border-hover border bg-transparent hover:text-foreground',
                )}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-dim mt-10 text-center text-sm italic">
          Отменить можно в любой момент. Логично же.
        </p>
      </div>
    </section>
  )
}

const faqs = [
  {
    q: 'Это что, терапия?',
    a: 'Нет. Терапевт лечит душу, мы — мышление. Разница принципиальная.',
  },
  {
    q: 'А если я не согласен с выводом бота?',
    a: 'Отлично. Значит ты впервые за день думаешь. Спор с логикой рождает логику.',
  },
  {
    q: 'Мои данные в безопасности?',
    a: 'Запросы шифруются, не продаются, не используются для обучения. Через 30 дней удаляются автоматически, если не продлишь подписку.',
  },
  {
    q: 'Почему именно четыре закона логики?',
    a: 'Потому что они работают 2400 лет. Если придумаешь пятый — напиши, добавим.',
  },
  {
    q: 'Можно ли обмануть бота?',
    a: 'Можно. Но тогда обманешь сам себя — за свои же деньги. Парадокс, правда?',
  },
  {
    q: 'Чем это отличается от универсальных чатов?',
    a: 'Они отвечают. Логика — разбирает твой ответ. Это не разговор. Это проверка.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="mx-auto max-w-[800px] px-4 py-[120px] md:px-6 md:py-[200px]">
      <h2 className="text-center text-[clamp(2rem,4vw,2.5rem)] font-medium tracking-[-0.02em]">
        Вопросы, которые уже задали
      </h2>
      <div className="mt-12 space-y-3">
        {faqs.map((item, i) => {
          const isOpen = open === i
          return (
            <div key={item.q} className="border-border bg-card rounded-[12px] border">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left text-lg font-medium"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={clsx(
                    'mt-1 h-5 w-5 shrink-0 text-muted transition-transform duration-300',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.35, ease }}
                className="overflow-hidden"
              >
                <p className="text-muted px-6 pb-5 text-[15px] leading-relaxed">{item.a}</p>
              </motion.div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ReviewsSection() {
  const items = [
    {
      name: 'Арина С.',
      meta: '29, продукт',
      t: 'Я думала, что просто «устала». Оказалось, я путаю усталость со страхом.',
    },
    {
      name: 'Михаил В.',
      meta: '41, основатель',
      t: 'Отчёт в PDF отправил партнёру. Спор закончился фактами, не криком.',
    },
    {
      name: 'Елена К.',
      meta: '24, студентка',
      t: 'Мне было стыдно за честный ответ боту. Это и было ценно.',
    },
  ]
  return (
    <section className="border-border border-t py-[120px] md:py-[160px]">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 md:grid-cols-3 md:px-6">
        {items.map((r) => (
          <blockquote key={r.name} className="border-border bg-card rounded-[12px] border p-8">
            <p className="text-lg leading-relaxed text-muted">{r.t}</p>
            <footer className="text-dim mt-8 font-mono text-[13px] uppercase tracking-[0.08em]">
              {r.name} · {r.meta}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}
