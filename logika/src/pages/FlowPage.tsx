import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, Lock, Check, X, AlertTriangle, Sparkles } from 'lucide-react'
import { Logo } from '../components/Logo'
import { HeroFork } from '../components/landing/HeroFork'
import { useCountUp } from '../hooks/useCountUp'

type Phase =
  | 'phone'
  | 'code'
  | 'onb1'
  | 'onb2'
  | 'onb3'
  | 'onb4'
  | 'chat'
  | 'analyze'
  | 'report'
  | 'cabinet'

const botQuestions = [
  'Ты принял это решение за последние 7 дней? Или оно зрело месяцами?',
  'Противоречит ли оно тому, что ты говорил себе полгода назад?',
  'Какой факт сейчас самый неудобный — тот, от которого хочется отмахнуться?',
  'Ты ищешь ясность или одобрение? Отвечай честно, я не обижусь.',
  'Если убрать цифры, сроки и давление — что останется от аргумента?',
]

const analyzeLines = [
  'Разбираю ответы на атомы…',
  'Проверяю закон тождества…',
  'Ищу скрытые противоречия…',
  'Нахожу когнитивные искажения…',
  'Сопоставляю с 2 400 годами философии…',
  'Собираю альтернативы…',
  'Формулирую вердикт…',
]

const ease = [0.32, 0.72, 0, 1] as const

const laws = [
  {
    t: 'Тождество',
    f: 'A = A',
    s: 'частично' as const,
    d: 'Формулировка запроса меняется: «хочу уйти» → «устал» → «не справляюсь». Понятия скользят.',
  },
  {
    t: 'Непротиворечие',
    f: 'A ≠ ¬A',
    s: 'да' as const,
    d: 'Прямого столкновения утверждений в одной плоскости не обнаружено.',
  },
  {
    t: 'Исключённое третье',
    f: 'A ∨ ¬A',
    s: 'нет' as const,
    d: 'Сценарии «остаться» / «уйти» предъявлены как финальные. Третьи варианты не рассматривались.',
  },
  {
    t: 'Достаточное основание',
    f: 'A → B',
    s: 'частично' as const,
    d: 'Причины названы, но не отделены от эмоции. Независимых критериев проверки — нет.',
  },
]

function FlowPage() {
  const [phase, setPhase] = useState<Phase>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [firstQ, setFirstQ] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [analyzeLine, setAnalyzeLine] = useState(0)
  const [showPaywall, setShowPaywall] = useState(true)
  const [showUltra, setShowUltra] = useState(false)
  const [cabinetTab, setCabinetTab] = useState<'history' | 'stats' | 'settings'>('history')
  const [commitFollowup, setCommitFollowup] = useState(false)

  useEffect(() => {
    if (phase !== 'analyze') return
    const id = window.setInterval(() => {
      setAnalyzeLine((i) => (i + 1) % analyzeLines.length)
    }, 900)
    const done = window.setTimeout(() => setPhase('report'), 4600)
    return () => {
      clearInterval(id)
      clearTimeout(done)
    }
  }, [phase])

  const score = 42
  const scoreView = useCountUp(score, phase === 'report')

  const chartData = useMemo(
    () => [
      { m: 'Янв', s: 54 },
      { m: 'Фев', s: 61 },
      { m: 'Мар', s: 48 },
      { m: 'Апр', s: 78 },
    ],
    [],
  )

  const biasData = [
    { name: 'Свежее', v: 12 },
    { name: 'Подтверждение', v: 9 },
    { name: 'Чёрно-белое', v: 7 },
  ]

  const submitAnswer = () => {
    const t = draft.trim()
    if (!t || answers.length >= 5) return
    const next = [...answers, t]
    setAnswers(next)
    setDraft('')
    if (next.length === 5) setPhase('analyze')
  }

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border flex items-center justify-between border-b px-4 py-4 md:px-8">
        <Link to="/" className="hover:text-accent transition-colors">
          <Logo />
        </Link>
        <Link
          to="/"
          className="text-dim hover:text-foreground font-mono text-[13px] uppercase tracking-[0.08em]"
        >
          На лендинг
        </Link>
      </header>

      <AnimatePresence mode="wait">
        {(phase === 'phone' || phase === 'code') && (
          <AuthSection
            phase={phase}
            phone={phone}
            code={code}
            setPhone={setPhone}
            setCode={setCode}
            onNext={() => setPhase(phase === 'phone' ? 'code' : 'onb1')}
          />
        )}

        {phase.startsWith('onb') && (
          <OnboardingSection
            phase={phase}
            firstQ={firstQ}
            setFirstQ={setFirstQ}
            setPhase={setPhase}
          />
        )}

        {phase === 'chat' && (
          <ChatSection
            firstQ={firstQ}
            answers={answers}
            draft={draft}
            setDraft={setDraft}
            onSubmit={submitAnswer}
            onVoice={() => setShowUltra(true)}
          />
        )}

        {phase === 'analyze' && (
          <AnalyzeSection line={analyzeLines[analyzeLine]} lines={analyzeLines} index={analyzeLine} />
        )}

        {phase === 'report' && (
          <ReportSection
            score={score}
            scoreView={scoreView}
            firstQ={firstQ}
            laws={laws}
            commitFollowup={commitFollowup}
            setCommitFollowup={setCommitFollowup}
            showPaywall={showPaywall}
            setShowPaywall={setShowPaywall}
            goCabinet={() => setPhase('cabinet')}
          />
        )}

        {phase === 'cabinet' && (
          <CabinetSection
            tab={cabinetTab}
            setTab={setCabinetTab}
            chartData={chartData}
            biasData={biasData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUltra && <UltraModal onClose={() => setShowUltra(false)} />}
      </AnimatePresence>
    </div>
  )
}

export default FlowPage

/* =========== AUTH =========== */

function AuthSection({
  phase,
  phone,
  code,
  setPhone,
  setCode,
  onNext,
}: {
  phase: 'phone' | 'code'
  phone: string
  code: string
  setPhone: (v: string) => void
  setCode: (v: string) => void
  onNext: () => void
}) {
  return (
    <motion.section
      key="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease }}
      className="mx-auto grid max-w-[960px] gap-12 px-4 py-16 md:grid-cols-2 md:py-24"
    >
      <div className="border-border bg-card relative hidden min-h-[320px] overflow-hidden rounded-[12px] border md:block">
        <HeroFork />
      </div>
      <div>
        <p className="text-accent font-mono text-[13px] uppercase tracking-[0.12em]">
          Один вопрос — одна истина.
        </p>
        {phase === 'phone' && (
          <>
            <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
              Начнём с номера.
            </h1>
            <p className="text-muted mt-4 leading-relaxed">
              Без паролей и регистраций — один SMS, и ты внутри. Аккаунт создастся сам.
            </p>
            <label className="mt-10 block">
              <span className="text-dim font-mono text-xs uppercase tracking-[0.08em]">+7</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="___ ___ __ __"
                className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-2 w-full rounded-[4px] border px-4 py-3 text-lg outline-none transition-all duration-300 focus:ring-2"
              />
            </label>
            <button
              type="button"
              onClick={onNext}
              className="ease-brand bg-accent text-background hover:bg-accent-hover mt-8 w-full rounded-[4px] py-3 font-medium transition-all duration-300"
            >
              Получить код
              <span className="ml-1">→</span>
            </button>
            <p className="text-dim mt-8 text-sm leading-relaxed">
              Нажимая, ты соглашаешься с офертой. Мы не пишем в поддержку первыми и не звоним.
            </p>
          </>
        )}
        {phase === 'code' && (
          <>
            <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
              Код из SMS.
            </h1>
            <p className="text-muted mt-4 leading-relaxed">
              Шесть цифр. Если не пришло за 30 секунд — запроси повторно.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-10 w-full rounded-[4px] border px-4 py-4 font-mono text-2xl tracking-[0.4em] outline-none transition-all duration-300 focus:ring-2"
              placeholder="••••••"
            />
            <button
              type="button"
              onClick={onNext}
              disabled={code.length < 4}
              className="ease-brand bg-accent text-background hover:bg-accent-hover mt-8 w-full rounded-[4px] py-3 font-medium transition-all duration-300 disabled:opacity-40"
            >
              Войти
            </button>
          </>
        )}
      </div>
    </motion.section>
  )
}

/* =========== ONBOARDING =========== */

function OnboardingSection({
  phase,
  firstQ,
  setFirstQ,
  setPhase,
}: {
  phase: Phase
  firstQ: string
  setFirstQ: (v: string) => void
  setPhase: (p: Phase) => void
}) {
  return (
    <motion.section
      key={phase}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.4, ease }}
      className="flex min-h-[calc(100dvh-72px)] flex-col px-4 py-12 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <div className="flex gap-2">
          {['onb1', 'onb2', 'onb3', 'onb4'].map((p, i) => (
            <div
              key={p}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                phase === p || ['onb1', 'onb2', 'onb3', 'onb4'].indexOf(phase) > i
                  ? 'bg-accent'
                  : 'bg-border',
              )}
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col justify-center">
          {phase === 'onb1' && (
            <OnbSlide
              tag="01 / твоя позиция"
              title="Ты сейчас — точка."
              body="Одно решение, одна ситуация, одна голова. Всё остальное — контекст, который ты подтягиваешь, чтобы оправдать выбор."
              onNext={() => setPhase('onb2')}
            />
          )}
          {phase === 'onb2' && (
            <OnbSlide
              tag="02 / то, что перед тобой"
              title="Варианты кажутся разными."
              body="На самом деле половина из них — один и тот же выбор в разной обёртке. Другая половина — пути, о которых ты ещё не подумал."
              onNext={() => setPhase('onb3')}
            />
          )}
          {phase === 'onb3' && (
            <OnbSlide
              tag="03 / что делает логика"
              title="Мы не спорим. Мы проверяем."
              body="Каждый аргумент — через четыре закона логики и сто восемьдесят искажений. То, что выдержит, — твоё. Остальное — чужой голос у тебя в голове."
              onNext={() => setPhase('onb4')}
            />
          )}
          {phase === 'onb4' && (
            <div>
              <p className="text-accent font-mono text-[13px] uppercase tracking-[0.12em]">
                04 / твой первый вопрос
              </p>
              <h2 className="mt-5 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                Опиши дилемму. Как себе в 3 часа ночи.
              </h2>
              <p className="text-muted mt-4 text-lg leading-relaxed">
                Не для нас, не для резюме. Для себя. Чем честнее формулировка — тем точнее разбор.
                Сохраняется шифрованно, никто кроме тебя не увидит.
              </p>
              <textarea
                value={firstQ}
                onChange={(e) => setFirstQ(e.target.value)}
                placeholder='Например: «Уволиться ли сейчас или ещё полгода потерпеть — при том, что деньги есть, но смысла нет»'
                rows={6}
                className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-8 w-full rounded-[12px] border p-4 text-[15px] leading-relaxed outline-none transition-all duration-300 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setPhase('chat')}
                disabled={firstQ.trim().length < 8}
                className="ease-brand bg-accent text-background hover:bg-accent-hover mt-6 rounded-[4px] px-6 py-3 font-medium transition-all duration-300 disabled:opacity-40"
              >
                Начать разбор
                <span className="ml-1">→</span>
              </button>
              <p className="text-dim mt-3 font-mono text-xs uppercase tracking-[0.08em]">
                следующий шаг — пять уточняющих вопросов
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  )
}

function OnbSlide({
  tag,
  title,
  body,
  onNext,
}: {
  tag: string
  title: string
  body: string
  onNext: () => void
}) {
  return (
    <div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="bg-accent/15 mx-auto mb-12 h-40 w-40 rounded-full blur-3xl"
      />
      <p className="text-accent text-center font-mono text-[13px] uppercase tracking-[0.12em]">
        {tag}
      </p>
      <h2 className="mt-5 text-center text-3xl font-medium leading-[1.05] tracking-[-0.02em] md:text-5xl">
        {title}
      </h2>
      <p className="text-muted mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed">
        {body}
      </p>
      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-8 py-3 font-medium transition-all duration-300"
        >
          Дальше
          <span className="ml-1">→</span>
        </button>
      </div>
    </div>
  )
}

/* =========== CHAT =========== */

function ChatSection({
  firstQ,
  answers,
  draft,
  setDraft,
  onSubmit,
  onVoice,
}: {
  firstQ: string
  answers: string[]
  draft: string
  setDraft: (v: string) => void
  onSubmit: () => void
  onVoice: () => void
}) {
  const step = Math.min(answers.length + 1, 5)
  const percent = Math.round((step / 5) * 100)
  return (
    <motion.section
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-[720px] flex-col px-4 py-8"
    >
      <div className="mb-4">
        <div className="text-dim flex items-center justify-between font-mono text-[13px] uppercase tracking-[0.08em]">
          <span>
            Вопрос <span className="text-foreground">{step}</span> из 5
          </span>
          <span>{percent}%</span>
        </div>
        <div className="bg-border mt-2 h-1 w-full rounded-full">
          <motion.div
            className="bg-accent h-1 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease }}
          />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto pb-28">
        <Bubble role="user" text={firstQ} />
        {answers.map((a, i) => (
          <div key={i} className="space-y-4">
            <Bubble role="bot" text={botQuestions[i]} />
            <Bubble role="user" text={a} />
          </div>
        ))}
        {answers.length < 5 && <Bubble role="bot" text={botQuestions[answers.length]} />}
      </div>
      <div className="border-border bg-background/90 fixed bottom-0 left-0 right-0 border-t p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[720px] items-center gap-3">
          <button
            type="button"
            onClick={onVoice}
            title="Голосовой ответ — на тарифе ULTRA"
            aria-label="Голосовой ответ"
            className="border-border hover:border-accent hover:text-accent relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] border bg-elevated text-muted transition-colors duration-300"
          >
            <Mic className="h-4 w-4" />
            <span className="bg-accent absolute -right-1 -top-1 rounded-full px-1 py-[1px] font-mono text-[8px] font-medium uppercase text-background">
              Ultra
            </span>
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
            }}
            placeholder="Напиши, как другу. Или нажми микрофон →"
            className="border-border bg-elevated focus:border-accent flex-1 rounded-[12px] border px-4 py-3 text-[15px] outline-none transition-colors duration-300"
          />
          <button
            type="button"
            onClick={onSubmit}
            className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-4 py-3 font-medium transition-all duration-300"
          >
            Ответить
          </button>
        </div>
      </div>
    </motion.section>
  )
}

function Bubble({ role, text }: { role: 'user' | 'bot'; text: string }) {
  return (
    <div className={clsx('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-[12px] px-4 py-3 text-[15px] leading-relaxed',
          role === 'user' ? 'bg-elevated text-foreground' : 'bg-card text-muted',
        )}
      >
        {role === 'bot' && (
          <div className="mb-1 flex items-center gap-2">
            <span className="bg-accent inline-block h-2 w-2 rounded-full" />
            <span className="text-dim font-mono text-[11px] uppercase tracking-[0.08em]">
              Логика
            </span>
          </div>
        )}
        {text}
      </div>
    </div>
  )
}

/* =========== ANALYZE =========== */

function AnalyzeSection({
  line,
  lines,
  index,
}: {
  line: string
  lines: string[]
  index: number
}) {
  return (
    <motion.section
      key="analyze"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center px-4"
    >
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="bg-accent h-2 w-2 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <p className="text-foreground mt-10 min-h-[1.5em] font-mono text-sm uppercase tracking-[0.08em]">
        {line}
      </p>
      <ol className="mt-10 w-full max-w-[320px] space-y-2 font-mono text-[12px] uppercase tracking-[0.08em]">
        {lines.map((l, i) => (
          <li
            key={l}
            className={clsx(
              'flex items-center gap-2 transition-colors',
              i < index && 'text-accent',
              i === index && 'text-foreground',
              i > index && 'text-dim',
            )}
          >
            <span className="w-4">
              {i < index ? '✓' : i === index ? '›' : '·'}
            </span>
            <span>{l}</span>
          </li>
        ))}
      </ol>
    </motion.section>
  )
}


/* =========== REPORT =========== */

function ReportSection({
  score,
  scoreView,
  firstQ,
  laws,
  commitFollowup,
  setCommitFollowup,
  showPaywall,
  setShowPaywall,
  goCabinet,
}: {
  score: number
  scoreView: number
  firstQ: string
  laws: { t: string; f: string; s: 'да' | 'нет' | 'частично'; d: string }[]
  commitFollowup: boolean
  setCommitFollowup: (v: boolean) => void
  showPaywall: boolean
  setShowPaywall: (v: boolean) => void
  goCabinet: () => void
}) {
  const scoreColor = score < 40 ? '#ff4d4d' : score < 70 ? '#ffb23d' : '#c4f542'
  const verdict =
    score < 40 ? 'Решение нелогично' : score < 70 ? 'Решение частично логично' : 'Решение логично'
  const passed = laws.filter((l) => l.s === 'да').length
  const partial = laws.filter((l) => l.s === 'частично').length
  const failed = laws.filter((l) => l.s === 'нет').length
  const biases = 3
  const question = firstQ.trim() || 'Стоит ли менять работу на стартап?'
  const today = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <motion.section
      key="report"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[960px] px-4 py-8 md:py-12"
    >
      {/* Document meta bar */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-dim">
        <span>Аналитический отчёт · {today}</span>
        <span>id · LG-{score.toString().padStart(2, '0')}4E2</span>
      </div>

      {/* Hero: "Your words" + score + verdict */}
      <div className="border-border mt-6 overflow-hidden rounded-[16px] border bg-card">
        <div className="relative p-6 md:p-10">
          <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">
            Исходный запрос
          </p>
          <p className="mt-3 text-balance text-xl font-medium leading-snug tracking-[-0.01em] md:text-2xl">
            «{question}»
          </p>
        </div>
        <div className="border-border grid gap-0 border-t md:grid-cols-[minmax(0,auto)_1fr]">
          <div
            className="border-border flex min-w-[180px] flex-col items-start justify-center border-b p-6 md:border-b-0 md:border-r md:p-10"
            style={{ background: 'rgba(196,245,66,0.03)' }}
          >
            <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">Оценка</p>
            <div className="mt-2 flex items-baseline gap-2">
              <motion.span
                className="text-[clamp(4rem,14vw,7.5rem)] font-medium leading-none tracking-[-0.04em]"
                style={{ color: scoreColor }}
              >
                {scoreView}
              </motion.span>
              <span className="text-dim font-mono text-lg">/ 100</span>
            </div>
            <p className="mt-3 text-lg font-medium tracking-[-0.01em]">{verdict}</p>
          </div>
          <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
            <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">Вердикт</p>
            <p className="text-[17px] leading-relaxed text-foreground md:text-lg">
              Два закона из четырёх выдержаны. Тождество и достаточное основание —{' '}
              <span className="text-warn">частично</span>. Исключённое третье —{' '}
              <span className="text-danger">не выдержано</span>: альтернативы сведены к бинарному
              выбору. Обнаружено {biases} когнитивных искажения, ведущих.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <Stat label="Выдержано" value={passed} color="#c4f542" icon="check" />
              <Stat label="Частично" value={partial} color="#ffb23d" icon="warn" />
              <Stat label="Нарушено" value={failed} color="#ff4d4d" icon="x" />
            </div>
          </div>
        </div>
      </div>

      {/* Mirror block */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="border-border bg-card rounded-[12px] border p-6 md:p-8">
          <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">
            Твои слова
          </p>
          <p className="mt-4 text-lg italic leading-relaxed text-muted">
            «Я не справляюсь с этой работой, хочу уйти, но деньги держат».
          </p>
        </div>
        <div className="border-border bg-card rounded-[12px] border p-6 md:p-8">
          <p className="text-accent font-mono text-[11px] uppercase tracking-[0.12em]">
            Что ты структурно сказал
          </p>
          <ul className="mt-4 space-y-2 font-mono text-[13px] leading-relaxed">
            <li>
              <span className="text-dim">П1.</span> Текущая работа превышает мою ёмкость.
            </li>
            <li>
              <span className="text-dim">П2.</span> Доход — основная удерживающая сила.
            </li>
            <li>
              <span className="text-dim">∴</span>{' '}
              <span className="text-foreground">C.</span> Я решаю оставаться из-за П2, несмотря на
              П1.
            </li>
            <li className="text-danger">! Проверка: П2 измерена? П1 — факт или ощущение?</li>
          </ul>
        </div>
      </div>

      {/* Laws grid */}
      <div className="mt-12">
        <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">
          Четыре закона логики
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {laws.map((row) => (
            <div
              key={row.t}
              className="border-border bg-card rounded-[12px] border p-6 transition-colors hover:border-border-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium tracking-[-0.01em]">{row.t}</h3>
                  <p className="text-dim mt-1 font-mono text-xs">{row.f}</p>
                </div>
                <LawVerdict s={row.s} />
              </div>
              <p className="text-muted mt-4 text-sm leading-relaxed">{row.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Biases */}
      <div className="mt-12">
        <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">
          Когнитивные искажения
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              n: 'Свежесть события',
              d: 'Недавний провал даёт непропорциональный вес негативу.',
            },
            {
              n: 'Поиск подтверждения',
              d: 'Аргументы «за» копятся быстрее, чем контрпримеры.',
            },
            {
              n: 'Чёрно-белое мышление',
              d: 'Серединный сценарий сведён к отсрочке и не рассмотрен.',
            },
          ].map((x) => (
            <li key={x.n} className="border-border bg-elevated rounded-[12px] border p-5">
              <p className="text-danger font-mono text-[11px] uppercase tracking-[0.08em]">
                {x.n}
              </p>
              <p className="text-muted mt-3 text-sm leading-relaxed">{x.d}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Alternatives */}
      <div className="mt-12">
        <p className="text-dim font-mono text-[11px] uppercase tracking-[0.12em]">
          Альтернативы, которые ты не рассматривал
        </p>
        <ol className="mt-4 space-y-3">
          {[
            {
              t: 'Сценарий А',
              d: 'Остаться на 90 дней с измеримым экспериментом — снижает импульс, даёт данные.',
            },
            {
              t: 'Сценарий Б',
              d: 'Уточнить финансовый буфер в числах — убирает страх как единственный аргумент.',
            },
            {
              t: 'Сценарий В',
              d: 'Сменить контекст без смены работы — проверка гипотезы без точки невозврата.',
            },
          ].map((a, i) => (
            <li
              key={a.t}
              className="border-border bg-card flex gap-4 rounded-[12px] border p-5"
            >
              <span className="text-accent font-mono text-sm font-medium">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="font-medium">{a.t}</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">{a.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Quote */}
      <blockquote className="border-border bg-card mt-12 rounded-[20px] border p-8 text-center md:p-12">
        <p className="text-2xl font-medium leading-snug tracking-[-0.02em] md:text-3xl">
          «Когда факты меняются, я меняю мнение. А ты?»
        </p>
        <footer className="text-dim mt-8 font-mono text-[13px] uppercase tracking-[0.08em]">
          Кейнс
        </footer>
      </blockquote>

      {/* Follow-up commitment */}
      <label className="border-border bg-elevated mt-8 flex cursor-pointer items-start gap-4 rounded-[12px] border p-5 transition-colors hover:border-border-hover">
        <input
          type="checkbox"
          checked={commitFollowup}
          onChange={(e) => setCommitFollowup(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#c4f542]"
        />
        <div>
          <p className="font-medium">
            В пятницу Логика спросит: ты это сделал?{' '}
            <Sparkles className="inline h-3 w-3 -translate-y-px text-accent" />
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            Единственный способ понять, было решение рациональным — дождаться результата.
            Напомним один раз, без спама.
          </p>
        </div>
      </label>

      {/* Actions */}
      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href="/pdf-preview.html"
          target="_blank"
          rel="noreferrer"
          className="ease-brand border-border hover:border-border-hover rounded-[4px] border px-5 py-3 font-medium transition-colors duration-300"
        >
          Скачать PDF
        </a>
        <button
          type="button"
          onClick={goCabinet}
          className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-5 py-3 font-medium transition-all duration-300"
        >
          В кабинет
        </button>
        <button
          type="button"
          className="text-muted hover:text-foreground font-medium underline-offset-4 transition-colors hover:underline"
        >
          Поделиться ссылкой
        </button>
      </div>

      {showPaywall && (
        <div className="bg-background/75 fixed inset-0 z-40 flex items-end justify-center backdrop-blur-sm md:items-center">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="border-border bg-elevated m-4 w-full max-w-[960px] rounded-[20px] border p-6 shadow-2xl md:p-8"
          >
            <p className="text-accent font-mono text-[11px] uppercase tracking-[0.12em]">
              Твой первый разбор закрыт
            </p>
            <h3 className="mt-3 text-xl font-medium tracking-[-0.02em] md:text-2xl">
              Остальные 34 999 решений этого месяца — с Логикой?
            </h3>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                { n: 'FREE', p: '0 ₽', note: 'ещё 0 разборов' },
                { n: 'PRO', p: '790 ₽/мес', note: '30 разборов, PDF, карта' },
                { n: 'ULTRA', p: '1 490 ₽/мес', note: 'безлимит + голос' },
              ].map((x) => (
                <div key={x.n} className="border-border bg-card rounded-[12px] border p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{x.n}</p>
                  <p className="mt-3 text-lg font-medium">{x.p}</p>
                  <p className="text-dim mt-1 text-xs">{x.note}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPaywall(false)}
              className="text-dim hover:text-foreground mt-6 text-sm underline-offset-4 transition-colors hover:underline"
            >
              Продолжить читать отчёт
            </button>
          </motion.div>
        </div>
      )}
    </motion.section>
  )
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon: 'check' | 'warn' | 'x'
}) {
  const Icon = icon === 'check' ? Check : icon === 'warn' ? AlertTriangle : X
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5" style={{ color }}>
        <Icon className="h-3 w-3" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-medium tracking-tight" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function LawVerdict({ s }: { s: 'да' | 'нет' | 'частично' }) {
  const cfg =
    s === 'да'
      ? { color: '#c4f542', label: 'выдержан', Icon: Check }
      : s === 'нет'
        ? { color: '#ff4d4d', label: 'нарушен', Icon: X }
        : { color: '#ffb23d', label: 'частично', Icon: AlertTriangle }
  const Icon = cfg.Icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ color: cfg.color, borderColor: `${cfg.color}55` }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

/* =========== ULTRA MODAL =========== */

function UltraModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-background/75 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm md:items-center"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="border-border bg-elevated m-4 w-full max-w-[480px] rounded-[20px] border p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="bg-accent/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]">
            <Mic className="text-accent h-5 w-5" />
          </div>
          <div>
            <p className="text-accent font-mono text-[11px] uppercase tracking-[0.12em]">
              ULTRA · голос
            </p>
            <h3 className="mt-2 text-xl font-medium tracking-[-0.02em]">
              Надиктовать ответ — в тарифе ULTRA.
            </h3>
            <p className="text-muted mt-3 text-sm leading-relaxed">
              Ответ голосом распознаётся на лету и анализируется так же, как текст. Удобно, когда
              писать лень, а думать — надо.
            </p>
          </div>
        </div>
        <div className="border-border mt-6 space-y-2 rounded-[12px] border bg-card p-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Check className="text-accent h-3.5 w-3.5" />
            <span>Безлимит разборов</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-accent h-3.5 w-3.5" />
            <span>Голосовые ответы до 3 минут</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-accent h-3.5 w-3.5" />
            <span>История и экспорт без срока</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="text-accent h-3.5 w-3.5" />
            <span>Приоритет анализа и поддержки</span>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-dim font-mono text-[11px] uppercase tracking-[0.08em]">
              1 490 ₽ / мес
            </p>
            <p className="text-dim text-xs">1 043 ₽/мес при оплате за год</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-dim hover:text-foreground text-sm"
            >
              Позже
            </button>
            <button
              type="button"
              className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-5 py-2.5 text-sm font-medium transition-all duration-300"
            >
              Взять ULTRA
              <Lock className="ml-1 inline h-3 w-3 -translate-y-px" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* =========== CABINET =========== */

function CabinetSection({
  tab,
  setTab,
  chartData,
  biasData,
}: {
  tab: 'history' | 'stats' | 'settings'
  setTab: (t: 'history' | 'stats' | 'settings') => void
  chartData: { m: string; s: number }[]
  biasData: { name: string; v: number }[]
}) {
  return (
    <motion.section
      key="cabinet"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[calc(100dvh-72px)]"
    >
      <aside className="border-border bg-card hidden w-[240px] flex-col border-r p-4 md:flex">
        <Logo />
        <nav className="mt-10 flex flex-col gap-2 font-mono text-[13px] uppercase tracking-[0.08em] text-muted">
          {(['history', 'stats', 'settings'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                'rounded-[4px] px-3 py-2 text-left transition-colors duration-300',
                tab === t ? 'bg-elevated text-foreground' : 'hover:text-foreground',
              )}
            >
              {t === 'history' ? 'История' : t === 'stats' ? 'Статистика' : 'Настройки'}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-4 text-sm text-muted">
          <p>Ты</p>
          <p className="text-dim text-xs">Подписка · Выход</p>
        </div>
      </aside>
      <div className="flex-1 p-4 md:p-10">
        {tab === 'history' && (
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.02em]">История решений</h2>
            <p className="text-muted mt-2">
              Каждое решение остаётся здесь — чтобы через месяц ты мог перечитать и сравнить.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
              {['Все', 'Логичные', 'Нелогичные', 'Частично'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className="border-border hover:border-border-hover rounded-[4px] border px-3 py-1 transition-colors"
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="border-border bg-card mt-8 rounded-[12px] border p-6">
              <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">
                12 апреля 2026
              </p>
              <p className="mt-2 text-lg">«Стоит ли менять работу на стартап?»</p>
              <p className="text-muted mt-2 text-sm">Оценка: 78 / 100 · Логично</p>
              <div className="mt-6 flex gap-3">
                <button type="button" className="text-accent text-sm font-medium">
                  Открыть
                </button>
                <a href="/pdf-preview.html" className="text-sm text-muted hover:text-foreground">
                  PDF
                </a>
              </div>
            </div>
          </div>
        )}
        {tab === 'stats' && (
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.02em]">Статистика</h2>
            <p className="text-muted mt-2">
              Средний балл логичности по месяцам и топ искажений, которые ты таскаешь с собой.
            </p>
            <div className="mt-8 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="m" stroke="#5a5a62" fontSize={11} />
                  <YAxis stroke="#5a5a62" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#121214', border: '1px solid #222226' }}
                  />
                  <Line type="monotone" dataKey="s" stroke="#c4f542" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-10 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={biasData}>
                  <XAxis dataKey="name" stroke="#5a5a62" fontSize={11} />
                  <YAxis stroke="#5a5a62" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#121214', border: '1px solid #222226' }}
                  />
                  <Bar dataKey="v" fill="#c4f542" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="border-border bg-card rounded-[12px] border p-5">
                <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">
                  Самое логичное решение месяца
                </p>
                <p className="mt-3 text-lg">Смена контракта после расчёта буфера</p>
              </div>
              <div className="border-border bg-card rounded-[12px] border p-5">
                <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">
                  Самое нелогичное
                </p>
                <p className="mt-3 text-lg">Импульсивный отказ без критериев</p>
              </div>
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="max-w-md">
            <h2 className="text-2xl font-medium tracking-[-0.02em]">Настройки</h2>
            <label className="mt-8 block text-sm text-muted">
              Телефон
              <input
                defaultValue="+7 ···"
                className="border-border bg-elevated mt-2 w-full rounded-[4px] border px-3 py-2 text-foreground"
              />
            </label>
            <label className="mt-6 block text-sm text-muted">
              Имя
              <input
                placeholder="Как к тебе обращаться"
                className="border-border bg-elevated mt-2 w-full rounded-[4px] border px-3 py-2 text-foreground"
              />
            </label>
            <div className="border-border bg-card mt-10 rounded-[12px] border p-5">
              <p className="text-accent font-mono text-[11px] uppercase tracking-[0.08em]">
                Подключить Telegram
              </p>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Тот же разбор в боте, без установки. Подписка — общая на все устройства.
              </p>
              <a
                href="https://t.me/logika_ai_bot"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
              >
                Открыть в Telegram →
              </a>
            </div>
            <p className="text-dim mt-10 text-sm leading-relaxed">
              Удаление аккаунта — без подтверждений по почте. Один клик, все данные уходят навсегда.
              Как ты и хотел.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  )
}
