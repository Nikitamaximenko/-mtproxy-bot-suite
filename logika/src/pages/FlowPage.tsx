import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { HeroFork } from '../components/landing/HeroFork'
import { useCountUp } from '../hooks/useCountUp'
import {
  type CabinetResponse,
  downloadPdf,
  fetchCabinet,
  fetchMe,
  hasApi,
  replySession,
  requestCode,
  requestEmailCode,
  startSession,
  verifyCode,
} from '../lib/logika-api'

const CabinetStatsTab = lazy(async () => {
  const m = await import('../components/cabinet/CabinetStatsTab')
  return { default: m.CabinetStatsTab }
})

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

function formatRuDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function maskPhoneE164(p: string) {
  if (p.length < 6) return p
  return `${p.slice(0, 4)} ··· ${p.slice(-2)}`
}

function maskEmailNorm(s: string) {
  const at = s.indexOf('@')
  if (at < 1) return s
  const local = s.slice(0, at)
  const domain = s.slice(at + 1)
  const lm =
    local.length <= 2 ? `${local[0] ?? ''}···` : `${local[0]}···${local.slice(-1)}`
  return `${lm}@${domain}`
}

function FlowPage() {
  const apiMode = hasApi()
  const [phase, setPhase] = useState<Phase>('phone')
  const [authChannel, setAuthChannel] = useState<'phone' | 'email'>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [firstQ, setFirstQ] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [analyzeLine, setAnalyzeLine] = useState(0)
  const [showPaywall, setShowPaywall] = useState(true)
  const [cabinetTab, setCabinetTab] = useState<'history' | 'stats' | 'settings'>('history')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'high' | 'low' | 'partial'>('all')
  const [cabinetData, setCabinetData] = useState<CabinetResponse | null>(null)
  const [cabinetLoading, setCabinetLoading] = useState(false)
  const [cabinetErr, setCabinetErr] = useState<string | null>(null)
  const [meProfile, setMeProfile] = useState<{
    phone_e164: string | null
    email_norm: string | null
    name: string | null
  } | null>(null)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [apiSessionId, setApiSessionId] = useState<string | null>(null)
  const [apiThread, setApiThread] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [apiReport, setApiReport] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (phase !== 'analyze') return
    if (apiMode) {
      const id = window.setInterval(() => {
        setAnalyzeLine((i) => (i + 1) % analyzeLines.length)
      }, 900)
      return () => clearInterval(id)
    }
    const id = window.setInterval(() => {
      setAnalyzeLine((i) => (i + 1) % analyzeLines.length)
    }, 900)
    const done = window.setTimeout(() => setPhase('report'), 3800)
    return () => {
      clearInterval(id)
      clearTimeout(done)
    }
  }, [phase, apiMode])

  useEffect(() => {
    if (phase !== 'cabinet' || !apiMode) return
    let cancel = false
    setCabinetLoading(true)
    setCabinetErr(null)
    void (async () => {
      try {
        const [cab, me] = await Promise.all([fetchCabinet(), fetchMe()])
        if (!cancel) {
          setCabinetData(cab)
          setMeProfile(me)
        }
      } catch (e) {
        if (!cancel) setCabinetErr(e instanceof Error ? e.message : 'Ошибка загрузки кабинета')
      } finally {
        if (!cancel) setCabinetLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [phase, apiMode])

  const score = Number(apiReport?.overall_score ?? 42)
  const scoreView = useCountUp(score, phase === 'report')

  const chartData = useMemo(() => {
    if (!cabinetData?.stats?.monthly?.length) return []
    return cabinetData.stats.monthly.map((m) => ({ m: m.label, s: m.avg_score }))
  }, [cabinetData])

  const biasData = useMemo(() => {
    if (!cabinetData?.stats?.biases?.length) return []
    return cabinetData.stats.biases.map((b) => ({ name: b.name, v: b.count }))
  }, [cabinetData])

  const filteredSessions = useMemo(() => {
    const list = cabinetData?.sessions ?? []
    return list.filter((s) => {
      if (historyFilter === 'all') return true
      if (s.phase !== 'done' || s.score == null) return false
      if (historyFilter === 'high') return s.score >= 70
      if (historyFilter === 'low') return s.score < 50
      return s.score >= 50 && s.score < 70
    })
  }, [cabinetData, historyFilter])

  const submitAnswer = async () => {
    const t = draft.trim()
    if (!t) return
    if (apiMode && apiSessionId) {
      if (apiThread.filter((m) => m.role === 'user').length >= 6) return
      setBusy(true)
      setFlowError(null)
      try {
        const nextThread = [...apiThread, { role: 'user' as const, content: t }]
        setApiThread(nextThread)
        setDraft('')
        const res = await replySession(apiSessionId, t)
        if ('done' in res && res.done && res.report) {
          setApiReport(res.report as Record<string, unknown>)
          setPhase('analyze')
          window.setTimeout(() => setPhase('report'), 2200)
        } else if ('bot_message' in res && res.bot_message) {
          setApiThread([...nextThread, { role: 'assistant', content: res.bot_message }])
        }
      } catch (e) {
        setFlowError(e instanceof Error ? e.message : 'Ошибка запроса')
        setApiThread((th) => th.slice(0, -1))
      } finally {
        setBusy(false)
      }
      return
    }
    if (answers.length >= 5) return
    const next = [...answers, t]
    setAnswers(next)
    setDraft('')
    if (next.length === 5) setPhase('analyze')
  }

  const sendPhone = async () => {
    setFlowError(null)
    if (apiMode) {
      setBusy(true)
      try {
        if (authChannel === 'phone') {
          await requestCode(phone)
        } else {
          await requestEmailCode(email.trim())
        }
        setPhase('code')
      } catch (e) {
        setFlowError(e instanceof Error ? e.message : 'Не удалось отправить код')
      } finally {
        setBusy(false)
      }
      return
    }
    setPhase('code')
  }

  const sendVerify = async () => {
    setFlowError(null)
    if (apiMode) {
      setBusy(true)
      try {
        if (authChannel === 'phone') {
          await verifyCode({ phone, code })
        } else {
          await verifyCode({ email: email.trim(), code })
        }
        setPhase('onb1')
      } catch (e) {
        setFlowError(e instanceof Error ? e.message : 'Неверный код')
      } finally {
        setBusy(false)
      }
      return
    }
    setPhase('onb1')
  }

  const startChatFromOnboarding = async () => {
    const d = firstQ.trim()
    if (d.length < 8) return
    setFlowError(null)
    if (apiMode) {
      setBusy(true)
      try {
        const r = await startSession(d)
        setApiSessionId(r.session_id)
        setApiThread([
          { role: 'user', content: d },
          { role: 'assistant', content: r.bot_message },
        ])
        setPhase('chat')
      } catch (e) {
        setFlowError(e instanceof Error ? e.message : 'Не удалось начать сессию')
      } finally {
        setBusy(false)
      }
      return
    }
    setPhase('chat')
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
      {flowError && (
        <div className="border-danger/30 bg-danger/10 text-danger border-b px-4 py-3 text-center text-sm">
          {flowError}
        </div>
      )}

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
                    {authChannel === 'phone' ? 'Твой номер телефона' : 'Твоя почта'}
                  </h1>
                  <div className="mt-8 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthChannel('phone')
                        setFlowError(null)
                      }}
                      className={clsx(
                        'rounded-[4px] px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors',
                        authChannel === 'phone'
                          ? 'bg-accent text-background'
                          : 'text-muted hover:text-foreground border-border border',
                      )}
                    >
                      Телефон
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthChannel('email')
                        setFlowError(null)
                      }}
                      className={clsx(
                        'rounded-[4px] px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors',
                        authChannel === 'email'
                          ? 'bg-accent text-background'
                          : 'text-muted hover:text-foreground border-border border',
                      )}
                    >
                      Почта
                    </button>
                  </div>
                  {authChannel === 'phone' ? (
                    <label className="mt-8 block">
                      <span className="text-dim font-mono text-xs uppercase tracking-[0.08em]">+7</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="___ ___ __ __"
                        className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-2 w-full rounded-[4px] border px-4 py-3 text-lg outline-none transition-all duration-300 focus:ring-2"
                      />
                    </label>
                  ) : (
                    <label className="mt-8 block">
                      <span className="text-dim font-mono text-xs uppercase tracking-[0.08em]">Email</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-2 w-full rounded-[4px] border px-4 py-3 text-lg outline-none transition-all duration-300 focus:ring-2"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendPhone()}
                    disabled={
                      busy ||
                      (authChannel === 'phone'
                        ? phone.replace(/\D/g, '').length < 10
                        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                    }
                    className="ease-brand bg-accent text-background hover:bg-accent-hover mt-8 w-full rounded-[4px] py-3 font-medium transition-all duration-300 disabled:opacity-40"
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
                  <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                    {authChannel === 'phone' ? 'Код из SMS' : 'Код из письма'}
                  </h1>
                  <p className="text-muted mt-3 text-sm leading-relaxed">
                    {authChannel === 'phone'
                      ? 'Сервер отвечает сразу; доставка SMS зависит от оператора и может занять до нескольких минут.'
                      : 'Проверьте папку «Спам», если письма нет во входящих.'}
                  </p>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    className="border-border bg-elevated focus:border-accent focus:ring-accent/30 mt-8 w-full rounded-[4px] border px-4 py-4 font-mono text-2xl tracking-[0.4em] outline-none transition-all duration-300 focus:ring-2"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => void sendVerify()}
                    disabled={code.length < 4 || busy}
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
                      onClick={() => void startChatFromOnboarding()}
                      disabled={firstQ.trim().length < 8 || busy}
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
                <span>
                  Вопрос{' '}
                  {apiMode
                    ? Math.min(
                        apiThread.filter((m) => m.role === 'assistant').length,
                        5,
                      )
                    : Math.min(answers.length + 1, 5)}{' '}
                  из 5
                </span>
                <span>
                  {Math.round(
                    ((apiMode
                      ? Math.min(apiThread.filter((m) => m.role === 'assistant').length, 5)
                      : answers.length + 1) /
                      5) *
                      100,
                  )}
                  %
                </span>
              </div>
              <div className="bg-border mt-2 h-1 w-full rounded-full">
                <motion.div
                  className="bg-accent h-1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      ((apiMode
                        ? Math.min(apiThread.filter((m) => m.role === 'assistant').length, 5)
                        : answers.length + 1) /
                        5) *
                      100
                    }%`,
                  }}
                  transition={{ duration: 0.4, ease }}
                />
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pb-28">
              {apiMode ? (
                apiThread.map((m, i) => (
                  <Bubble
                    key={i}
                    role={m.role === 'assistant' ? 'bot' : 'user'}
                    text={m.content}
                  />
                ))
              ) : (
                <>
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
                </>
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
                      void submitAnswer()
                    }
                  }}
                  placeholder="Ответ…"
                  disabled={busy}
                  className="border-border bg-elevated focus:border-accent flex-1 rounded-[12px] border px-4 py-3 text-[15px] outline-none transition-colors duration-300 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void submitAnswer()}
                  disabled={busy}
                  className="ease-brand bg-accent text-background hover:bg-accent-hover rounded-[4px] px-4 py-3 font-medium transition-all duration-300 disabled:opacity-50"
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
            className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14"
          >
            <div className="border-border bg-card/40 rounded-2xl border px-5 py-8 sm:px-8 md:px-10">
              <p className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Overall Score</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <motion.span
                  className="text-[clamp(3rem,14vw,5.5rem)] font-medium leading-none tracking-[-0.04em]"
                  style={{ color: score < 40 ? '#ff4d4d' : score < 70 ? '#ffb23d' : '#c4f542' }}
                >
                  {scoreView}
                </motion.span>
                <span className="text-muted text-2xl font-medium md:text-3xl">/100</span>
              </div>
              <p className="mt-6 text-left text-xl font-medium leading-snug tracking-[-0.02em] md:text-2xl">
                {String(apiReport?.verdict_short ?? 'Решение частично логично')}
              </p>
              <p className="text-muted mt-5 max-w-prose text-left text-base leading-relaxed">
                {apiMode && apiReport?.summary
                  ? String(apiReport.summary)
                  : 'Твои аргументы проверены по четырём законам логики и типичным искажениям.'}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {(Array.isArray(apiReport?.laws) && apiReport!.laws!.length > 0
                ? (apiReport!.laws as { name?: string; status?: string; comment?: string }[])
                : [
                    { name: 'Тождество', status: 'частично', comment: '…' },
                    { name: 'Непротиворечие', status: 'да', comment: '…' },
                    { name: 'Исключённое третье', status: 'нет', comment: '…' },
                    { name: 'Достаточное основание', status: 'частично', comment: '…' },
                  ]
              ).map((row, idx) => (
                <div
                  key={`${row.name ?? idx}-${idx}`}
                  className="border-border bg-card flex h-full flex-col rounded-xl border p-5 text-left"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-[15px] font-medium leading-snug">{row.name}</h3>
                    <span className="text-dim shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">
                      {row.status}
                    </span>
                  </div>
                  <p className="text-muted mt-3 text-sm leading-relaxed">{row.comment}</p>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Искажения</h3>
              <ul className="mt-4 space-y-3">
                {(Array.isArray(apiReport?.biases) && apiReport!.biases!.length > 0
                  ? (apiReport!.biases as { name?: string; hint?: string }[])
                  : [{ name: '—', hint: 'Нет данных' }]
                ).map((x, i) => (
                  <li
                    key={i}
                    className="border-border bg-elevated rounded-[12px] border px-4 py-3 text-sm text-muted"
                  >
                    <span className="text-foreground">{x.name}</span>
                    {x.hint ? ` — ${x.hint}` : ''}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12">
              <h3 className="text-dim font-mono text-[12px] uppercase tracking-[0.1em]">Альтернативы</h3>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-muted">
                {(Array.isArray(apiReport?.alternatives) && apiReport!.alternatives!.length > 0
                  ? (apiReport!.alternatives as string[])
                  : [
                      'Остаться на 90 дней с измеримым экспериментом.',
                      'Уточнить финансовый буфер цифрами.',
                      'Сменить контекст без смены работы.',
                    ]
                ).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>

            <blockquote className="border-border bg-card mt-14 rounded-2xl border p-6 text-left text-xl font-medium leading-snug tracking-[-0.02em] sm:p-8 md:text-2xl">
              {apiReport?.quote && typeof apiReport.quote === 'object' && apiReport.quote !== null
                ? String((apiReport.quote as { text?: string }).text ?? '—')
                : 'Когда факты меняются, я меняю мнение.'}
              <footer className="text-dim mt-6 font-mono text-[12px] uppercase tracking-[0.1em]">
                {apiReport?.quote && typeof apiReport.quote === 'object' && apiReport.quote !== null
                  ? String((apiReport.quote as { author?: string }).author ?? '')
                  : 'Кейнс'}
              </footer>
            </blockquote>

            <div className="mt-12 flex flex-wrap gap-4">
              {apiMode && apiSessionId ? (
                <button
                  type="button"
                  onClick={() => void downloadPdf(apiSessionId)}
                  className="ease-brand border-border hover:border-border-hover rounded-[4px] border px-5 py-3 font-medium transition-colors duration-300"
                >
                  Скачать PDF
                </button>
              ) : (
                <a
                  href="/pdf-preview.html"
                  target="_blank"
                  rel="noreferrer"
                  className="ease-brand border-border hover:border-border-hover rounded-[4px] border px-5 py-3 font-medium transition-colors duration-300"
                >
                  Скачать PDF
                </a>
              )}
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
              {!apiMode && (
                <p className="text-muted max-w-md text-sm">
                  Кабинет с историей из API: задайте <span className="font-mono">VITE_LOGIKA_API_URL</span> при
                  сборке фронта.
                </p>
              )}
              {apiMode && cabinetErr && (
                <p className="text-danger text-sm">{cabinetErr}</p>
              )}
              {cabinetTab === 'history' && (
                <div>
                  <h2 className="text-2xl font-medium">История</h2>
                  {cabinetLoading && <p className="text-muted mt-4 text-sm">Загрузка…</p>}
                  <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                    {(
                      [
                        ['all', 'Все'],
                        ['high', 'Логичные'],
                        ['low', 'Нелогичные'],
                        ['partial', 'Частично'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setHistoryFilter(id)}
                        className={clsx(
                          'rounded-[4px] border px-3 py-1 transition-colors',
                          historyFilter === id
                            ? 'border-accent text-foreground'
                            : 'border-border hover:border-border-hover',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {!cabinetLoading && filteredSessions.length === 0 && (
                    <p className="text-muted mt-8 text-sm">
                      Пока нет сессий по этому фильтру. Пройди анализ в потоке — записи появятся здесь.
                    </p>
                  )}
                  <div className="mt-8 space-y-4">
                    {filteredSessions.map((s) => (
                      <div key={s.session_id} className="border-border bg-card rounded-[12px] border p-6">
                        <p className="text-dim font-mono text-xs uppercase tracking-[0.08em]">
                          {formatRuDate(s.updated_at)}
                        </p>
                        <p className="mt-2 text-lg leading-snug">
                          «{s.dilemma.length > 160 ? `${s.dilemma.slice(0, 160)}…` : s.dilemma}»
                        </p>
                        <p className="text-muted mt-2 text-sm">
                          {s.phase === 'done' && s.score != null
                            ? `Оценка: ${s.score} / 100${s.verdict_short ? ` · ${s.verdict_short}` : ''}`
                            : s.phase === 'clarifying'
                              ? 'Сессия не завершена'
                              : '—'}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          {s.phase === 'done' && (
                            <button
                              type="button"
                              onClick={() => void downloadPdf(s.session_id)}
                              className="text-accent text-sm font-medium"
                            >
                              Скачать PDF
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cabinetTab === 'stats' && (
                <Suspense
                  fallback={<p className="text-muted mt-2 text-sm">Загрузка графиков…</p>}
                >
                  <CabinetStatsTab
                    cabinetData={cabinetData}
                    cabinetLoading={cabinetLoading}
                    chartData={chartData}
                    biasData={biasData}
                  />
                </Suspense>
              )}
              {cabinetTab === 'settings' && (
                <div className="max-w-md">
                  <h2 className="text-2xl font-medium">Настройки</h2>
                  <label className="mt-8 block text-sm text-muted">
                    Телефон
                    <input
                      readOnly
                      value={
                        meProfile?.phone_e164
                          ? maskPhoneE164(meProfile.phone_e164)
                          : '—'
                      }
                      className="border-border bg-elevated mt-2 w-full cursor-not-allowed rounded-[4px] border px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="mt-6 block text-sm text-muted">
                    Почта
                    <input
                      readOnly
                      value={
                        meProfile?.email_norm ? maskEmailNorm(meProfile.email_norm) : '—'
                      }
                      className="border-border bg-elevated mt-2 w-full cursor-not-allowed rounded-[4px] border px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="mt-6 block text-sm text-muted">
                    Имя
                    <input
                      placeholder="Как к тебе обращаться"
                      defaultValue={meProfile?.name ?? ''}
                      className="border-border bg-elevated mt-2 w-full rounded-[4px] border px-3 py-2 text-foreground"
                    />
                  </label>
                  <p className="text-dim mt-10 text-sm">
                    Имя пока только локально в поле; сохранение на сервер — в следующих версиях.
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
