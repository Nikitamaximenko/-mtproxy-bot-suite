const TOKEN_KEY = 'logika_access_token'

/** UUID активной сессии чата — восстановление после перезагрузки страницы. */
export const LOGIKA_ACTIVE_SESSION_KEY = 'logika_active_session_id'

export function persistActiveSessionId(sessionId: string | null) {
  try {
    if (sessionId) localStorage.setItem(LOGIKA_ACTIVE_SESSION_KEY, sessionId)
    else localStorage.removeItem(LOGIKA_ACTIVE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** Выход: токен и привязка к черновику сессии. */
export function clearLocalAuth() {
  setToken(null)
  persistActiveSessionId(null)
}

export function getApiBase(): string {
  const u = import.meta.env.VITE_LOGIKA_API_URL as string | undefined
  return (u || '').replace(/\/$/, '')
}

export function hasApi(): boolean {
  return Boolean(getApiBase())
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** HTTP-ошибки API с кодом ответа (для отличия 401 от сетевых сбоев). */
export class LogikaHttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LogikaHttpError'
    this.status = status
  }
}

function mapNetworkError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  const lower = msg.toLowerCase()
  /** Safari/WebKit часто кидает TypeError с текстом «Load failed» при сбое fetch (CORS, сеть, таймаут). */
  const looksLikeFetchFailure =
    (e instanceof TypeError &&
      (msg === 'Failed to fetch' ||
        lower.includes('network') ||
        lower.includes('fetch'))) ||
    lower === 'load failed' ||
    lower.includes('failed to load') ||
    lower.includes('the network connection was lost')

  if (looksLikeFetchFailure) {
    return new Error(
      'Нет ответа от сервера (сеть, CORS или долгий запрос). Сбор отчёта может занять 1–3 минуты — попробуйте ещё раз; проверьте VITE_LOGIKA_API_URL и что бэкенд на Railway доступен.',
    )
  }
  return e instanceof Error ? e : new Error(msg)
}

async function req<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const base = getApiBase()
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`
  let body: BodyInit | undefined = init.body as BodyInit | undefined
  if (init.json !== undefined) {
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  let r: Response
  try {
    r = await fetch(`${base}${path}`, { ...init, headers, body })
  } catch (e) {
    throw mapNetworkError(e)
  }
  if (!r.ok) {
    let msg = (r.statusText || '').trim()
    try {
      const j = await r.json()
      if (typeof j.detail === 'string') msg = j.detail
      else if (Array.isArray(j.detail)) msg = j.detail.map((x: { msg?: string }) => x.msg).join(', ')
    } catch {
      /* ignore */
    }
    if (!msg) {
      msg =
        r.status === 502
          ? 'Сервер временно не смог обработать запрос (502). Сбор отчёта тяжёлый — повторите через минуту; если снова ошибка, посмотрите логи бэкенда.'
          : `Ошибка сервера (${r.status}).`
    }
    throw new LogikaHttpError(msg, r.status)
  }
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}

export async function requestCode(phone: string) {
  return req<{ ok: boolean }>('/v1/auth/request-code', { method: 'POST', json: { phone } })
}

export async function requestEmailCode(email: string) {
  return req<{ ok: boolean }>('/v1/auth/request-email-code', { method: 'POST', json: { email } })
}

export async function verifyCode(
  opts: { phone: string; code: string } | { email: string; code: string },
) {
  const json =
    'phone' in opts
      ? { phone: opts.phone, code: opts.code }
      : { email: opts.email, code: opts.code }
  const data = await req<{ access_token: string; token_type: string }>('/v1/auth/verify', {
    method: 'POST',
    json,
  })
  setToken(data.access_token)
  return data
}

export async function startSession(dilemma: string) {
  return req<{ session_id: string; bot_message: string }>('/v1/sessions/start', {
    method: 'POST',
    json: { dilemma },
  })
}

export async function replySession(sessionId: string, text: string) {
  return req<
    | { bot_message: string; done: false }
    | { done: true; report: Record<string, unknown> }
  >(`/v1/sessions/${sessionId}/reply`, { method: 'POST', json: { text } })
}

export type SessionDetail = {
  session_id: string
  dilemma: string
  messages: Array<{ role: string; content: string }>
  phase: string
  report: Record<string, unknown> | null
  score: number | null
  created_at?: string | null
  updated_at?: string | null
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  return req<SessionDetail>(`/v1/sessions/${sessionId}`)
}

export type CabinetSession = {
  session_id: string
  dilemma: string
  phase: string
  score: number | null
  created_at: string | null
  updated_at: string | null
  verdict_short: string | null
}

export type CabinetResponse = {
  sessions: CabinetSession[]
  stats: {
    monthly: { month: string; label: string; avg_score: number; count: number }[]
    biases: { name: string; count: number }[]
    highlight_high: {
      session_id: string
      score: number | null
      verdict_short: string | null
      dilemma_short: string
    } | null
    highlight_low: {
      session_id: string
      score: number | null
      verdict_short: string | null
      dilemma_short: string
    } | null
    totals: { sessions: number; completed: number }
  }
}

export async function fetchCabinet(): Promise<CabinetResponse> {
  return req<CabinetResponse>('/v1/cabinet')
}

export async function fetchMe(): Promise<{
  phone_e164: string | null
  email_norm: string | null
  name: string | null
}> {
  return req('/v1/me')
}

export async function downloadPdf(sessionId: string) {
  const base = getApiBase()
  const token = getToken()
  let r: Response
  try {
    r = await fetch(`${base}/v1/sessions/${sessionId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    throw mapNetworkError(e)
  }
  if (!r.ok) {
    let msg = (r.statusText || '').trim()
    try {
      const j = (await r.json()) as { detail?: unknown }
      if (typeof j.detail === 'string') msg = j.detail
      else if (Array.isArray(j.detail))
        msg = j.detail.map((x: { msg?: string }) => x.msg).filter(Boolean).join(', ')
    } catch {
      /* ignore */
    }
    if (!msg) msg = `Не удалось скачать PDF (${r.status})`
    throw new LogikaHttpError(msg, r.status)
  }
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logika-${sessionId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
