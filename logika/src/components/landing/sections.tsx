import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { ChevronDown, Mic } from 'lucide-react'
import { clsx } from 'clsx'
import { useCountUp } from '../../hooks/useCountUp'

export { ArgumentMap } from './ArgumentMap'

const ease = [0.32, 0.72, 0, 1] as const

export function Ticker() {
  const items = [
    '35 000 решений в день',
    '180 когнитивных искажений',
    '4 закона логики',
    '2 400 лет философии',
    'и 0 секунд на то, чтобы подумать',
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
        .animate-marquee { animation: marquee 34s linear infinite; }
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
        label="решений в день — ты принимаешь на автопилоте. И ни одно не помнишь."
        source="Когнитивная нагрузка, ежедневная рутинная статистика решений."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={95}
        suffix="%"
        label="из них эмоциональные. Рационализация — уже потом, задним числом."
        source="Канеман, Тверски — System 1 vs System 2."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={180}
        label="когнитивных искажений работают прямо сейчас. Ты не видишь ни одного."
        source="Сводная классификация biases, Wikipedia + IEP."
      />
      <div className="h-16 md:h-24" />
      <StatCard
        value={0}
        label="раз сегодня ты проверил хоть одно из своих решений логикой."
        source="Счётчик не врёт. Пока ты это читаешь — он всё ещё ноль."
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
      'Если ты называешь это «любовью» в начале разговора, это должно быть любовью и в конце. Смена смысла на ходу — не рост, а подмена.',
  },
  {
    n: '02',
    title: 'ЗАКОН НЕПРОТИВОРЕЧИЯ',
    f: 'A ≠ ¬A',
    text:
      'Нельзя хотеть свободы и стабильности в одной точке, в одно и то же время. Если хочешь — одно из двух ты себе не признаёшь.',
  },
  {
    n: '03',
    title: 'ЗАКОН ИСКЛЮЧЁННОГО ТРЕТЬЕГО',
    f: 'A ∨ ¬A',
    text:
      'Либо ты уходишь, либо остаёшься. «Подумаю» — это не третий вариант, это отсрочка боли.',
  },
  {
    n: '04',
    title: 'ЗАКОН ДОСТАТОЧНОГО ОСНОВАНИЯ',
    f: 'A → B',
    text:
      'За каждым «я решил» должно стоять «потому что». Если «потому что» отсутствует — решение принял не ты, а твоё настроение.',
  },
]

export function LawsSection() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-[120px] md:px-6 md:py-[200px]">
      <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">Методология</p>
      <h2 className="mt-4 text-[clamp(2rem,5vw,3rem)] font-medium tracking-[-0.02em]">
        Четыре опоры. Одна проверка.
        <br />
        <span className="text-muted">2 400 лет без обновлений.</span>
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

const quotes = [
  { t: 'Мыслю — значит, существую. А что ты делал всё это время?', a: 'Декарт / переосмыслено' },
  { t: 'Человек — раб своих привычек, а не своего разума.', a: 'Аристотель' },
  {
    t: 'Нет ничего труднее, чем отличить действительную ошибку от той, что лишь кажется.',
    a: 'Декарт',
  },
  {
    t: 'То, что мы называем интуицией, часто оказывается ленью ума.',
    a: 'Современный парафраз',
  },
  {
    t: 'Между стимулом и реакцией есть пространство. В этом пространстве — твоя свобода.',
    a: 'Виктор Франкл',
  },
  { t: 'Когда факты меняются — я меняю мнение. А ты?', a: 'Кейнс' },
  { t: 'Истина — это то, что выдерживает давление аргумента.', a: 'Парафраз' },
]

export function QuotesSection() {
  return (
    <section className="py-[120px] md:py-[200px]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-6">
        <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">
          Цитаты, которые перестали быть цитатами
        </p>
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
          <div>
            <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">Тарифы</p>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.02em]">
              Подписка на ясность мышления
            </h2>
          </div>
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
              sub: yearly ? 'без скидки за год' : 'один разбор, без карты',
              feats: [
                '1 разбор — навсегда',
                'Базовый отчёт',
                '—',
                '—',
              ],
              cta: 'Задать один вопрос',
              highlight: false,
              voice: false,
            },
            {
              name: 'PRO',
              badge: 'большинство берут',
              price: yearly ? `${pro.toLocaleString('ru-RU')} ₽/год` : '790 ₽/мес',
              sub: yearly ? '~553 ₽/мес при оплате за год' : 'для тех, кто решает каждую неделю',
              feats: [
                '30 разборов в месяц',
                'PDF-отчёт со всеми законами',
                'История и сравнение 30 дней',
                'Карта аргумента в диалоге',
              ],
              cta: 'Подключить PRO',
              highlight: true,
              voice: false,
            },
            {
              name: 'ULTRA',
              badge: 'голос',
              price: yearly ? `${unlim.toLocaleString('ru-RU')} ₽/год` : '1 490 ₽/мес',
              sub: yearly ? '~1 043 ₽/мес' : 'решения без лимитов и без клавиатуры',
              feats: [
                'Безлимит разборов',
                'Голосовые ответы (можно надиктовать)',
                'История без срока + экспорт',
                'Приоритет анализа и поддержки',
              ],
              cta: 'Взять ULTRA',
              highlight: false,
              voice: true,
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
                  <span
                    className={clsx(
                      'rounded-[4px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                      p.voice
                        ? 'border border-accent/40 text-accent'
                        : 'bg-accent/15 text-accent',
                    )}
                  >
                    {p.voice && <Mic className="mr-1 inline h-2.5 w-2.5 -translate-y-px" />}
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="mt-6 font-mono text-3xl tracking-tight">{p.price}</p>
              <p className="text-dim mt-2 text-sm">{p.sub}</p>
              <ul className="mt-8 flex-1 space-y-3 text-muted">
                {p.feats.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className={clsx('mt-2 inline-block h-1 w-1 rounded-full', f === '—' ? 'bg-dim' : 'bg-accent')} />
                    <span>{f}</span>
                  </li>
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
          Отменить можно в любой момент. Иначе какая же это логика.
        </p>
      </div>
    </section>
  )
}

const faqs = [
  {
    q: 'Это что, терапия?',
    a: 'Нет. Терапевт работает с тем, что ты чувствуешь. Логика — с тем, как ты рассуждаешь. Это параллельные инструменты, не конкурирующие.',
  },
  {
    q: 'А если я не соглашусь с выводом бота?',
    a: 'Отлично. Значит, ты впервые за день думаешь. Спор с логикой — это и есть логика. Проигрывает только тот, кто молча соглашается.',
  },
  {
    q: 'Чем вы отличаетесь от ChatGPT и Claude?',
    a: 'Они отвечают — Логика разбирает твой ответ. У универсального ИИ задача — угодить. У нас — показать противоречие. Это не разговор. Это проверка.',
  },
  {
    q: 'Мои данные кто-нибудь читает?',
    a: 'Нет. Запросы шифруются при передаче и хранении, не используются для обучения моделей, не передаются третьим лицам. Через 30 дней после окончания подписки — удаляются автоматически.',
  },
  {
    q: 'Почему именно четыре закона?',
    a: 'Потому что они работают 2 400 лет — от Аристотеля до современной формальной логики. Если придумаешь пятый — напиши, добавим.',
  },
  {
    q: 'Можно ли обмануть бота — написать красиво и получить высокий балл?',
    a: 'Можно. Но тогда ты обманешь не бота, а себя — за свои же деньги. Странный сценарий.',
  },
  {
    q: 'Голосовые сообщения — это как?',
    a: 'На тарифе ULTRA: надиктовываешь ответ, Логика транскрибирует и анализирует так же, как текст. Удобно ночью, в дороге, когда писать лень, а решать — надо.',
  },
  {
    q: 'В Telegram есть?',
    a: 'Скоро. Тот же разбор, тот же PDF, без установки. Подписка — общая.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="mx-auto max-w-[800px] px-4 py-[120px] md:px-6 md:py-[200px]">
      <p className="text-dim text-center font-mono text-[13px] uppercase tracking-[0.08em]">FAQ</p>
      <h2 className="mt-4 text-center text-[clamp(2rem,4vw,2.5rem)] font-medium tracking-[-0.02em]">
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
      meta: '29, PM',
      t: 'Думала, что «устала от работы». Логика показала, что я путаю усталость со страхом не справиться. Поменяла не работу, а ожидания.',
    },
    {
      name: 'Михаил В.',
      meta: '41, фаундер',
      t: 'Отчёт в PDF отправил партнёру вместо спора. Через час он написал «ты прав по пункту три». Впервые спор закончился фактами, а не криком.',
    },
    {
      name: 'Елена К.',
      meta: '24, студентка',
      t: 'Мне было стыдно за свой честный ответ боту. Это и было ценно — никто больше этого ответа не видел, кроме меня.',
    },
  ]
  return (
    <section className="border-border border-t py-[120px] md:py-[160px]">
      <div className="mx-auto max-w-[1280px] px-4 md:px-6">
        <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">Отзывы</p>
        <h2 className="mt-4 max-w-[800px] text-[clamp(2rem,4vw,2.75rem)] font-medium tracking-[-0.02em]">
          Они писали это не нам. Они писали это себе.
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {items.map((r) => (
            <blockquote key={r.name} className="border-border bg-card rounded-[12px] border p-8">
              <p className="text-lg leading-relaxed text-muted">«{r.t}»</p>
              <footer className="text-dim mt-8 font-mono text-[13px] uppercase tracking-[0.08em]">
                {r.name} · {r.meta}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
