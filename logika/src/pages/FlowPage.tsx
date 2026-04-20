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
  'Ты принял это решение за последние 7 дней?',
  'Оно противоречит тому, что ты говорил себе раньше?',
  'Какой факт сейчас самый неудобный?',
  'Ты ищешь ясность или одобрение?',
  'Если цифры убрать — что останется из аргумента?',
]

const analyzeLines = [
  'Проверяю закон тождества…',
  'Ищу когнитивные искажения…',
  'Собираю альтернативы…',
  'Сопоставляю с базой…',
]

const ease = [0.32, 0.72, 0, 1] as const

function FlowPage() {
  const [phase, setPhase] = useState<Phase>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [firstQ, setFirstQ] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [analyzeLine, setAnalyzeLine] = useState(0)
  const [showPaywall, setShowPaywall] = useState(true)
  const [cabinetTab, setCabinetTab] = useState<'history' | 'stats' | 'settings'>('history')

  useEffect(() => {
    if (phase !== 'analyze') return
    const id = window.setInterval(() => {
      setAnalyzeLine((i) => (i + 1) % analyzeLines.length)
    }, 900)
    const done = window.setTimeout(() => setPhase('report'), 3800)
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
        <Link to="/" className="text-dim hover:text-foreground font-mono text-[13px] uppercase tracking-[0.08em]">
          На лендинг
        </Link>
      </header>

      <AnimatePresence mode="wait">
        {(phase === 'phone' || phase === 'code') && (
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
              <p className="text-muted font-mono text-[13px] uppercase tracking-[0.08em]">
                Один вопрос. Одна истина.
              </p>
              {phase === 'phone' && (
                <>
                  <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                    Твой номер телефона
                  </h1>
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
                    onClick={() => setPhase('code')}
                    className="ease-brand bg-accent text-background hover:bg-accent-hover mt-8 w-full rounded-[4px] py-3 font-medium transition-all duration-300"
                  >
                    Получить код
                    <span className="ml-1">→</span>
                  </button>
                  <p className="text-dim mt-8 text-sm leading-relaxed">
                    Нажимая, ты соглашаешься с офертой. Новый пользователь — аккаунт создаётся сам.
                  </p>
                </>
              )}
              {phase === 'code' && (
                <>
                  <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] md:text-4xl">Код из SMS</h1>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-10 w-full rounded-[4px] border px-4 py-4 font-mono text-2xl tracking-[0.4em] outline-none transition-all duration-300 focus:ring-2"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setPhase('onb1')}
                    disabled={code.length < 4}
                    className="ease-brand bg-accent text-background hover:bg-accent-hover mt-8 w-full rounded-[4px] py-3 font-medium transition-all duration-300 disabled:opacity-40"
                  >
                    Войти
                  </button>
                </>
              )}
            </div>
          </motion.section>
        )}

        {phase.startsWith('onb') && (
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
                    title="Кто ты сейчас"
                    body="Сейчас ты — точка. Одно решение. Одна ситуация."
                    onNext={() => setPhase('onb2')}
                  />
                )}
                {phase === 'onb2' && (
                  <OnbSlide
                    title="Что перед тобой"
                    body="Перед тобой — варианты. Они кажутся разными. На самом деле — не всегда."
                    onNext={() => setPhase('onb3')}
                  />
                )}
                {phase === 'onb3' && (
                  <OnbSlide
                    title="Что делает Логика"
                    body="Мы проверим каждый путь. По четырём законам. Через искажения. Оставим то, что выдержит проверку."
                    onNext={() => setPhase('onb4')}
                  />
                )}
                {phase === 'onb4' && (
                  <div>
                    <h2 className="text-3xl font-medium tracking-[-0.02em] md:text-4xl">Твой первый вопрос</h2>
                    <p className="text-muted mt-4 text-lg">
                      Опиши дилемму. Как другу. Без самоцензуры. Чем честнее — тем точнее анализ.
                    </p>
                    <textarea
                      value={firstQ}
                      onChange={(e) => setFirstQ(e.target.value)}
                      placeholder='Например: «Хочу уволиться, но боюсь потерять стабильность…»'
                      rows={5}
                      className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-8 w-full rounded-[12px] border p-4 text-[15px] leading-relaxed outline-none transition-all duration-300 focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => setPhase('chat')}
                      disabled={firstQ.trim().length < 8}
                      className="ease-brand bg-accent text-background hover:bg-accent-hover mt-6 rounded-[4px] px-6 py-3 font-medium transition-all duration-300 disabled:opacity-40"
                    >
                      Отправить
                      <span className="ml-1">→</span>
                    </button>
                    <p className="text-dim mt-3 font-mono text-xs uppercase tracking-[0.08em]">
                      Ctrl+Enter — отправить в полной версии
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {phase === 'chat' && (
          <motion.section
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-[720px] flex-col px-4 py-8"
          >
            <div className="mb-4">
              <div className="text-dim flex items-center justify-between font-mono text-[13px] uppercase tracking-[0.08em]">
                <span>Вопрос {Math.min(answers.length + 1, 5)} из 5</span>
                <span>{Math.round(((answers.length + 1) / 5) * 100)}%</span>
              </div>
              <div className="bg-border mt-2 h-1 w-full rounded-full">
                <motion.div
                  className="bg-accent h-1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((answers.length + 1) / 5) * 100}%` }}
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
              {answers.length < 5 && (
                <Bubble role="bot" text={botQuestions[answers.length]} />
              )}
            </div>
            <div className="border-border bg-background/90 fixed bottom-0 left-0 right-0 border-t p-4 backdrop-blur-md">
              <div className="mx-auto flex max-w-[720px] gap-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      submitAnswer()
                    }
                  }}
                  placeholder="Ответ…"
                  className="border-border bg-elevated focus:border-accent flex-1 rounded-[12px] border px-4 py-3 text-[15px] outline-none transition-colors duration-300"
                />
                <button
                  type="button"
                  onClick={submitAnswer}
                  className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-4 py-3 font-medium transition-all duration-300"
                >
                  Ответить
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {phase === 'analyze' && (
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
            <p className="text-muted mt-8 font-mono text-sm uppercase tracking-[0.08em]">
              {analyzeLines[analyzeLine]}
            </p>
          </motion.section>
        )}

        {phase === 'report' && (
          <motion.section
            key="report"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-[840px] px-4 py-12"
          >
            <div className="flex min-h-[55dvh] flex-col items-center justify-center text-center">
              <p className="text-dim font-mono text-[13px] uppercase tracking-[0.08em]">Overall Score</p>
              <motion.div
                className="text-accent mt-4 text-[clamp(5rem,18vw,9rem)] font-medium leading-none tracking-[-0.04em]"
                style={{ color: score < 40 ? '#ff4d4d' : score < 70 ? '#ffb23d' : '#c4f542' }}
              >
                {scoreView}
                <span className="text-muted text-[0.35em] align-super">/100</span>
              </motion.div>
              <p className="mt-6 text-2xl font-medium tracking-[-0.02em]">Решение частично логично</p>
              <p className="text-muted mt-4 max-w-lg text-lg">
                Твои аргументы выдержали 2 из 4 законов логики. Обнаружено 3 когнитивных искажения.
              </p>
            </div>

            <div className="mt-16 grid gap-4 md:grid-cols-2">
              {[
                { t: 'Тождество', s: 'частично', d: 'Формулировка запроса меняется под давлением новизны.' },
                { t: 'Непротиворечие', s: 'да', d: 'Нет прямого столкновения утверждений в одной плоскости.' },
                { t: 'Исключённое третье', s: 'нет', d: 'Промежуточные состояния описаны как окончательные.' },
                { t: 'Достаточное основание', s: 'частично', d: 'Причины названы, но не проверены на независимость.' },
              ].map((row) => (
                <div key={row.t} className="border-border bg-card rounded-[12px] border p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{row.t}</h3>
                    <span className="text-dim font-mono text-xs uppercase tracking-[0.08em]">{row.s}</span>
                  </div>
                  <p className="text-muted mt-3 text-sm leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <h3 className="text-lg font-medium">Искажения</h3>
              <ul className="mt-4 space-y-3">
                {['Свежесть события', 'Поиск подтверждения', 'Чёрно-белое мышление'].map((x) => (
                  <li key={x} className="border-border bg-elevated rounded-[12px] border px-4 py-3 text-sm text-muted">
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12">
              <h3 className="text-lg font-medium">Альтернативы</h3>
              <ol className="mt-4 list-decimal space-y-4 pl-5 text-muted">
                <li>Остаться на 90 дней с измеримым экспериментом — снижает импульс.</li>
                <li>Уточнить финансовый буфер цифрами — убирает страх как единственный аргумент.</li>
                <li>Сменить контекст без смены работы — проверка гипотезы без точки невозврата.</li>
              </ol>
            </div>

            <blockquote className="border-border bg-card mt-16 rounded-[20px] border p-10 text-center text-2xl font-medium leading-snug tracking-[-0.02em] md:text-3xl">
              Когда факты меняются, я меняю мнение.
              <footer className="text-dim mt-8 font-mono text-[13px] uppercase tracking-[0.08em]">
                Кейнс
              </footer>
            </blockquote>

            <div className="mt-12 flex flex-wrap gap-4">
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
                onClick={() => setPhase('cabinet')}
                className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-5 py-3 font-medium transition-all duration-300"
              >
                В кабинет
              </button>
              <button type="button" className="text-muted hover:text-foreground font-medium underline-offset-4 transition-colors hover:underline">
                Поделиться
              </button>
            </div>

            {showPaywall && (
              <div className="bg-background/75 fixed inset-0 z-40 flex items-end justify-center backdrop-blur-sm md:items-center">
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="border-border bg-elevated m-4 w-full max-w-[960px] rounded-[20px] border p-8 shadow-2xl"
                >
                  <h3 className="text-2xl font-medium tracking-[-0.02em]">
                    Это был твой первый анализ. Остальные 34 999 решений в этом месяце — с Логикой?
                  </h3>
                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {['FREE', 'PRO', 'UNLIMITED'].map((name) => (
                      <div key={name} className="border-border bg-card rounded-[12px] border p-5">
                        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{name}</p>
                        <p className="mt-4 text-lg font-medium">Подключить</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaywall(false)}
                    className="text-dim hover:text-foreground mt-8 text-sm underline-offset-4 transition-colors hover:underline"
                  >
                    Продолжить без подписки
                  </button>
                </motion.div>
              </div>
            )}
          </motion.section>
        )}

        {phase === 'cabinet' && (
          <motion.section
            key="cabinet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[calc(100dvh-72px)]"
          >
            <aside className="border-border bg-card hidden w-[240px] flex-col border-r p-4 md:flex">
              <Logo />
              <nav className="mt-10 flex flex-col gap-2 font-mono text-[13px] uppercase tracking-[0.08em] text-muted">
                <button
                  type="button"
                  onClick={() => setCabinetTab('history')}
                  className={clsx(
                    'rounded-[4px] px-3 py-2 text-left transition-colors duration-300',
                    cabinetTab === 'history' ? 'bg-elevated text-foreground' : 'hover:text-foreground',
                  )}
                >
                  История
                </button>
                <button
                  type="button"
                  onClick={() => setCabinetTab('stats')}
                  className={clsx(
                    'rounded-[4px] px-3 py-2 text-left transition-colors duration-300',
                    cabinetTab === 'stats' ? 'bg-elevated text-foreground' : 'hover:text-foreground',
                  )}
                >
                  Статистика
                </button>
                <button
                  type="button"
                  onClick={() => setCabinetTab('settings')}
                  className={clsx(
                    'rounded-[4px] px-3 py-2 text-left transition-colors duration-300',
                    cabinetTab === 'settings' ? 'bg-elevated text-foreground' : 'hover:text-foreground',
                  )}
                >
                  Настройки
                </button>
              </nav>
              <div className="mt-auto border-t border-border pt-4 text-sm text-muted">
                <p>Ты</p>
                <p className="text-dim text-xs">Подписка · Выход</p>
              </div>
            </aside>
            <div className="flex-1 p-4 md:p-10">
              {cabinetTab === 'history' && (
                <div>
                  <h2 className="text-2xl font-medium">История</h2>
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
                    <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">12 апреля 2026</p>
                    <p className="mt-2 text-lg">«Стоит ли менять работу на стартап?»</p>
                    <p className="text-muted mt-2 text-sm">
                      Overall Score: 78 из 100 · Логично
                    </p>
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
              {cabinetTab === 'stats' && (
                <div>
                  <h2 className="text-2xl font-medium">Статистика</h2>
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
              {cabinetTab === 'settings' && (
                <div className="max-w-md">
                  <h2 className="text-2xl font-medium">Настройки</h2>
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
                  <p className="text-dim mt-10 text-sm">
                    Удаление аккаунта — без соплей, без возврата данных. Как ты и просил.
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

function OnbSlide({
  title,
  body,
  onNext,
}: {
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
      <h2 className="text-center text-3xl font-medium tracking-[-0.02em] md:text-5xl">{title}</h2>
      <p className="text-muted mx-auto mt-6 max-w-lg text-center text-lg leading-relaxed">{body}</p>
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
            <span className="text-dim font-mono text-[11px] uppercase tracking-[0.08em]">Логика</span>
          </div>
        )}
        {text}
      </div>
    </div>
  )
}

export default FlowPage
